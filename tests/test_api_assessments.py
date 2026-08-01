"""Integration tests for GET /api/v1/assessments/{evidence_id}, which used
to be a hardcoded stub message rather than real data (see
api/routers/assessments.py). It reads the same ai_report
api/worker.py writes via api/services/assessment_engine.py and that
evidence.list_evidence already returns inline.
"""
import base64
import json

import pytest

_TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


async def _create_case_with_evidence(api_client, auth_headers):
    case = await api_client.post(
        "/api/v1/cases",
        json={"title": "Assessment Test Case", "priority": "LOW", "analyst": "Analyst_10"},
        headers=auth_headers,
    )
    case_id = case.json()["case_id"]

    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    upload = await api_client.post(
        "/api/v1/evidence/", files=files, data={"case_id": case_id}, headers=auth_headers
    )
    assert upload.status_code == 200, upload.text
    return upload.json()["evidence_id"]


@pytest.mark.asyncio
async def test_get_assessment_requires_authentication(api_client, auth_headers):
    evidence_id = await _create_case_with_evidence(api_client, auth_headers)

    response = await api_client.get(f"/api/v1/assessments/{evidence_id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_assessment_for_nonexistent_evidence_returns_404(api_client, auth_headers):
    response = await api_client.get(
        "/api/v1/assessments/00000000-0000-0000-0000-000000000000", headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_assessment_before_analysis_completes_returns_409(api_client, auth_headers):
    """api.main's background worker isn't running in these tests (see
    conftest.py's api_client fixture) - the job stays PENDING, so there's no
    ai_report to return yet."""
    evidence_id = await _create_case_with_evidence(api_client, auth_headers)

    response = await api_client.get(f"/api/v1/assessments/{evidence_id}", headers=auth_headers)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_get_assessment_returns_the_stored_ai_report(api_client, auth_headers, db_session):
    from sqlalchemy import text

    evidence_id = await _create_case_with_evidence(api_client, auth_headers)

    fake_report = {"verdict": "VERIFIED", "conf": "9.5", "totalScore": 95, "domains": []}
    await db_session.execute(
        text("UPDATE analysis.analysis_jobs SET status = 'COMPLETED', ai_report = :report WHERE evidence_id = :evidence_id"),
        {"report": json.dumps(fake_report), "evidence_id": evidence_id},
    )
    await db_session.commit()

    response = await api_client.get(f"/api/v1/assessments/{evidence_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == fake_report
