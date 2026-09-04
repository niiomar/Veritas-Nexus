"""Worker-level regression test for a real dispatch bug: execute_correlation_
engine's audio branch used to call evaluate_assessment (the visual scorer)
instead of evaluate_audio_assessment. evaluate_assessment has no concept of
audio_spoof_probability, so a genuine recording and a detected voice-clone
spoof both silently landed on the identical "INCONCLUSIVE" verdict - the
audio pipeline called the real ML engine and then threw its answer away.

tests/test_assessment_engine.py::TestAudioAssessment covers the scoring
function in isolation; this test proves the *worker* actually calls it.
"""
import json

import pytest
from sqlalchemy import text

# See test_worker_purge.py for why api.worker is never imported at module
# level: it pulls in infrastructure/persistence/database.py, which binds the
# engine to DATABASE_URL at import time - before the session-scoped
# _bind_app_to_test_database fixture (conftest.py) has set it correctly.


async def _create_audio_evidence(api_client, auth_headers):
    case = await api_client.post(
        "/api/v1/cases",
        json={"title": "Audio Dispatch Test Case", "priority": "LOW", "analyst": "Analyst_13"},
        headers=auth_headers,
    )
    case_id = case.json()["case_id"]

    # Only the .wav extension matters to worker.is_audio_file() - the actual
    # bytes are never parsed, since call_vit_core_audio_microservice is
    # monkeypatched below rather than really invoked.
    files = {"file": ("voice_sample.wav", b"not-real-audio-bytes", "audio/wav")}
    upload = await api_client.post(
        "/api/v1/evidence/", files=files, data={"case_id": case_id}, headers=auth_headers
    )
    assert upload.status_code == 200, upload.text
    return upload.json()["evidence_id"]


@pytest.mark.asyncio
async def test_clean_audio_is_scored_verified_not_inconclusive(api_client, auth_headers, db_session, monkeypatch):
    import api.worker as worker

    monkeypatch.setattr(worker, "call_vit_core_audio_microservice", lambda file_path: 0.05)

    evidence_id = await _create_audio_evidence(api_client, auth_headers)
    job_row = (await db_session.execute(
        text("SELECT id FROM analysis.analysis_jobs WHERE evidence_id = :id"), {"id": evidence_id}
    )).fetchone()

    await worker.execute_correlation_engine(str(job_row.id), evidence_id, db_session)
    await db_session.commit()

    result = (await db_session.execute(
        text("SELECT ai_report FROM analysis.analysis_jobs WHERE id = :id"), {"id": job_row.id}
    )).fetchone()
    ai_report = json.loads(result.ai_report) if isinstance(result.ai_report, str) else result.ai_report

    assert ai_report["audio_spoof_probability"] == 0.05
    assert ai_report["assessment"]["policy"] == "Audio_Spoof_v1.0"
    assert ai_report["assessment"]["verdict"] == "VERIFIED"


@pytest.mark.asyncio
async def test_spoofed_audio_is_scored_critical_not_inconclusive(api_client, auth_headers, db_session, monkeypatch):
    """The exact case the bug got backwards: a high-confidence spoof must
    not land on the same verdict as a clean recording."""
    import api.worker as worker

    monkeypatch.setattr(worker, "call_vit_core_audio_microservice", lambda file_path: 0.95)

    evidence_id = await _create_audio_evidence(api_client, auth_headers)
    job_row = (await db_session.execute(
        text("SELECT id FROM analysis.analysis_jobs WHERE evidence_id = :id"), {"id": evidence_id}
    )).fetchone()

    await worker.execute_correlation_engine(str(job_row.id), evidence_id, db_session)
    await db_session.commit()

    result = (await db_session.execute(
        text("SELECT ai_report FROM analysis.analysis_jobs WHERE id = :id"), {"id": job_row.id}
    )).fetchone()
    ai_report = json.loads(result.ai_report) if isinstance(result.ai_report, str) else result.ai_report

    assert ai_report["assessment"]["verdict"] == "CRITICAL"
    assert ai_report["assessment"]["policy"] == "Audio_Spoof_v1.0"
