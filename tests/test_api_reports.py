"""Integration tests for POST/GET /api/v1/reports, which used to be a
hardcoded fake response ({"message": "Report generated", "report_id":
"new-uuid"}) with no PDF, no persistence, and no way to retrieve anything.
"""
import base64
import json

import pytest

_TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)

_FAKE_ASSESSMENT = {
    "verdict": "VERIFIED",
    "conf": "95.0",
    "type": "trust",
    "msg": "Authenticity Established",
    "policy": "Weighted_XAI_v4.7",
    "domains": [
        {"name": "Cryptographic Provenance", "score": 30, "max": 30, "weight": 30, "evidence": [
            {"text": "Valid C2PA Manifest & Signature", "effect": "Positive", "pts": 30}
        ]},
    ],
    "totalScore": 95,
}
_FAKE_AI_REPORT = {
    "deepfake_probability": 0.05,
    "c2pa_data": {"is_signed": True, "status": "VALID"},
    "platform_status": "VERIFIED",
    "disposition": "ABSOLUTE TRUST - Cryptographic provenance and neural consensus achieved.",
    "threat_summary": "Intelligence assessment complete.",
    "assessment": _FAKE_ASSESSMENT,
}


async def _create_case_with_evidence(api_client, auth_headers):
    case = await api_client.post(
        "/api/v1/cases",
        json={"title": "Report Test Case", "priority": "LOW", "analyst": "Analyst_11"},
        headers=auth_headers,
    )
    case_id = case.json()["case_id"]

    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    upload = await api_client.post(
        "/api/v1/evidence/", files=files, data={"case_id": case_id}, headers=auth_headers
    )
    assert upload.status_code == 200, upload.text
    return upload.json()["evidence_id"]


async def _complete_analysis(db_session, evidence_id, ai_report=None):
    from sqlalchemy import text

    await db_session.execute(
        text("UPDATE analysis.analysis_jobs SET status = 'COMPLETED', ai_report = :report WHERE evidence_id = :evidence_id"),
        {"report": json.dumps(ai_report or _FAKE_AI_REPORT), "evidence_id": evidence_id},
    )
    await db_session.commit()


@pytest.mark.asyncio
async def test_generate_report_requires_authentication(api_client, auth_headers):
    evidence_id = await _create_case_with_evidence(api_client, auth_headers)

    response = await api_client.post(f"/api/v1/reports/{evidence_id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_generate_report_for_nonexistent_evidence_returns_404(api_client, auth_headers):
    response = await api_client.post(
        "/api/v1/reports/00000000-0000-0000-0000-000000000000", headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_generate_report_before_analysis_completes_returns_409(api_client, auth_headers):
    """The background worker isn't running in these tests (see
    conftest.py's api_client fixture) - the job stays PENDING."""
    evidence_id = await _create_case_with_evidence(api_client, auth_headers)

    response = await api_client.post(f"/api/v1/reports/{evidence_id}", headers=auth_headers)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_generate_report_produces_a_downloadable_pdf(api_client, auth_headers, db_session):
    evidence_id = await _create_case_with_evidence(api_client, auth_headers)
    await _complete_analysis(db_session, evidence_id)

    generate = await api_client.post(f"/api/v1/reports/{evidence_id}", headers=auth_headers)
    assert generate.status_code == 201, generate.text
    body = generate.json()
    assert body["status"] == "success"
    assert body["evidence_id"] == evidence_id
    report_id = body["report_id"]

    download = await api_client.get(f"/api/v1/reports/{report_id}/download", headers=auth_headers)
    assert download.status_code == 200
    assert download.headers["content-type"] == "application/pdf"
    assert download.content[:4] == b"%PDF"


@pytest.mark.asyncio
async def test_generate_report_twice_produces_two_independent_snapshots(api_client, auth_headers, db_session):
    """Reports are immutable snapshots, not a single mutable resource -
    generating again must not overwrite or invalidate the first one."""
    evidence_id = await _create_case_with_evidence(api_client, auth_headers)
    await _complete_analysis(db_session, evidence_id)

    first = await api_client.post(f"/api/v1/reports/{evidence_id}", headers=auth_headers)
    second = await api_client.post(f"/api/v1/reports/{evidence_id}", headers=auth_headers)
    assert first.json()["report_id"] != second.json()["report_id"]

    for report_id in (first.json()["report_id"], second.json()["report_id"]):
        download = await api_client.get(f"/api/v1/reports/{report_id}/download", headers=auth_headers)
        assert download.status_code == 200


@pytest.mark.asyncio
async def test_download_report_requires_authentication(api_client, auth_headers, db_session):
    evidence_id = await _create_case_with_evidence(api_client, auth_headers)
    await _complete_analysis(db_session, evidence_id)
    generate = await api_client.post(f"/api/v1/reports/{evidence_id}", headers=auth_headers)
    report_id = generate.json()["report_id"]

    response = await api_client.get(f"/api/v1/reports/{report_id}/download")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_download_nonexistent_report_returns_404(api_client, auth_headers):
    response = await api_client.get(
        "/api/v1/reports/00000000-0000-0000-0000-000000000000/download", headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_generate_report_writes_an_audit_event(api_client, auth_headers, registered_user, db_session):
    """Every other state-changing action (case create/delete, evidence
    ingest/delete) writes to core.audit_events - report generation is a
    chain-of-custody feature, so leaving it unaudited would be ironic."""
    from sqlalchemy import text

    evidence_id = await _create_case_with_evidence(api_client, auth_headers)
    await _complete_analysis(db_session, evidence_id)

    generate = await api_client.post(f"/api/v1/reports/{evidence_id}", headers=auth_headers)
    assert generate.status_code == 201, generate.text

    row = (await db_session.execute(
        text("SELECT performed_by FROM core.audit_events WHERE resource_id = :id AND action = 'REPORT_GENERATED'"),
        {"id": evidence_id},
    )).fetchone()
    assert row is not None
    assert row.performed_by == registered_user["email"]


@pytest.mark.asyncio
async def test_list_reports_requires_authentication(api_client, auth_headers):
    evidence_id = await _create_case_with_evidence(api_client, auth_headers)

    response = await api_client.get(f"/api/v1/reports/{evidence_id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_reports_is_empty_before_any_are_generated(api_client, auth_headers):
    evidence_id = await _create_case_with_evidence(api_client, auth_headers)

    response = await api_client.get(f"/api/v1/reports/{evidence_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"reports": []}


@pytest.mark.asyncio
async def test_list_reports_finds_previously_generated_reports_newest_first(api_client, auth_headers, registered_user, db_session):
    """This is the whole point of the endpoint: report_id only ever
    surfaces once, in generate_court_report's response - without a way to
    list them back, a dismissed download was effectively unrecoverable."""
    evidence_id = await _create_case_with_evidence(api_client, auth_headers)
    await _complete_analysis(db_session, evidence_id)

    first = await api_client.post(f"/api/v1/reports/{evidence_id}", headers=auth_headers)
    second = await api_client.post(f"/api/v1/reports/{evidence_id}", headers=auth_headers)

    listing = await api_client.get(f"/api/v1/reports/{evidence_id}", headers=auth_headers)
    assert listing.status_code == 200
    reports = listing.json()["reports"]
    assert len(reports) == 2
    # Newest first.
    assert reports[0]["report_id"] == second.json()["report_id"]
    assert reports[1]["report_id"] == first.json()["report_id"]
    assert reports[0]["generated_by"] == registered_user["email"]
    assert reports[0]["sha256"]


@pytest.mark.asyncio
async def test_list_reports_does_not_include_other_evidences_reports(api_client, auth_headers, db_session):
    evidence_a = await _create_case_with_evidence(api_client, auth_headers)
    evidence_b = await _create_case_with_evidence(api_client, auth_headers)
    await _complete_analysis(db_session, evidence_a)
    await _complete_analysis(db_session, evidence_b)

    await api_client.post(f"/api/v1/reports/{evidence_a}", headers=auth_headers)

    listing_b = await api_client.get(f"/api/v1/reports/{evidence_b}", headers=auth_headers)
    assert listing_b.json() == {"reports": []}
