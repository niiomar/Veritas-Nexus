import asyncio
import random
import logging
import json
import urllib.request
from sqlalchemy import select, text
from infrastructure.persistence.database import async_session_maker
from infrastructure.persistence.models import AnalysisJobORM

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("NSB-AI-Worker")

def generate_phi3_summary(deepfake_prob: float) -> str:
    """Synchronous call to the local Phi-3 model via Ollama."""
    
    # 1. Pre-categorize the threat level based on the score
    if deepfake_prob < 0.30:
        classification = "Authentic / Unaltered"
        directive = "State that the media appears to be an authentic, unaltered capture. No immediate threat detected."
    elif deepfake_prob < 0.70:
        classification = "Suspicious / Inconclusive"
        directive = "State that minor anomalies were detected. Recommend standard secondary verification before official use."
    else:
        classification = "Likely Deepfake / Highly Manipulated"
        directive = "State that severe synthetic manipulation was detected. Recommend immediate quarantine of the asset."

    # 2. Feed an objective, constrained prompt to Phi-3
    prompt = f"""You are an objective forensic digital analyst. 
    A new media file has been scanned by the ViT-CORE-FORENSICS engine.
    
    Diagnostic Results:
    - Manipulation Probability: {deepfake_prob * 100:.1f}%
    - System Classification: {classification}
    
    Task: Write a strict, clinical, 2-sentence forensic summary. 
    Constraint 1: {directive}
    Constraint 2: Do NOT assume the visual content of the media (it could be a playground, a document, or a person). Focus ONLY on the digital authenticity.
    Constraint 3: Do not use hyperbolic buzzwords like "national security" or "counterintelligence" unless the probability is above 90%."""

    url = "http://host.docker.internal:11434/api/generate"
    payload = json.dumps({
        "model": "phi3",
        "prompt": prompt,
        "stream": False
    }).encode("utf-8")
    
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
    
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            result = json.loads(response.read().decode("utf-8"))
            return result.get("response", "AI processing completed.")
    except Exception as e:
        logger.warning(f"Phi-3 unavailable. Fallback triggered. Reason: {str(e)}")
        return f"System Classification: {classification}."

async def run_vit_forensics_mock(job_id: str, evidence_id: str, session):
    """Generates the data and connects to Phi-3 for the assessment."""
    logger.info(f"[JOB {job_id}] Initializing ViT-CORE-FORENSICS for Evidence {evidence_id}...")
    
    # 1. Simulate the ViT image analysis (Hardcoded to 88% fake for this test)
    # 1. Simulate the ViT image analysis (Randomized between 1% and 99%)
    await asyncio.sleep(2) 
    simulated_prob = round(random.uniform(0.01, 0.99), 3) 
    
    # 2. Call Phi-3 to generate the natural language summary (offloaded to a thread so it doesn't block FastAPI)
    logger.info(f"[JOB {job_id}] ViT analysis complete. Handing off to Phi-3 for threat summary...")
    summary = await asyncio.to_thread(generate_phi3_summary, simulated_prob)
    
    # 3. Construct the final report payload
    report_data = {
        "deepfake_probability": simulated_prob,
        "c2pa_intact": False,
        "threat_summary": summary
    }
    
    # 4. Save the report directly to the database using raw SQL to bypass strict ORM mapping
    update_stmt = text("""
        UPDATE analysis.analysis_jobs 
        SET ai_report = :report 
        WHERE id = :job_id
    """)
    await session.execute(update_stmt, {"report": json.dumps(report_data), "job_id": job_id})
    logger.info(f"[JOB {job_id}] Phi-3 Report generated and secured to database.")

async def poll_analysis_jobs():
    """Continuous background loop that watches for PENDING evidence."""
    logger.info("NSB Intelligence Worker is online and scanning for pending jobs...")
    
    while True:
        try:
            async with async_session_maker() as session:
                stmt = select(AnalysisJobORM).where(AnalysisJobORM.status == "PENDING").limit(1)
                result = await session.execute(stmt)
                job = result.scalar_one_or_none()

                if job:
                    job.status = "PROCESSING"
                    await session.commit()

                    await run_vit_forensics_mock(str(job.id), str(job.evidence_id), session)

                    job.status = "COMPLETED"
                    await session.commit()
                else:
                    await asyncio.sleep(3)
                    
        except Exception as e:
            logger.error(f"Worker Error: {str(e)}")
            await asyncio.sleep(5)