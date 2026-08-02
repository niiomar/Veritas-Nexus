import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_db_session, get_current_user
from api.services.report_service import generate_report_pdf
from infrastructure.persistence.models import ReportORM, UserORM

logger = logging.getLogger("ReportsRouter")
router = APIRouter()

# Same base as api/routers/evidence.py's STORAGE_VAULT, so reports live on
# the same persisted volume - just under their own subdirectory rather than
# mixed in with the raw evidence files.
REPORTS_VAULT = Path(os.getenv("EVIDENCE_VAULT_PATH", "/app/storage_vault")) / "reports"


@router.post("/{evidence_id}", status_code=status.HTTP_201_CREATED)
async def generate_court_report(
    evidence_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: UserORM = Depends(get_current_user),
):
    """Generates a PDF snapshot of an evidence item's authenticity
    assessment - case details, evidence provenance, and the full
    domain-by-domain trust score - for handoff outside the platform.
    Any authenticated analyst may generate one (shared caseload, like
    viewing); a fresh call always renders a new, independently
    retrievable snapshot rather than overwriting a prior one."""
    stmt = text("""
        SELECT
            c.case_number, c.title AS case_title, c.status AS case_status,
            e.original_filename, e.sha256, e.uploaded_by, e.uploaded_at,
            j.status AS job_status, j.ai_report
        FROM core.evidence e
        JOIN core.cases c ON c.id = e.case_id
        JOIN analysis.analysis_jobs j ON j.evidence_id = e.id
        WHERE e.id = :evidence_id AND e.deleted_at IS NULL
    """)
    row = (await db.execute(stmt, {"evidence_id": str(evidence_id)})).mappings().fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Evidence not found")

    ai_report = row["ai_report"]
    if isinstance(ai_report, str):
        ai_report = json.loads(ai_report)
    if row["job_status"] != "COMPLETED" or not ai_report or "assessment" not in ai_report:
        raise HTTPException(status_code=409, detail=f"Assessment not yet available (job status: {row['job_status']}).")

    report_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    try:
        pdf_bytes = generate_report_pdf(
            case={"case_number": row["case_number"], "title": row["case_title"], "status": row["case_status"]},
            evidence={
                "filename": row["original_filename"],
                "sha256": row["sha256"],
                "uploaded_by": row["uploaded_by"],
                "uploaded_at": row["uploaded_at"].isoformat(),
            },
            assessment=ai_report["assessment"],
            disposition=ai_report.get("disposition", "N/A"),
            generated_by=current_user.email,
            generated_at=now,
            report_id=str(report_id),
        )
    except Exception:
        logger.exception(f"Report rendering failed for evidence {evidence_id}")
        raise HTTPException(status_code=500, detail="Report generation failed.")

    REPORTS_VAULT.mkdir(parents=True, exist_ok=True)
    file_path = REPORTS_VAULT / f"{report_id}.pdf"
    file_path.write_bytes(pdf_bytes)

    sha256 = hashlib.sha256(pdf_bytes).hexdigest()

    db.add(ReportORM(
        id=report_id,
        evidence_id=evidence_id,
        storage_uri=str(file_path),
        sha256=sha256,
        generated_by=current_user.email,
        generated_at=now,
    ))
    await db.commit()

    return {
        "status": "success",
        "report_id": str(report_id),
        "evidence_id": str(evidence_id),
        "sha256": sha256,
        "generated_at": now.isoformat(),
    }


@router.get("/{report_id}/download")
async def download_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db_session),
    current_user: UserORM = Depends(get_current_user),
):
    """Serves a previously generated report PDF. Reports are immutable
    snapshots (no update/delete) - any authenticated analyst may fetch one,
    consistent with the shared-caseload visibility model elsewhere."""
    stmt = text("SELECT storage_uri FROM core.reports WHERE id = :id")
    row = (await db.execute(stmt, {"id": str(report_id)})).fetchone()
    if not row or not Path(row.storage_uri).exists():
        raise HTTPException(status_code=404, detail="Report not found")

    return FileResponse(path=Path(row.storage_uri), media_type="application/pdf", filename=f"veritas-nexus-report-{report_id}.pdf")
