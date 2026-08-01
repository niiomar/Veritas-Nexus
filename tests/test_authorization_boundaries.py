"""Regression tests for the shared-team-visibility authorization model:
any authenticated analyst can view any case/evidence, but only the
creator/uploader may mutate it. Before this, cases.py/evidence.py never
checked current_user against created_by/uploaded_by at all - any
registered account could retitle, delete, or restore anyone else's
investigation.
"""
import base64

import pytest

_TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


async def _create_case(api_client, auth_headers, title="Owned Case"):
    response = await api_client.post(
        "/api/v1/cases",
        json={"title": title, "priority": "MEDIUM", "analyst": "Analyst_01"},
        headers=auth_headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["case_id"]


async def _upload_evidence(api_client, auth_headers, case_id):
    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    upload = await api_client.post(
        "/api/v1/evidence/", files=files, data={"case_id": case_id}, headers=auth_headers
    )
    assert upload.status_code == 200, upload.text
    return upload.json()["evidence_id"]


@pytest.mark.asyncio
async def test_any_authenticated_user_can_list_and_view_another_users_case(api_client, auth_headers, other_auth_headers):
    case_id = await _create_case(api_client, auth_headers)

    listing = await api_client.get("/api/v1/cases", headers=other_auth_headers)
    assert case_id in [c["id"] for c in listing.json()["cases"]]

    detail = await api_client.get(f"/api/v1/cases/{case_id}", headers=other_auth_headers)
    assert detail.status_code == 200


@pytest.mark.asyncio
async def test_non_owner_cannot_update_a_case(api_client, auth_headers, other_auth_headers):
    case_id = await _create_case(api_client, auth_headers)

    response = await api_client.put(
        f"/api/v1/cases/{case_id}",
        json={"title": "Hijacked", "priority": "LOW", "analyst": "Attacker"},
        headers=other_auth_headers,
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_non_owner_cannot_delete_a_case(api_client, auth_headers, other_auth_headers):
    case_id = await _create_case(api_client, auth_headers)

    response = await api_client.delete(f"/api/v1/cases/{case_id}", headers=other_auth_headers)
    assert response.status_code == 403

    # And it must still be there, untouched, for the actual owner.
    listing = await api_client.get("/api/v1/cases", headers=auth_headers)
    assert case_id in [c["id"] for c in listing.json()["cases"]]


@pytest.mark.asyncio
async def test_non_owner_cannot_restore_a_case(api_client, auth_headers, other_auth_headers):
    case_id = await _create_case(api_client, auth_headers)
    await api_client.delete(f"/api/v1/cases/{case_id}", headers=auth_headers)

    response = await api_client.post(f"/api/v1/cases/{case_id}/restore", headers=other_auth_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_owner_can_still_update_and_delete_their_own_case(api_client, auth_headers):
    """Sanity check that the ownership check doesn't accidentally lock out
    the actual owner."""
    case_id = await _create_case(api_client, auth_headers)

    update = await api_client.put(
        f"/api/v1/cases/{case_id}",
        json={"title": "Updated by owner", "priority": "HIGH", "analyst": "Analyst_01"},
        headers=auth_headers,
    )
    assert update.status_code == 200

    delete = await api_client.delete(f"/api/v1/cases/{case_id}", headers=auth_headers)
    assert delete.status_code == 200


@pytest.mark.asyncio
async def test_any_authenticated_user_can_view_another_users_evidence(api_client, auth_headers, other_auth_headers):
    case_id = await _create_case(api_client, auth_headers)
    evidence_id = await _upload_evidence(api_client, auth_headers, case_id)

    listing = await api_client.get("/api/v1/evidence/", headers=other_auth_headers)
    assert evidence_id in [e["id"] for e in listing.json()["evidence"]]


@pytest.mark.asyncio
async def test_non_uploader_cannot_delete_evidence(api_client, auth_headers, other_auth_headers):
    case_id = await _create_case(api_client, auth_headers)
    evidence_id = await _upload_evidence(api_client, auth_headers, case_id)

    response = await api_client.delete(f"/api/v1/evidence/{evidence_id}", headers=other_auth_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_non_uploader_cannot_restore_evidence(api_client, auth_headers, other_auth_headers):
    case_id = await _create_case(api_client, auth_headers)
    evidence_id = await _upload_evidence(api_client, auth_headers, case_id)
    await api_client.delete(f"/api/v1/evidence/{evidence_id}", headers=auth_headers)

    response = await api_client.post(f"/api/v1/evidence/{evidence_id}/restore", headers=other_auth_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_uploaded_by_is_server_authoritative_not_client_supplied(api_client, auth_headers, registered_user, db_session):
    """A client-supplied uploaded_by used to be trusted verbatim, making
    chain-of-custody spoofable. It must now always be the authenticated
    caller's own email, regardless of what the client sends."""
    from sqlalchemy import text

    case_id = await _create_case(api_client, auth_headers)
    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    upload = await api_client.post(
        "/api/v1/evidence/",
        files=files,
        data={"case_id": case_id, "uploaded_by": "someone-else@example.com"},
        headers=auth_headers,
    )
    assert upload.status_code == 200, upload.text
    evidence_id = upload.json()["evidence_id"]

    row = (await db_session.execute(
        text("SELECT uploaded_by FROM core.evidence WHERE id = :id"), {"id": evidence_id}
    )).fetchone()
    assert row.uploaded_by == registered_user["email"]
