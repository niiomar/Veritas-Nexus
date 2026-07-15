import asyncio
import logging
import json
import urllib.request
import requests
import os
from sqlalchemy import select, text
from infrastructure.persistence.database import async_session_maker
from infrastructure.persistence.models import AnalysisJobORM, EvidenceORM

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NSB-Platform-Worker")

VIT_CORE_URL = os.getenv("VIT_CORE_URL", "http://host.docker.internal:8001/api/v1/analyze")
VIT_CORE_API_KEY = os.getenv("VIT_CORE_API_KEY", "vitcore_forensics_secure_token_2026")
C2PA_URL = os.getenv("C2PA_URL", "http://host.docker.internal:8002/api/v1/verify") 
C2PA_API_KEY = os.getenv("C2PA_API_KEY", "IUHEWRUHIJKLSBXBMNM-XHXBNV9885IKDUF")

def call_vit_core_microservice(file_path: str) -> float:
    logger.info(f"Uploading asset to ViT-CORE engine at {VIT_CORE_URL}...")
    headers = { "X-API-KEY": VIT_CORE_API_KEY, "accept": "application/json" }
    try:
        with open(file_path, "rb") as f:
            files = {"file": (os.path.basename(file_path), f)}
            response = requests.post(VIT_CORE_URL, files=files, headers=headers, params={"explain": "false"}, timeout=120)
        response.raise_for_status()
        return float(response.json()["probability"])
    except Exception as e:
        logger.error(f"ViT-CORE bypassed or offline: {str(e)}")
        raise e

def verify_c2pa_provenance(file_path: str) -> dict:
    logger.info(f"Uploading asset to C2PA-Veritas engine at {C2PA_URL}...")
    headers = { "X-API-KEY": C2PA_API_KEY, "accept": "application/json" }
    
    try:
        with open(file_path, "rb") as f:
            files = {"file": (os.path.basename(file_path), f)}
            response = requests.post(C2PA_URL, files=files, headers=headers, timeout=30)
            
        response.raise_for_status()
        data = response.json()
        
        report_status = data.get("status")
        is_signed = report_status not in ["NO_MANIFEST", "UNSIGNED", None]
        
        if not is_signed:
            return {
                "is_signed": False, "status": "UNSIGNED", "raw_status": "No manifest detected",
                "issuer": None, "algorithm": None, "timestamp": None, "manifest_history": []
            }

        raw_store = data.get("raw_manifest_json") or data
        active_urn = raw_store.get("active_manifest")
        active_mdata = raw_store.get("manifests", {}).get(active_urn, {}) if active_urn else {}
        
        sig_info = active_mdata.get("signature_info", {})
        issuer = sig_info.get("issuer", "Unknown Issuer")
        alg = sig_info.get("alg", "Unknown Algorithm")
        timestamp = sig_info.get("time", "--")
        
        cgi = active_mdata.get("claim_generator_info", [])
        claim_generator = cgi[0].get("name", "Unknown Source") if cgi else active_mdata.get("claim_generator", "Unknown Source")
        
        history = []
        
        for assertion in active_mdata.get("assertions", []):
            if "c2pa.actions" in assertion.get("label", ""):
                for act in assertion.get("data", {}).get("actions", []):
                    agent = act.get("softwareAgent", {})
                    agent_name = agent.get("name") if isinstance(agent, dict) else str(agent) if agent else claim_generator
                    act_name = act.get("action", "Unknown").split(".")[-1].title()
                    
                    history.append({
                        "action": act_name,
                        "agent": agent_name,
                        "timestamp": act.get("when", timestamp),
                        "description": act.get("digitalSourceType", "Asset event recorded.").split("/")[-1]
                    })
                    
        history.append({
            "action": "Signed",
            "agent": issuer,
            "timestamp": timestamp,
            "description": f"Cryptographic signature applied via {alg}."
        })
        
        history.append({
            "action": "Verified",
            "agent": "C2PA Veritas",
            "timestamp": "Present",
            "description": "Ledger validation complete."
        })

        return {
            "is_signed": True,
            "status": report_status if report_status in ["VALID", "PARTIAL", "INVALID"] else "VALID",
            "raw_status": data.get("validation_state", "Valid"),
            "issuer": issuer,
            "algorithm": alg,
            "timestamp": timestamp,
            "manifest_history": history
        }
    except Exception as e:
        logger.warning(f"C2PA engine fetch failed: {str(e)}")
        return {
            "is_signed": False, "status": "UNSIGNED", "raw_status": "Engine Offline",
            "issuer": None, "algorithm": None, "timestamp": None, "manifest_history": []
        }

async def execute_correlation_engine(job_id: str, evidence_id: str, session):
    logger.info(f"[JOB {job_id}] Initiating Correlation Engine for Evidence {evidence_id}...")
    stmt = select(EvidenceORM).where(EvidenceORM.id == evidence_id)
    evidence_record = (await session.execute(stmt)).scalar_one_or_none()
    if not evidence_record: raise ValueError("Evidence record not found.")
    
    file_path = evidence_record.storage_uri
    
    metadata = evidence_record.metadata_dict or {}
    use_vit = metadata.get("use_vit", True)
    use_c2pa = metadata.get("use_c2pa", True)

    if use_vit:
        try:
            real_probability = await asyncio.to_thread(call_vit_core_microservice, file_path)
        except Exception:
            real_probability = None 
    else:
        logger.info(f"[JOB {job_id}] ViT-CORE bypassed by user preference.")
        real_probability = None
        
    if use_c2pa:
        c2pa_data = await asyncio.to_thread(verify_c2pa_provenance, file_path)
    else:
        logger.info(f"[JOB {job_id}] C2PA Verify bypassed by user preference.")
        c2pa_data = {
            "is_signed": False, "status": "UNSIGNED", "raw_status": "Bypassed by User",
            "issuer": None, "algorithm": None, "timestamp": None, "manifest_history": []
        }
    
    # 3. DYNAMIC POLICY MATRIX (Fixed Logic)
    if real_probability is None:
        if c2pa_data["is_signed"] and c2pa_data["status"] == "VALID":
            disposition = "TRUSTED - Verified via Cryptographic Provenance (Neural Engine Bypassed)."
            status_flag = "VERIFIED"
        elif c2pa_data["is_signed"]:
            disposition = "CONFLICT - Cryptographic signature present but failed validation."
            status_flag = "CONFLICT"
        else:
            disposition = "UNKNOWN - No signature found and Neural Engine bypassed/offline."
            status_flag = "UNKNOWN"
    else:
        if real_probability < 0.15:
            if c2pa_data["is_signed"] and c2pa_data["status"] == "VALID":
                disposition = "ABSOLUTE TRUST - Cryptographic provenance and neural consensus achieved."
                status_flag = "VERIFIED"
            elif c2pa_data["is_signed"]:
                disposition = "WARNING - Neural trust achieved, but cryptographic signature is invalid/broken."
                status_flag = "CONFLICT"
            else:
                disposition = "HIGH TRUST - No synthetic artifacts detected (Unsigned Asset)."
                status_flag = "VERIFIED"
        elif real_probability < 0.70:
            if c2pa_data["is_signed"] and c2pa_data["status"] == "VALID":
                disposition = "CRITICAL CONFLICT - Valid cryptography but neural anomalies detected. Possible deepfake injection."
                status_flag = "CONFLICT"
            else:
                disposition = "REVIEW REQUIRED - Minor synthetic anomalies detected."
                status_flag = "CONFLICT"
        else:
            disposition = "QUARANTINE - Severe synthetic manipulation detected."
            status_flag = "CRITICAL THREAT"

    report_data = {
        "deepfake_probability": real_probability,
        "c2pa_data": c2pa_data,
        "platform_status": status_flag,
        "disposition": disposition,
        "threat_summary": "Intelligence assessment complete." 
    }
    
    update_stmt = text("UPDATE analysis.analysis_jobs SET ai_report = :report, status = 'COMPLETED' WHERE id = :job_id")
    await session.execute(update_stmt, {"report": json.dumps(report_data), "job_id": job_id})
    logger.info(f"[JOB {job_id}] Correlation Assessment complete.")

async def poll_analysis_jobs():
    logger.info("NSB Intelligence Worker is online...")
    while True:
        try:
            async with async_session_maker() as session:
                stmt = select(AnalysisJobORM).where(AnalysisJobORM.status == "PENDING").limit(1)
                result = await session.execute(stmt)
                job = result.scalar_one_or_none()

                if job:
                    job.status = "PROCESSING"
                    await session.commit()
                    await execute_correlation_engine(str(job.id), str(job.evidence_id), session)
                    await session.commit()
                else:
                    await asyncio.sleep(3)
        except Exception as e:
            logger.error(f"Worker Error: {str(e)}")
            await asyncio.sleep(5)
