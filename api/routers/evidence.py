import uuid
import shutil
import hashlib
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

# Assuming you have a standard database dependency
from api.dependencies import get_db 
from infrastructure.persistence.models import EvidenceORM, AnalysisJobORM, AuditEventORM

router = APIRouter(prefix="/api/v1/evidence", tags=["Evidence"])

# This path corresponds to your nexus_storage_vault mount in docker-compose
STORAGE_VAULT = Path("/vault") 

@router.post("/")
async def ingest_evidence(
    case_id: uuid.UUID = Form(...),
    uploaded_by: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    try:
        # 1. Storage Setup
        STORAGE_VAULT.mkdir(parents=True, exist_ok=True)
        evidence_id = uuid.uuid4()
        
        # Sanitize and create a unique storage path
        safe_filename = "".join(c for c in file.filename if c.isalnum() or c in "._-")
        storage_filename = f"{evidence_id}_{safe_filename}"
        file_path = STORAGE_VAULT / storage_filename

        # 2. Save Physical File to nexus_storage_vault
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 3. Cryptographic Hashing (SHA-256 chunked for memory safety on large files)
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        file_hash = sha256_hash.hexdigest()

        # 4. Database Persistence
        now = datetime.now(timezone.utc)
        
        # A. Save to core.evidence
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

        # B. Trigger Analysis (Queue in analysis_jobs)
        analysis_job = AnalysisJobORM(
            id=uuid.uuid4(),
            evidence_id=evidence_id,
            status="PENDING",
            created_at=now
        )
        db.add(analysis_job)

        # C. Audit Trail (Maintain strict chain of custody)
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