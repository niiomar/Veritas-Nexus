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
from dotenv import load_dotenv
from sqlalchemy import text
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from api.constants import SOFT_DELETE_GRACE_PERIOD
from api.dependencies import get_db_session as get_db, get_current_user
from infrastructure.persistence.models import EvidenceORM, AnalysisJobORM, AuditEventORM, UserORM

# Import the new EXIF Engine
from api.services.exif_core import ExifCoreEngine

load_dotenv()

# Setup logging
logger = logging.getLogger("EvidenceRouter")

router = APIRouter(prefix="/api/v1/evidence", tags=["Evidence"])
# Must match the docker-compose "nexus_storage" volume's mount point
# (/app/storage_vault) - a bare "/vault" silently wrote into the container's
# ephemeral layer instead of the persisted volume, and required root to
# mkdir at the filesystem root (which broke on non-root CI runners).
STORAGE_VAULT = Path(os.getenv("EVIDENCE_VAULT_PATH", "/app/storage_vault"))

# Read microservice credentials
VIT_CORE_URL = os.getenv("VIT_CORE_URL", "http://host.docker.internal:8001/api/v1/analyze")
VIT_CORE_API_KEY = os.getenv("VIT_CORE_API_KEY")
if not VIT_CORE_API_KEY:
    logger.warning("VIT_CORE_API_KEY is not set - requests to the ViT-CORE engine will fail authentication.")


def _write_and_hash_evidence(file_obj, file_path: Path) -> str:
    """Runs on a worker thread (see asyncio.to_thread below) - the disk
    write and full-file SHA-256 read used to run inline in the async
    handler, blocking the event loop (and every other concurrent request)
    for the duration of the upload."""
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file_obj, buffer)

    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


@router.post("/")
async def ingest_evidence(
    case_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    use_vit: bool = Form(True),
    use_c2pa: bool = Form(True),
    use_audio: bool = Form(True),
    db: AsyncSession = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file has no filename.")

    try:
        STORAGE_VAULT.mkdir(parents=True, exist_ok=True)
        evidence_id = uuid.uuid4()

        safe_filename = "".join(c for c in file.filename if c.isalnum() or c in "._-")
        storage_filename = f"{evidence_id}_{safe_filename}"
        file_path = STORAGE_VAULT / storage_filename

        file_hash = await asyncio.to_thread(_write_and_hash_evidence, file.file, file_path)

        # RUN METADATA EXTRACTION IMMEDIATELY ON INGEST
        # Offloaded to a worker thread: this shells out to exiftool and runs
        # OpenCV ELA analysis, both of which are blocking calls that would
        # otherwise stall the whole asyncio event loop (and every other
        # concurrent request) for the duration of the upload.
        exif_data = await asyncio.to_thread(ExifCoreEngine.extract_metadata, str(file_path))

        now = datetime.now(timezone.utc)
        
        evidence_record = EvidenceORM(
            id=evidence_id,
            case_id=case_id,
            filename=storage_filename,
            original_filename=file.filename,
            sha256=file_hash,
            storage_uri=str(file_path),
            # Server-authoritative, like cases.py's created_by - a client-
            # supplied uploader field is spoofable and undermines chain of
            # custody.
            uploaded_by=current_user.email,
            uploaded_at=now,
            metadata_dict={
                "content_type": file.content_type,
                "use_vit": use_vit,
                "use_c2pa": use_c2pa,
                "use_audio": use_audio,
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
            performed_by=current_user.email
        )
        db.add(audit_event)

        await db.commit()

        return {
            "status": "success",
            "evidence_id": str(evidence_id),
            "sha256": file_hash,
            "message": "Evidence secured and queued for forensic analysis."
        }

    except Exception:
        await db.rollback()
        logger.exception("Evidence ingestion failed")
        raise HTTPException(status_code=500, detail="Ingestion failed.")


@router.get("/")
async def list_evidence(
    db: AsyncSession = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
    case_id: uuid.UUID | None = None,
    limit: int = 500,
    offset: int = 0,
    deleted_only: bool = False,
):
    """Lists evidence, newest first. Unbounded before this - fine at demo
    scale, but nothing stopped a single query from pulling back the entire
    ledger as it grows. `limit`/`offset` bound that; `case_id` lets a caller
    scope to one case's evidence without pulling the whole library (the
    frontend still fetches everything today, since Sidebar's per-case stat
    counts need visibility across all cases at once - narrowing that is a
    frontend data-flow change of its own, not a query-shape one). Pass
    deleted_only=true to list soft-deleted evidence instead, for a
    "recently deleted" recovery view."""
    limit = max(1, min(limit, 2000))
    offset = max(0, offset)
    try:
        where_clauses = ["e.deleted_at IS NOT NULL" if deleted_only else "e.deleted_at IS NULL"]
        params: dict = {"limit": limit, "offset": offset}
        if case_id is not None:
            where_clauses.append("e.case_id = :case_id")
            params["case_id"] = str(case_id)
        where_sql = " AND ".join(where_clauses)
        order_sql = "e.deleted_at DESC" if deleted_only else "e.uploaded_at DESC"

        total = (await db.execute(
            text(f"SELECT COUNT(*) FROM core.evidence e WHERE {where_sql}"), params
        )).scalar_one()

        stmt = text(f"""
            SELECT e.id, e.case_id, e.original_filename, e.sha256, e.uploaded_by, e.uploaded_at, e.deleted_at, e.metadata_dict, j.status, j.ai_report
            FROM core.evidence e
            JOIN analysis.analysis_jobs j ON e.id = j.evidence_id
            WHERE {where_sql}
            ORDER BY {order_sql}
            LIMIT :limit OFFSET :offset
        """)
        result = await db.execute(stmt, params)
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
                "uploaded_by": row["uploaded_by"],
                "status": row["status"],
                "uploaded_at": row["uploaded_at"].isoformat(),
                "ai_report": report,
                "metadata_dict": row.get("metadata_dict", {}), # Append EXIF to payload
                **(
                    {
                        "deleted_at": row["deleted_at"].isoformat(),
                        "purge_at": (row["deleted_at"] + SOFT_DELETE_GRACE_PERIOD).isoformat(),
                    }
                    if deleted_only
                    else {}
                ),
            })

        return {"evidence": evidence_list, "total": total, "limit": limit, "offset": offset}

    except Exception:
        logger.exception("Failed to fetch evidence library")
        raise HTTPException(status_code=500, detail="Failed to fetch library.")

@router.get("/{evidence_id}/download")
async def get_evidence_file(
    evidence_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """Serves the raw physical file for the SOURCE tab."""
    try:
        stmt = text("SELECT storage_uri FROM core.evidence WHERE id = :id AND deleted_at IS NULL")
        result = await db.execute(stmt, {"id": str(evidence_id)})
        record = result.fetchone()

        if not record or not Path(record.storage_uri).exists():
            raise HTTPException(status_code=404, detail="Physical file missing from storage vault")

        return FileResponse(path=Path(record.storage_uri))
    except HTTPException:
        raise
    except Exception:
        logger.exception(f"Failed to retrieve evidence file {evidence_id}")
        raise HTTPException(status_code=500, detail="Failed to retrieve file.")


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
        stmt = text("SELECT storage_uri FROM core.evidence WHERE id = :id AND deleted_at IS NULL")
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
async def get_heatmap(
    evidence_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    return await _proxy_visual(evidence_id, "heatmap", db)


@router.get("/{evidence_id}/patches", tags=["Evidence", "ViT-CORE"])
async def get_patches(
    evidence_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    return await _proxy_visual(evidence_id, "patches", db)


@router.get("/{evidence_id}/attention", tags=["Evidence", "ViT-CORE"])
async def get_attention(
    evidence_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    return await _proxy_visual(evidence_id, "attention", db)


async def _require_evidence_owner(db: AsyncSession, evidence_id: uuid.UUID, current_user: UserORM) -> None:
    """Mirrors cases.py's _require_case_owner: any analyst can view evidence
    (shared caseload), but only whoever uploaded it may delete/restore it."""
    result = await db.execute(
        text("SELECT uploaded_by FROM core.evidence WHERE id = :id"),
        {"id": str(evidence_id)},
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Evidence not found")
    if row.uploaded_by != current_user.email:
        raise HTTPException(status_code=403, detail="Only the analyst who uploaded this evidence may perform this action.")


@router.delete("/{evidence_id}", tags=["Evidence"])
async def delete_evidence(
    evidence_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """Soft-deletes evidence: stamps deleted_at so it disappears from the
    ledger immediately, but the row and physical file are left alone so
    restore_evidence can undo it within SOFT_DELETE_GRACE_PERIOD. Actual
    purging (row + file) happens in api/worker.py's purge sweep - this used
    to delete the file and row immediately, with no way back from a
    misclick. Only the uploader may delete it (see _require_evidence_owner)."""
    await _require_evidence_owner(db, evidence_id, current_user)
    try:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            text("UPDATE core.evidence SET deleted_at = :now WHERE id = :id AND deleted_at IS NULL RETURNING id"),
            {"id": str(evidence_id), "now": now},
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Evidence not found")

        await db.execute(
            text("""
                INSERT INTO core.audit_events (id, resource_id, action, created_at, performed_by)
                VALUES (:id, :resource_id, 'EVIDENCE_DELETED', :created_at, :performed_by)
            """),
            {"id": str(uuid.uuid4()), "resource_id": str(evidence_id), "created_at": now, "performed_by": current_user.email},
        )
        await db.commit()
        return {"status": "success", "message": "Evidence marked for deletion."}
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        logger.exception(f"Deletion failed for evidence {evidence_id}")
        raise HTTPException(status_code=500, detail="Delete failed.")


@router.post("/{evidence_id}/restore", tags=["Evidence"])
async def restore_evidence(
    evidence_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserORM = Depends(get_current_user),
):
    """Undoes delete_evidence within the grace period. Returns 404 once the
    purge sweep has already physically removed it. Only the uploader may
    restore it (see _require_evidence_owner)."""
    await _require_evidence_owner(db, evidence_id, current_user)
    try:
        result = await db.execute(
            text("UPDATE core.evidence SET deleted_at = NULL WHERE id = :id AND deleted_at IS NOT NULL RETURNING id"),
            {"id": str(evidence_id)},
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Evidence not found or not deleted")

        await db.commit()
        return {"status": "success", "message": "Evidence restored."}
    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        logger.exception(f"Restore failed for evidence {evidence_id}")
        raise HTTPException(status_code=500, detail="Restore failed.")
