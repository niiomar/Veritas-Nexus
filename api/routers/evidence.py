import os
import uuid
import shutil
import hashlib
import json
import base64
import requests
import logging
import asyncio
import traceback
from pathlib import Path
from sqlalchemy import text
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_db_session as get_db
from infrastructure.persistence.models import EvidenceORM, AnalysisJobORM, AuditEventORM

# Import the new EXIF Engine
from api.services.exif_core import ExifCoreEngine

# Setup logging
logger = logging.getLogger("EvidenceRouter")

router = APIRouter(prefix="/api/v1/evidence", tags=["Evidence"])
STORAGE_VAULT = Path("/vault") 

# Read microservice credentials
VIT_CORE_URL = os.getenv("VIT_CORE_URL", "http://host.docker.internal:8001/api/v1/analyze")
# UPDATED: Replaced the incorrect C2PA token with the correct ViT-CORE token
VIT_CORE_API_KEY = os.getenv("VIT_CORE_API_KEY", "vitcore_forensics_secure_token_2026")


@router.post("/")
async def ingest_evidence(
    case_id: uuid.UUID = Form(...),
    uploaded_by: str = Form(...),
    file: UploadFile = File(...),
    use_vit: bool = Form(True),    
    use_c2pa: bool = Form(True),   
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

        # RUN METADATA EXTRACTION IMMEDIATELY ON INGEST
        exif_data = ExifCoreEngine.extract_metadata(str(file_path))

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
            metadata_dict={
                "content_type": file.content_type,
                "use_vit": use_vit,
                "use_c2pa": use_c2pa,
                "exif": exif_data  # Storing the EXIF profile
            }
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
        # ADDED: e.metadata_dict to the SQL SELECT query
        stmt = text("""
            SELECT e.id, e.case_id, e.original_filename, e.sha256, e.uploaded_at, e.metadata_dict, j.status, j.ai_report
            FROM core.evidence e
            JOIN analysis.analysis_jobs j ON e.id = j.evidence_id
            ORDER BY e.uploaded_at DESC
        """)
        result = await db.execute(stmt)
        records = result.mappings().all()

        evidence_list = []
        for row in records:
            report = row.get("ai_report")
            if isinstance(report, str):
                report = json.loads(report)

            evidence_list.append({
                "id": str(row["id"]),
                "case_id": str(row["case_id"]),
                "filename": row["original_filename"],
                "sha256": row["sha256"],
                "status": row["status"],
                "uploaded_at": row["uploaded_at"].isoformat(),
                "ai_report": report,
                "metadata_dict": row.get("metadata_dict", {}) # Append EXIF to payload
            })

        return {"evidence": evidence_list}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch library: {str(e)}")


@router.get("/{evidence_id}/download")
async def get_evidence_file(evidence_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Serves the raw physical file for the SOURCE tab."""
    try:
        stmt = text("SELECT storage_uri FROM core.evidence WHERE id = :id")
        result = await db.execute(stmt, {"id": str(evidence_id)})
        record = result.fetchone()

        if not record or not Path(record.storage_uri).exists():
            raise HTTPException(status_code=404, detail="Physical file missing from storage vault")

        return FileResponse(path=Path(record.storage_uri))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve file: {str(e)}")


def fetch_visual_from_microservice(file_path: str, visual_type: str) -> bytes:
    """Extracts specific visual layers (heatmap, patches, attention) from the ViT-CORE."""
    headers = { "X-API-KEY": VIT_CORE_API_KEY, "accept": "application/json" }
    
    try:
        with open(file_path, "rb") as f:
            files = {"file": (os.path.basename(file_path), f)}
            response = requests.post(
                VIT_CORE_URL, 
                files=files, 
                headers=headers, 
                params={"explain": "true"}, 
                timeout=45
            )
        
        if response.status_code != 200:
            raise RuntimeError(f"ViT-CORE rejected request: HTTP {response.status_code} - {response.text}")
        
        data = response.json()
        maps = data.get("explainability_maps", [])
        raw_b64 = None
        
        if isinstance(maps, list) and len(maps) > 0:
            frame_visuals = maps[0]
            if isinstance(frame_visuals, dict):
                raw_b64 = frame_visuals.get(visual_type)
            elif isinstance(frame_visuals, str):
                raw_b64 = frame_visuals 
        elif isinstance(maps, dict):
            raw_b64 = maps.get(visual_type)
            
        if not raw_b64 or not isinstance(raw_b64, str):
            raise RuntimeError(f"ViT-CORE returned missing or invalid '{visual_type}' data.")
            
        raw_b64 = raw_b64.replace("data:image/jpeg;base64,", "").replace("data:image/png;base64,", "")
        return base64.b64decode(raw_b64)
        
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Network error communicating with ViT-CORE: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"Proxy decoding failed: {repr(e)}")


# ---------------------------------------------------------
# DYNAMIC PROXY ROUTER HANDLERS
# ---------------------------------------------------------

async def _proxy_visual(evidence_id: uuid.UUID, visual_type: str, db: AsyncSession):
    """Core logic to fetch physical file paths and route them to the ViT microservice."""
    try:
        stmt = text("SELECT storage_uri FROM core.evidence WHERE id = :id")
        result = await db.execute(stmt, {"id": str(evidence_id)})
        record = result.fetchone()

        if not record or not Path(record.storage_uri).exists():
            raise HTTPException(status_code=404, detail="Source image not found")

        image_bytes = await asyncio.to_thread(fetch_visual_from_microservice, str(record.storage_uri), visual_type)
        return Response(content=image_bytes, media_type="image/jpeg")

    except RuntimeError as re:
        logger.error(f"Microservice Error: {str(re)}")
        raise HTTPException(status_code=502, detail=str(re))
    except Exception as e:
        logger.error(f"Endpoint Error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal server error during proxy.")


@router.get("/{evidence_id}/heatmap", tags=["Evidence", "ViT-CORE"])
async def get_heatmap(evidence_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await _proxy_visual(evidence_id, "heatmap", db)


@router.get("/{evidence_id}/patches", tags=["Evidence", "ViT-CORE"])
async def get_patches(evidence_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await _proxy_visual(evidence_id, "patches", db)


@router.get("/{evidence_id}/attention", tags=["Evidence", "ViT-CORE"])
async def get_attention(evidence_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await _proxy_visual(evidence_id, "attention", db)


@router.delete("/{evidence_id}", tags=["Evidence"])
async def delete_evidence(evidence_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Deletes evidence record, child dependencies, and the physical file."""
    try:
        stmt = text("SELECT storage_uri FROM core.evidence WHERE id = :id")
        result = await db.execute(stmt, {"id": str(evidence_id)})
        record = result.fetchone()

        if record:
            file_path = Path(record.storage_uri)
            if file_path.exists():
                try:
                    os.remove(file_path)
                except OSError as e:
                    logger.warning(f"Could not remove physical file {file_path}: {e}")

        await db.execute(text("DELETE FROM analysis.analysis_jobs WHERE evidence_id = :id"), {"id": str(evidence_id)})
        await db.execute(text("DELETE FROM core.evidence WHERE id = :id"), {"id": str(evidence_id)})
        await db.commit()
        
        return {"status": "success", "message": "Evidence completely purged."}
    except Exception as e:
        await db.rollback()
        logger.error(f"Deletion failed for {evidence_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
