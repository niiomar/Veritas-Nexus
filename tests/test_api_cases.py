"""Integration tests for the case CRUD endpoints, against a real Postgres
instance (see conftest.py). These exist because this exact code path had two
real bugs found this project: case deletion never reached the backend, and
create_case depended on a use-case layer that didn't actually import.
"""
import pytest


@pytest.mark.asyncio
async def test_create_case_requires_authentication(api_client):
    response = await api_client.post("/api/v1/cases", json={"title": "Unauthorized Case"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_case_success(api_client, auth_headers):
    response = await api_client.post(
        "/api/v1/cases",
        json={"title": "Operation Nightfall", "alias": "CASE-404", "priority": "HIGH", "analyst": "Analyst_01"},
        headers=auth_headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "success"
    assert body["title"] == "Operation Nightfall"
    assert body["alias"] == "CASE-404"
    assert body["analyst"] == "Analyst_01"
    assert body["case_number"].startswith("NSB-")


@pytest.mark.asyncio
async def test_list_cases_includes_created_case(api_client, auth_headers):
    create = await api_client.post(
        "/api/v1/cases",
        json={"title": "Visible Case", "alias": "CASE-VIS", "priority": "LOW", "analyst": "Analyst_02"},
        headers=auth_headers,
    )
    case_id = create.json()["case_id"]

    listing = await api_client.get("/api/v1/cases")
    assert listing.status_code == 200
    ids = [c["id"] for c in listing.json()["cases"]]
    assert case_id in ids


@pytest.mark.asyncio
async def test_update_case_requires_authentication(api_client, auth_headers):
    create = await api_client.post(
        "/api/v1/cases",
        json={"title": "Original Title", "priority": "LOW", "analyst": "Analyst_03"},
        headers=auth_headers,
    )
    case_id = create.json()["case_id"]

    unauthorized = await api_client.put(f"/api/v1/cases/{case_id}", json={"title": "Hijacked"})
    assert unauthorized.status_code == 401


@pytest.mark.asyncio
async def test_update_case_persists_changes(api_client, auth_headers):
    create = await api_client.post(
        "/api/v1/cases",
        json={"title": "Original Title", "alias": "CASE-ORIG", "priority": "LOW", "analyst": "Analyst_03"},
        headers=auth_headers,
    )
    case_id = create.json()["case_id"]

    update = await api_client.put(
        f"/api/v1/cases/{case_id}",
        json={"title": "Updated Title", "alias": "CASE-ORIG", "priority": "CRITICAL", "analyst": "Analyst_03"},
        headers=auth_headers,
    )
    assert update.status_code == 200
    assert update.json()["title"] == "Updated Title"
    assert update.json()["priority"] == "CRITICAL"


@pytest.mark.asyncio
async def test_delete_case_requires_authentication(api_client, auth_headers):
    create = await api_client.post(
        "/api/v1/cases",
        json={"title": "Doomed Case", "priority": "LOW", "analyst": "Analyst_04"},
        headers=auth_headers,
    )
    case_id = create.json()["case_id"]

    unauthorized = await api_client.delete(f"/api/v1/cases/{case_id}")
    assert unauthorized.status_code == 401


@pytest.mark.asyncio
async def test_delete_case_removes_it_from_the_list(api_client, auth_headers):
    create = await api_client.post(
        "/api/v1/cases",
        json={"title": "Doomed Case", "priority": "LOW", "analyst": "Analyst_04"},
        headers=auth_headers,
    )
    case_id = create.json()["case_id"]

    delete = await api_client.delete(f"/api/v1/cases/{case_id}", headers=auth_headers)
    assert delete.status_code == 200

    listing = await api_client.get("/api/v1/cases")
    ids = [c["id"] for c in listing.json()["cases"]]
    assert case_id not in ids


@pytest.mark.asyncio
async def test_delete_nonexistent_case_returns_404(api_client, auth_headers):
    response = await api_client.delete(
        "/api/v1/cases/00000000-0000-0000-0000-000000000000", headers=auth_headers
    )
    assert response.status_code == 404, response.text


@pytest.mark.asyncio
async def test_deleted_case_is_only_soft_deleted_not_gone(api_client, auth_headers, db_session):
    """delete_case used to hard-delete immediately with no way back. Confirm
    the row survives (just hidden) rather than being physically removed."""
    from sqlalchemy import text

    create = await api_client.post(
        "/api/v1/cases",
        json={"title": "Soft Deleted Case", "priority": "LOW", "analyst": "Analyst_06"},
        headers=auth_headers,
    )
    case_id = create.json()["case_id"]

    await api_client.delete(f"/api/v1/cases/{case_id}", headers=auth_headers)

    row = (await db_session.execute(
        text("SELECT deleted_at FROM core.cases WHERE id = :id"), {"id": case_id}
    )).fetchone()
    assert row is not None, "the row must still exist - only deleted_at should change"
    assert row.deleted_at is not None


@pytest.mark.asyncio
async def test_restore_case_requires_authentication(api_client, auth_headers):
    create = await api_client.post(
        "/api/v1/cases",
        json={"title": "Restorable Case", "priority": "LOW", "analyst": "Analyst_07"},
        headers=auth_headers,
    )
    case_id = create.json()["case_id"]
    await api_client.delete(f"/api/v1/cases/{case_id}", headers=auth_headers)

    response = await api_client.post(f"/api/v1/cases/{case_id}/restore")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_restore_case_undoes_the_delete(api_client, auth_headers):
    create = await api_client.post(
        "/api/v1/cases",
        json={"title": "Restorable Case", "priority": "LOW", "analyst": "Analyst_07"},
        headers=auth_headers,
    )
    case_id = create.json()["case_id"]
    await api_client.delete(f"/api/v1/cases/{case_id}", headers=auth_headers)

    restore = await api_client.post(f"/api/v1/cases/{case_id}/restore", headers=auth_headers)
    assert restore.status_code == 200

    listing = await api_client.get("/api/v1/cases")
    ids = [c["id"] for c in listing.json()["cases"]]
    assert case_id in ids


@pytest.mark.asyncio
async def test_restore_case_that_was_never_deleted_returns_404(api_client, auth_headers):
    create = await api_client.post(
        "/api/v1/cases",
        json={"title": "Never Deleted Case", "priority": "LOW", "analyst": "Analyst_08"},
        headers=auth_headers,
    )
    case_id = create.json()["case_id"]

    response = await api_client.post(f"/api/v1/cases/{case_id}/restore", headers=auth_headers)
    assert response.status_code == 404
