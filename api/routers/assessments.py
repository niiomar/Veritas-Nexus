import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_db_session, get_current_user
from infrastructure.persistence.models import UserORM

router = APIRouter()


@router.get("/{evidence_id}")
async def get_assessment(
    evidence_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: UserORM = Depends(get_current_user),
):
    """Retrieves the synthesized Authenticity Assessment for a piece of
    evidence - the same ai_report api/worker.py computes via
    api/services/assessment_engine.py and already returns inline from
    evidence.list_evidence. This gives any client a way to fetch just one
    assessment without pulling the whole library."""
    stmt = text("""
        SELECT j.status, j.ai_report
        FROM core.evidence e
        JOIN analysis.analysis_jobs j ON e.id = j.evidence_id
        WHERE e.id = :id AND e.deleted_at IS NULL
    """)
    result = await db.execute(stmt, {"id": str(evidence_id)})
    row = result.mappings().fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Evidence not found")

    report = row["ai_report"]
    if isinstance(report, str):
        report = json.loads(report)

    if row["status"] != "COMPLETED" or report is None:
        raise HTTPException(status_code=409, detail=f"Assessment not yet available (job status: {row['status']}).")

    return report
