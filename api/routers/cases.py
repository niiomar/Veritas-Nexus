import logging
import uuid
from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from api.constants import SOFT_DELETE_GRACE_PERIOD
from api.dependencies import get_db_session, get_current_user
from infrastructure.persistence.models import UserORM

logger = logging.getLogger("CasesRouter")
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
    except Exception:
        await db.rollback()
        logger.exception("Failed to create case")
        raise HTTPException(status_code=500, detail="Failed to create case.")

    row = result.mappings().fetchone()
    return {"status": "success", "case_id": str(case_id), **dict(row)}

@router.get("")
async def list_cases(
    db: AsyncSession = Depends(get_db_session),
    current_user: UserORM = Depends(get_current_user),
    deleted_only: bool = False,
):
    """Lists all cases visible to any authenticated analyst (shared team
    caseload - see get_case/update_case/delete_case for the ownership check
    that gates mutations). Cases are server-authoritative - the frontend
    used to cache them in localStorage only, which meant they vanished on a
    cleared browser or a second device. Soft-deleted cases (see delete_case)
    are excluded by default; pass deleted_only=true to list them instead,
    for a "recently deleted" recovery view."""
    try:
        deleted_clause = "deleted_at IS NOT NULL" if deleted_only else "deleted_at IS NULL"
        order_clause = "deleted_at DESC" if deleted_only else "created_at DESC"
        stmt = text(f"""
            SELECT id, title, alias, analyst, priority, created_by, created_at, deleted_at
            FROM core.cases
            WHERE {deleted_clause}
            ORDER BY {order_clause}
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
                    "created_by": row["created_by"],
                    "created": row["created_at"].date().isoformat(),
                    **(
                        {
                            "deleted_at": row["deleted_at"].isoformat(),
                            "purge_at": (row["deleted_at"] + SOFT_DELETE_GRACE_PERIOD).isoformat(),
                        }
                        if deleted_only
                        else {}
                    ),
                }
                for row in rows
            ]
        }
    except Exception:
        logger.exception("Failed to fetch cases")
        raise HTTPException(status_code=500, detail="Failed to fetch cases.")


@router.get("/{case_id}")
async def get_case(
    case_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: UserORM = Depends(get_current_user),
):
    """Fetches a single case. Any authenticated analyst may view any case
    (shared caseload) - only the creator may mutate it (see update/delete)."""
    stmt = text("""
        SELECT id, case_number, title, alias, analyst, priority, status, description, created_by, created_at, updated_at
        FROM core.cases
        WHERE id = :id AND deleted_at IS NULL
    """)
    result = await db.execute(stmt, {"id": str(case_id)})
    row = result.mappings().fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Case not found")

    return {
        "id": str(row["id"]),
        "case_number": row["case_number"],
        "name": row["title"],
        "alias": row["alias"] or "",
        "analyst": row["analyst"] or "",
        "priority": row["priority"],
        "status": row["status"],
        "description": row["description"] or "",
        "created_by": row["created_by"],
        "created": row["created_at"].date().isoformat(),
        "updated_at": row["updated_at"].isoformat(),
    }


async def _require_case_owner(db: AsyncSession, case_id: UUID, current_user: UserORM) -> None:
    """Shared team visibility means any analyst can read a case, but only
    its creator may mutate it - without this, any registered account could
    retitle, delete, or restore any other analyst's investigation. Doesn't
    filter on deleted_at - existence + ownership only, since this guards
    update/delete/restore alike and each of those enforces its own
    deleted_at state transition afterwards."""
    result = await db.execute(
        text("SELECT created_by FROM core.cases WHERE id = :id"),
        {"id": str(case_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Case not found")
    if row.created_by != current_user.email:
        raise HTTPException(status_code=403, detail="Only the case's creator may perform this action.")


@router.put("/{case_id}")
async def update_case(
    case_id: UUID,
    request: CaseRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: UserORM = Depends(get_current_user),
):
    """Updates an existing case. Only the case's creator may do so (see
    _require_case_owner)."""
    await _require_case_owner(db, case_id, current_user)
    try:
        stmt = text("""
            UPDATE core.cases
            SET title = :title, alias = :alias, priority = :priority, analyst = :analyst, description = :description, updated_at = :updated_at
            WHERE id = :id AND deleted_at IS NULL
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
    except Exception:
        await db.rollback()
        logger.exception(f"Failed to update case {case_id}")
        raise HTTPException(status_code=500, detail="Failed to update case.")


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
    for a misclick. Only the case's creator may delete it (see
    _require_case_owner)."""
    await _require_case_owner(db, case_id, current_user)
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
    except Exception:
        await db.rollback()
        logger.exception(f"Failed to delete case {case_id}")
        raise HTTPException(status_code=500, detail="Failed to delete case.")


@router.post("/{case_id}/restore")
async def restore_case(
    case_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: UserORM = Depends(get_current_user),
):
    """Undoes delete_case within the grace period: clears deleted_at on the
    case and on any of its evidence that was soft-deleted alongside it.
    Returns 404 once the purge sweep has already physically removed it.
    Only the case's creator may restore it (see _require_case_owner)."""
    await _require_case_owner(db, case_id, current_user)
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
    except Exception:
        await db.rollback()
        logger.exception(f"Failed to restore case {case_id}")
        raise HTTPException(status_code=500, detail="Failed to restore case.")
