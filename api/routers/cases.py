import os
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from api.dependencies import get_db_session, require_api_key

logger = logging.getLogger("CasesRouter")

router = APIRouter()

# Updated to perfectly match the payload sent from frontend/src/services/api.ts
class CaseRequest(BaseModel):
    title: str
    alias: str | None = None
    priority: str = "MEDIUM"
    analyst: str | None = None
    description: str | None = None

@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_api_key)])
async def create_case(
    request: CaseRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Opens a new investigation case."""
    now = datetime.now(timezone.utc)
    case_id = uuid.uuid4()
    case_number = f"NSB-{now.year}-{now.strftime('%m%d%H%M')}"
    actor = request.analyst or "SYSTEM"

    try:
        stmt = text("""
            INSERT INTO core.cases (id, case_number, title, alias, description, priority, analyst, status, created_by, created_at, updated_at, tags)
            VALUES (:id, :case_number, :title, :alias, :description, :priority, :analyst, 'OPEN', :created_by, :created_at, :updated_at, '{}')
            RETURNING id, case_number, title, alias, priority, analyst, description, status, created_at
        """)
        result = await db.execute(stmt, {
            "id": str(case_id),
            "case_number": case_number,
            "title": request.title,
            "alias": request.alias,
            "description": request.description,
            "priority": request.priority.upper(),
            "analyst": request.analyst,
            "created_by": actor,
            "created_at": now,
            "updated_at": now,
        })

        audit_stmt = text("""
            INSERT INTO core.audit_events (id, resource_id, action, created_at, performed_by)
            VALUES (:id, :resource_id, 'CASE_CREATED', :created_at, :performed_by)
        """)
        await db.execute(audit_stmt, {
            "id": str(uuid.uuid4()),
            "resource_id": str(case_id),
            "created_at": now,
            "performed_by": actor,
        })

        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create case in PostgreSQL: {str(e)}")

    row = result.mappings().fetchone()
    return {"status": "success", "case_id": str(case_id), **dict(row)}

@router.get("")
async def list_cases(db: AsyncSession = Depends(get_db_session)):
    """Lists all cases. Cases are server-authoritative - the frontend used to
    cache them in localStorage only, which meant they vanished on a cleared
    browser or a second device."""
    try:
        stmt = text("""
            SELECT id, title, alias, analyst, priority, created_at
            FROM core.cases
            ORDER BY created_at DESC
        """)
        result = await db.execute(stmt)
        rows = result.mappings().all()

        return {
            "cases": [
                {
                    "id": str(row["id"]),
                    "name": row["title"],
                    "alias": row["alias"] or "",
                    "analyst": row["analyst"] or "",
                    "priority": row["priority"],
                    "created": row["created_at"].date().isoformat(),
                }
                for row in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch cases: {str(e)}")


@router.get("/{case_id}")
async def get_case(case_id: UUID):
    # This would route to a GetCaseQuery handler in CQRS
    return {"message": f"Details for case {case_id}"}


# ==========================================
# ADDED: Missing Endpoints to fix HTTP 405
# ==========================================

@router.put("/{case_id}", dependencies=[Depends(require_api_key)])
async def update_case(
    case_id: UUID,
    request: CaseRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Updates an existing case. Fixes the 405 Method Not Allowed error."""
    try:
        stmt = text("""
            UPDATE core.cases
            SET title = :title, alias = :alias, priority = :priority, analyst = :analyst, description = :description, updated_at = :updated_at
            WHERE id = :id
            RETURNING id, title, alias, priority, analyst, description
        """)

        result = await db.execute(stmt, {
            "id": str(case_id),
            "title": request.title,
            "alias": request.alias,
            "priority": request.priority,
            "analyst": request.analyst,
            "description": request.description,
            "updated_at": datetime.now(timezone.utc),
        })
        await db.commit()

        row = result.mappings().fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Case not found")

        return dict(row)

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update case in PostgreSQL: {str(e)}")


@router.delete("/{case_id}", dependencies=[Depends(require_api_key)])
async def delete_case(
    case_id: UUID,
    db: AsyncSession = Depends(get_db_session)
):
    """Deletes a case and cascades to its evidence, analysis jobs, and the
    physical files in the storage vault - evidence.case_id has no ON DELETE
    CASCADE at the DB level, so this has to be done explicitly or the delete
    fails on the foreign key (or silently orphans the child rows)."""
    try:
        evidence_stmt = text("SELECT id, storage_uri FROM core.evidence WHERE case_id = :case_id")
        evidence_rows = (await db.execute(evidence_stmt, {"case_id": str(case_id)})).fetchall()

        for ev in evidence_rows:
            file_path = Path(ev.storage_uri)
            if file_path.exists():
                try:
                    os.remove(file_path)
                except OSError as e:
                    logger.warning(f"Could not remove physical file {file_path}: {e}")

        await db.execute(
            text("DELETE FROM analysis.analysis_jobs WHERE evidence_id IN (SELECT id FROM core.evidence WHERE case_id = :case_id)"),
            {"case_id": str(case_id)},
        )
        await db.execute(text("DELETE FROM core.evidence WHERE case_id = :case_id"), {"case_id": str(case_id)})

        result = await db.execute(text("DELETE FROM core.cases WHERE id = :id RETURNING id"), {"id": str(case_id)})
        row = result.fetchone()
        if not row:
            await db.rollback()
            raise HTTPException(status_code=404, detail="Case not found")

        await db.execute(
            text("""
                INSERT INTO core.audit_events (id, resource_id, action, created_at, performed_by)
                VALUES (:id, :resource_id, 'CASE_DELETED', :created_at, :performed_by)
            """),
            {
                "id": str(uuid.uuid4()),
                "resource_id": str(case_id),
                "created_at": datetime.now(timezone.utc),
                "performed_by": "SYSTEM",
            },
        )
        await db.commit()

        return {"status": "success", "message": f"Case and {len(evidence_rows)} evidence item(s) deleted"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete case from PostgreSQL: {str(e)}")
