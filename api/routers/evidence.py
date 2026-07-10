import uuid
import shutil
import hashlib
import json
from pathlib import Path
from sqlalchemy import text
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_db_session as get_db
from infrastructure.persistence.models import EvidenceORM, AnalysisJobORM, AuditEventORM

router = APIRouter(prefix="/api/v1/evidence", tags=["Evidence"])
STORAGE_VAULT = Path("/vault") 

@router.post("/")
async def ingest_evidence(
    case_id: uuid.UUID = Form(...),
    uploaded_by: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    try:
        STORAGE_VAULT.mkdir(parents=True, exist_ok=True)
        evidence_id = uuid.uuid4()
        
        safe_filename = "".join(c for c in file.filename if c.isalnum() or c in "._-")
        storage_filename = f"{evidence_id}_{safe_filename}"
        file_path = STORAGE_VAULT / storage_filename

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        file_hash = sha256_hash.hexdigest()

        now = datetime.now(timezone.utc)
        
        evidence_record = EvidenceORM(
            id=evidence_id,
            case_id=case_id,
            filename=storage_filename,
            original_filename=file.filename,
            sha256=file_hash,
            storage_uri=str(file_path),
            uploaded_by=uploaded_by,
            uploaded_at=now,
            metadata_dict={"content_type": file.content_type}
        )
        db.add(evidence_record)
        await db.flush()

        analysis_job = AnalysisJobORM(
            id=uuid.uuid4(),
            evidence_id=evidence_id,
            status="PENDING",
            created_at=now
        )
        db.add(analysis_job)

        audit_event = AuditEventORM(
            id=uuid.uuid4(),
            resource_id=evidence_id,
            action="EVIDENCE_INGESTED",
            created_at=now,
            performed_by=uploaded_by
        )
        db.add(audit_event)

        await db.commit()

        return {
            "status": "success",
            "evidence_id": str(evidence_id),
            "sha256": file_hash,
            "message": "Evidence secured and queued for forensic analysis."
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@router.get("/")
async def list_evidence(db: AsyncSession = Depends(get_db)):
    try:
        # Bypassing the ORM limitation with a highly efficient raw SQL join
        stmt = text("""
            SELECT e.id, e.original_filename, e.sha256, e.uploaded_at, j.status, j.ai_report
            FROM core.evidence e
            JOIN analysis.analysis_jobs j ON e.id = j.evidence_id
            ORDER BY e.uploaded_at DESC
        """)
        result = await db.execute(stmt)
        records = result.mappings().all()

        evidence_list = []
        for row in records:
            # Safely handle the JSON payload whether asyncpg returns it as a dict or a string
            report = row.get("ai_report")
            if isinstance(report, str):
                report = json.loads(report)

            evidence_list.append({
                "id": str(row["id"]),
                "filename": row["original_filename"],
                "sha256": row["sha256"],
                "status": row["status"],
                "uploaded_at": row["uploaded_at"].isoformat(),
                "ai_report": report
            })

        return {"evidence": evidence_list}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch library: {str(e)}")
