"""Tests for api/worker.py's purge_expired_soft_deletes - the only place a
soft-deleted case/evidence row (and its physical file) actually becomes
unrecoverable. Directly manipulates deleted_at to simulate the grace period
having elapsed, since the real tests can't wait 24 real hours.
"""
import base64
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import text

# NOTE: deliberately NOT importing api.worker at module level. That import
# pulls in infrastructure/persistence/database.py, which binds its engine to
# DATABASE_URL at *import time* - and pytest imports test modules during
# collection, before the session-scoped _bind_app_to_test_database fixture
# (conftest.py) ever runs. A top-level import here would permanently bind
# the shared engine singleton to the wrong (docker-compose) URL for the rest
# of the test session. Import inside each test instead, after the fixture
# has set the env var.

_TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


async def _create_case_with_evidence(api_client, auth_headers, title):
    case = await api_client.post(
        "/api/v1/cases",
        json={"title": title, "priority": "LOW", "analyst": "Analyst_09"},
        headers=auth_headers,
    )
    case_id = case.json()["case_id"]

    files = {"file": ("test.png", _TINY_PNG, "image/png")}
    data = {"case_id": case_id, "uploaded_by": "Analyst_09"}
    upload = await api_client.post("/api/v1/evidence/", files=files, data=data, headers=auth_headers)
    return case_id, upload.json()["evidence_id"]


@pytest.mark.asyncio
async def test_purge_leaves_recently_deleted_evidence_alone(api_client, auth_headers, db_session):
    """The whole point of the grace period: a delete from moments ago must
    survive a purge sweep untouched."""
    from api.worker import purge_expired_soft_deletes

    case_id, evidence_id = await _create_case_with_evidence(api_client, auth_headers, "Fresh Delete Case")
    await api_client.delete(f"/api/v1/evidence/{evidence_id}", headers=auth_headers)

    await purge_expired_soft_deletes(db_session)

    row = (await db_session.execute(
        text("SELECT id, storage_uri FROM core.evidence WHERE id = :id"), {"id": evidence_id}
    )).fetchone()
    assert row is not None, "a delete from seconds ago must not be purged yet"
    assert Path(row.storage_uri).exists()


@pytest.mark.asyncio
async def test_purge_removes_evidence_row_and_file_past_the_grace_period(api_client, auth_headers, db_session):
    from api.worker import purge_expired_soft_deletes

    case_id, evidence_id = await _create_case_with_evidence(api_client, auth_headers, "Expired Evidence Case")
    await api_client.delete(f"/api/v1/evidence/{evidence_id}", headers=auth_headers)

    row = (await db_session.execute(
        text("SELECT storage_uri FROM core.evidence WHERE id = :id"), {"id": evidence_id}
    )).fetchone()
    file_path = Path(row.storage_uri)
    assert file_path.exists()

    # Simulate the grace period having elapsed.
    long_ago = datetime.now(timezone.utc) - timedelta(hours=48)
    await db_session.execute(
        text("UPDATE core.evidence SET deleted_at = :ts WHERE id = :id"),
        {"ts": long_ago, "id": evidence_id},
    )
    await db_session.commit()

    await purge_expired_soft_deletes(db_session)

    remaining = (await db_session.execute(
        text("SELECT id FROM core.evidence WHERE id = :id"), {"id": evidence_id}
    )).fetchone()
    assert remaining is None, "evidence past its grace period should be physically gone"
    assert not file_path.exists(), "the physical file should be removed from the storage vault too"


@pytest.mark.asyncio
async def test_purge_removes_expired_case_and_its_evidence(api_client, auth_headers, db_session):
    from api.worker import purge_expired_soft_deletes

    case_id, evidence_id = await _create_case_with_evidence(api_client, auth_headers, "Expired Case")
    await api_client.delete(f"/api/v1/cases/{case_id}", headers=auth_headers)

    long_ago = datetime.now(timezone.utc) - timedelta(hours=48)
    await db_session.execute(text("UPDATE core.cases SET deleted_at = :ts WHERE id = :id"), {"ts": long_ago, "id": case_id})
    await db_session.execute(text("UPDATE core.evidence SET deleted_at = :ts WHERE id = :id"), {"ts": long_ago, "id": evidence_id})
    await db_session.commit()

    await purge_expired_soft_deletes(db_session)

    remaining_case = (await db_session.execute(
        text("SELECT id FROM core.cases WHERE id = :id"), {"id": case_id}
    )).fetchone()
    remaining_evidence = (await db_session.execute(
        text("SELECT id FROM core.evidence WHERE id = :id"), {"id": evidence_id}
    )).fetchone()
    assert remaining_case is None
    assert remaining_evidence is None
