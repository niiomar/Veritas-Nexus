"""Integration tests for the evidence ingest/list/delete endpoints and the
case-delete cascade, against a real Postgres instance (see conftest.py).
"""
import base64

import pytest

# A minimal valid 1x1 transparent PNG - just needs to be real enough for
# PIL/OpenCV to open without erroring; exiftool isn't installed in the test
# environment, which is fine since ExifCoreEngine degrades gracefully rather
# than raising when the binary is missing.
_TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


async def _create_case(api_client, auth_headers, title="Evidence Test Case"):
    response = await api_client.post(
        "/api/v1/cases",
        json={"title": title, "priority": "MEDIUM", "analyst": "Analyst_05"},
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["case_id"]


async def _upload_evidence(api_client, auth_headers, case_id):
    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    data = {"case_id": case_id, "uploaded_by": "Analyst_05"}
    upload = await api_client.post("/api/v1/evidence/", files=files, data=data, headers=auth_headers)
    assert upload.status_code == 200, upload.text
    return upload.json()["evidence_id"]


@pytest.mark.asyncio
async def test_ingest_evidence_requires_authentication(api_client, auth_headers):
    case_id = await _create_case(api_client, auth_headers)
    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    data = {"case_id": case_id, "uploaded_by": "Analyst_05"}
    response = await api_client.post("/api/v1/evidence/", files=files, data=data)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_ingest_and_list_evidence(api_client, auth_headers):
    case_id = await _create_case(api_client, auth_headers)
    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    data = {"case_id": case_id, "uploaded_by": "Analyst_05"}

    upload = await api_client.post("/api/v1/evidence/", files=files, data=data, headers=auth_headers)
    assert upload.status_code == 200
    body = upload.json()
    assert body["status"] == "success"
    evidence_id = body["evidence_id"]
    assert len(body["sha256"]) == 64

    listing = await api_client.get("/api/v1/evidence/")
    assert listing.status_code == 200
    ids = [e["id"] for e in listing.json()["evidence"]]
    assert evidence_id in ids


@pytest.mark.asyncio
async def test_delete_evidence_requires_authentication(api_client, auth_headers):
    case_id = await _create_case(api_client, auth_headers)
    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    data = {"case_id": case_id, "uploaded_by": "Analyst_05"}
    upload = await api_client.post("/api/v1/evidence/", files=files, data=data, headers=auth_headers)
    evidence_id = upload.json()["evidence_id"]

    response = await api_client.delete(f"/api/v1/evidence/{evidence_id}")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_evidence_removes_it_from_the_list(api_client, auth_headers):
    case_id = await _create_case(api_client, auth_headers)
    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    data = {"case_id": case_id, "uploaded_by": "Analyst_05"}
    upload = await api_client.post("/api/v1/evidence/", files=files, data=data, headers=auth_headers)
    evidence_id = upload.json()["evidence_id"]

    delete = await api_client.delete(f"/api/v1/evidence/{evidence_id}", headers=auth_headers)
    assert delete.status_code == 200

    listing = await api_client.get("/api/v1/evidence/")
    ids = [e["id"] for e in listing.json()["evidence"]]
    assert evidence_id not in ids


@pytest.mark.asyncio
async def test_deleting_a_case_cascades_to_its_evidence(api_client, auth_headers):
    """Regression test: this endpoint used to only clear the frontend's
    localStorage cache and never actually delete anything server-side."""
    case_id = await _create_case(api_client, auth_headers, title="Cascade Test Case")
    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    data = {"case_id": case_id, "uploaded_by": "Analyst_05"}
    upload = await api_client.post("/api/v1/evidence/", files=files, data=data, headers=auth_headers)
    evidence_id = upload.json()["evidence_id"]

    delete_case = await api_client.delete(f"/api/v1/cases/{case_id}", headers=auth_headers)
    assert delete_case.status_code == 200

    listing = await api_client.get("/api/v1/evidence/")
    ids = [e["id"] for e in listing.json()["evidence"]]
    assert evidence_id not in ids


@pytest.mark.asyncio
async def test_deleted_evidence_file_and_row_survive_until_purged(api_client, auth_headers, db_session):
    from pathlib import Path
    from sqlalchemy import text

    case_id = await _create_case(api_client, auth_headers)
    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    data = {"case_id": case_id, "uploaded_by": "Analyst_05"}
    upload = await api_client.post("/api/v1/evidence/", files=files, data=data, headers=auth_headers)
    evidence_id = upload.json()["evidence_id"]

    await api_client.delete(f"/api/v1/evidence/{evidence_id}", headers=auth_headers)

    row = (await db_session.execute(
        text("SELECT deleted_at, storage_uri FROM core.evidence WHERE id = :id"), {"id": evidence_id}
    )).fetchone()
    assert row is not None, "the row must still exist - delete_evidence only stamps deleted_at"
    assert row.deleted_at is not None
    assert Path(row.storage_uri).exists(), "the physical file must survive until the purge sweep runs"


@pytest.mark.asyncio
async def test_restore_evidence_requires_authentication(api_client, auth_headers):
    case_id = await _create_case(api_client, auth_headers)
    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    data = {"case_id": case_id, "uploaded_by": "Analyst_05"}
    upload = await api_client.post("/api/v1/evidence/", files=files, data=data, headers=auth_headers)
    evidence_id = upload.json()["evidence_id"]
    await api_client.delete(f"/api/v1/evidence/{evidence_id}", headers=auth_headers)

    response = await api_client.post(f"/api/v1/evidence/{evidence_id}/restore")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_restore_evidence_undoes_the_delete(api_client, auth_headers):
    case_id = await _create_case(api_client, auth_headers)
    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    data = {"case_id": case_id, "uploaded_by": "Analyst_05"}
    upload = await api_client.post("/api/v1/evidence/", files=files, data=data, headers=auth_headers)
    evidence_id = upload.json()["evidence_id"]
    await api_client.delete(f"/api/v1/evidence/{evidence_id}", headers=auth_headers)

    restore = await api_client.post(f"/api/v1/evidence/{evidence_id}/restore", headers=auth_headers)
    assert restore.status_code == 200

    listing = await api_client.get("/api/v1/evidence/")
    ids = [e["id"] for e in listing.json()["evidence"]]
    assert evidence_id in ids


@pytest.mark.asyncio
async def test_restoring_a_case_also_restores_its_cascaded_evidence(api_client, auth_headers):
    case_id = await _create_case(api_client, auth_headers, title="Cascade Restore Case")
    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    data = {"case_id": case_id, "uploaded_by": "Analyst_05"}
    upload = await api_client.post("/api/v1/evidence/", files=files, data=data, headers=auth_headers)
    evidence_id = upload.json()["evidence_id"]

    await api_client.delete(f"/api/v1/cases/{case_id}", headers=auth_headers)
    restore = await api_client.post(f"/api/v1/cases/{case_id}/restore", headers=auth_headers)
    assert restore.status_code == 200

    cases_listing = await api_client.get("/api/v1/cases")
    assert case_id in [c["id"] for c in cases_listing.json()["cases"]]

    evidence_listing = await api_client.get("/api/v1/evidence/")
    assert evidence_id in [e["id"] for e in evidence_listing.json()["evidence"]]


@pytest.mark.asyncio
async def test_list_evidence_reports_total_independent_of_limit(api_client, auth_headers):
    case_id = await _create_case(api_client, auth_headers, title="Pagination Total Case")
    ids = [await _upload_evidence(api_client, auth_headers, case_id) for _ in range(3)]

    response = await api_client.get("/api/v1/evidence/", params={"case_id": case_id, "limit": 1})
    body = response.json()
    assert body["total"] == 3, "total must reflect the full matching set, not just the page returned"
    assert len(body["evidence"]) == 1


@pytest.mark.asyncio
async def test_list_evidence_limit_and_offset_paginate_without_gaps_or_dupes(api_client, auth_headers):
    case_id = await _create_case(api_client, auth_headers, title="Pagination Walk Case")
    uploaded_ids = {await _upload_evidence(api_client, auth_headers, case_id) for _ in range(5)}

    seen: set[str] = set()
    offset = 0
    page_size = 2
    while True:
        response = await api_client.get(
            "/api/v1/evidence/", params={"case_id": case_id, "limit": page_size, "offset": offset}
        )
        page = response.json()["evidence"]
        if not page:
            break
        seen.update(e["id"] for e in page)
        offset += page_size

    assert seen == uploaded_ids


@pytest.mark.asyncio
async def test_list_evidence_case_id_filter_excludes_other_cases(api_client, auth_headers):
    case_a = await _create_case(api_client, auth_headers, title="Case A")
    case_b = await _create_case(api_client, auth_headers, title="Case B")
    evidence_a = await _upload_evidence(api_client, auth_headers, case_a)
    evidence_b = await _upload_evidence(api_client, auth_headers, case_b)

    response = await api_client.get("/api/v1/evidence/", params={"case_id": case_a})
    ids = [e["id"] for e in response.json()["evidence"]]
    assert evidence_a in ids
    assert evidence_b not in ids


@pytest.mark.asyncio
async def test_list_evidence_limit_is_capped_not_rejected(api_client, auth_headers):
    """An absurd limit shouldn't 400 or run an unbounded query - it should
    just be clamped to a sane ceiling."""
    response = await api_client.get("/api/v1/evidence/", params={"limit": 999999})
    assert response.status_code == 200
    assert response.json()["limit"] == 2000
