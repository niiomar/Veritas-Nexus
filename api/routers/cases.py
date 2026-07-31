import uuid
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from api.dependencies import get_db_session, get_current_user
from infrastructure.persistence.models import UserORM

router = APIRouter()

class CaseRequest(BaseModel):
    title: str
    alias: str | None = None
    priority: str = "MEDIUM"
    analyst: str | None = None
    description: str | None = None

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_case(
    request: CaseRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: UserORM = Depends(get_current_user),
):
    """Opens a new investigation case."""
    now = datetime.now(timezone.utc)
    case_id = uuid.uuid4()
    # Minute-resolution alone collides under any real concurrent load (two
    # analysts, a double-click, a batch import) and 500s on the unique
    # constraint - the random suffix keeps the human-readable timestamp
    # while making collisions practically impossible.
    case_number = f"NSB-{now.year}-{now.strftime('%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
    # created_by/audit trail use the authenticated user's identity, not the
    # client-supplied `analyst` display field (which is just case metadata -
    # who the case is assigned to - and shouldn't be trusted for accountability).
    actor = current_user.email

    try:
        stmt = text("""
            INSERT INTO core.cases (id, case_number, title, alias, description, priority, analyst, status, created_by, created_at, updated_at, tags)
            VALUES (:id, :case_number, :title, :alias, :description, :priority, :analyst, 'OPEN', :created_by, :created_at, :updated_at, '{}')
            RETURNING id, case_number, title, alias, priority, analyst, description, created_at
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
    browser or a second device. Soft-deleted cases (see delete_case) are
    excluded until restored."""
    try:
        stmt = text("""
            SELECT id, title, alias, analyst, priority, created_at
            FROM core.cases
            WHERE deleted_at IS NULL
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


@router.put("/{case_id}")
async def update_case(
    case_id: UUID,
    request: CaseRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: UserORM = Depends(get_current_user),
):
    """Updates an existing case."""
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


@router.delete("/{case_id}")
async def delete_case(
    case_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: UserORM = Depends(get_current_user),
):
    """Soft-deletes a case and cascades to its (not-already-deleted)
    evidence: both just get deleted_at stamped, so they disappear from
    listings immediately but can be undone via restore_case within
    SOFT_DELETE_GRACE_PERIOD. Physical files and DB rows aren't actually
    removed until api/worker.py's purge sweep runs after that window -
    deletion used to be immediate and irreversible, with no recovery path
    for a misclick."""
    try:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            text("UPDATE core.cases SET deleted_at = :now WHERE id = :id AND deleted_at IS NULL RETURNING id"),
            {"id": str(case_id), "now": now},
        )
        row = result.fetchone()
        if not row:
            await db.rollback()
            raise HTTPException(status_code=404, detail="Case not found")

        evidence_result = await db.execute(
            text("UPDATE core.evidence SET deleted_at = :now WHERE case_id = :case_id AND deleted_at IS NULL RETURNING id"),
            {"case_id": str(case_id), "now": now},
        )
        evidence_count = len(evidence_result.fetchall())

        await db.execute(
            text("""
                INSERT INTO core.audit_events (id, resource_id, action, created_at, performed_by)
                VALUES (:id, :resource_id, 'CASE_DELETED', :created_at, :performed_by)
            """),
            {
                "id": str(uuid.uuid4()),
                "resource_id": str(case_id),
                "created_at": now,
                "performed_by": current_user.email,
            },
        )
        await db.commit()

        return {"status": "success", "message": f"Case and {evidence_count} evidence item(s) marked for deletion"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete case from PostgreSQL: {str(e)}")


@router.post("/{case_id}/restore")
async def restore_case(
    case_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: UserORM = Depends(get_current_user),
):
    """Undoes delete_case within the grace period: clears deleted_at on the
    case and on any of its evidence that was soft-deleted alongside it.
    Returns 404 once the purge sweep has already physically removed it."""
    try:
        result = await db.execute(
            text("UPDATE core.cases SET deleted_at = NULL WHERE id = :id AND deleted_at IS NOT NULL RETURNING id"),
            {"id": str(case_id)},
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Case not found or not deleted")

        await db.execute(
            text("UPDATE core.evidence SET deleted_at = NULL WHERE case_id = :case_id AND deleted_at IS NOT NULL"),
            {"case_id": str(case_id)},
        )
        await db.commit()

        return {"status": "success", "message": "Case restored"}

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to restore case in PostgreSQL: {str(e)}")
