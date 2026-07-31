"""Integration tests for the registration/verification/login/password-reset
flow (api/routers/auth.py), against a real Postgres instance.
"""
import re
import uuid

import pytest
from sqlalchemy import text

PASSWORD = "TestPassword123!"


def _extract_link(caplog) -> str:
    """Email delivery is a log-only stub in tests (no SMTP configured) - the
    verification/reset link is logged rather than emailed, so pull it out of
    the log record instead of a real inbox."""
    for record in caplog.records:
        match = re.search(r"http://\S+", record.message)
        if match:
            return match.group(0)
    raise AssertionError("no email link found in logs")


@pytest.mark.asyncio
async def test_register_creates_an_unverified_account(api_client):
    email = f"test-{uuid.uuid4().hex[:12]}@example.com"
    response = await api_client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD})
    assert response.status_code == 201, response.text


@pytest.mark.asyncio
async def test_register_rejects_duplicate_email(api_client):
    email = f"test-{uuid.uuid4().hex[:12]}@example.com"
    first = await api_client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD})
    assert first.status_code == 201

    second = await api_client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD})
    assert second.status_code == 409


@pytest.mark.asyncio
async def test_register_rejects_short_password(api_client):
    email = f"test-{uuid.uuid4().hex[:12]}@example.com"
    response = await api_client.post("/api/v1/auth/register", json={"email": email, "password": "short"})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_before_verification_is_rejected(api_client):
    email = f"test-{uuid.uuid4().hex[:12]}@example.com"
    await api_client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD})

    response = await api_client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_login_with_wrong_password_is_rejected(api_client, registered_user):
    response = await api_client.post(
        "/api/v1/auth/login", json={"email": registered_user["email"], "password": "WrongPassword123!"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_with_unknown_email_gives_the_same_error_as_wrong_password(api_client):
    """Regression guard against user enumeration: a nonexistent account and
    a wrong password must be indistinguishable to the caller."""
    unknown = await api_client.post(
        "/api/v1/auth/login", json={"email": "nobody-here@example.com", "password": PASSWORD}
    )
    assert unknown.status_code == 401
    assert unknown.json()["detail"] == "Invalid email or password."


@pytest.mark.asyncio
async def test_login_success_returns_a_usable_access_token(api_client, registered_user):
    login = await api_client.post(
        "/api/v1/auth/login", json={"email": registered_user["email"], "password": registered_user["password"]}
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = await api_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == registered_user["email"]


@pytest.mark.asyncio
async def test_me_requires_authentication(api_client):
    response = await api_client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_verify_email_with_garbage_token_is_rejected(api_client):
    response = await api_client.get("/api/v1/auth/verify", params={"token": "not-a-real-token"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_full_verification_flow_via_logged_link(api_client, caplog):
    """Exercises the real verify_email endpoint end-to-end, using the link
    the log-only email stub records instead of a real inbox."""
    import logging

    email = f"test-{uuid.uuid4().hex[:12]}@example.com"
    with caplog.at_level(logging.WARNING, logger="EmailService"):
        register = await api_client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD})
    assert register.status_code == 201

    link = _extract_link(caplog)
    token = link.split("verify_token=")[1]

    verify = await api_client.get("/api/v1/auth/verify", params={"token": token})
    assert verify.status_code == 200

    login = await api_client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200


@pytest.mark.asyncio
async def test_forgot_password_gives_the_same_response_for_known_and_unknown_emails(api_client, registered_user):
    """Regression guard against user enumeration via password reset."""
    known = await api_client.post("/api/v1/auth/forgot-password", json={"email": registered_user["email"]})
    unknown = await api_client.post("/api/v1/auth/forgot-password", json={"email": "nobody-here@example.com"})

    assert known.status_code == 200
    assert unknown.status_code == 200
    assert known.json()["message"] == unknown.json()["message"]


@pytest.mark.asyncio
async def test_full_password_reset_flow_via_logged_link(api_client, registered_user, caplog):
    import logging

    with caplog.at_level(logging.WARNING, logger="EmailService"):
        forgot = await api_client.post("/api/v1/auth/forgot-password", json={"email": registered_user["email"]})
    assert forgot.status_code == 200

    link = _extract_link(caplog)
    token = link.split("reset_token=")[1]

    new_password = "BrandNewPassword456!"
    reset = await api_client.post("/api/v1/auth/reset-password", json={"token": token, "new_password": new_password})
    assert reset.status_code == 200

    old_login = await api_client.post(
        "/api/v1/auth/login", json={"email": registered_user["email"], "password": registered_user["password"]}
    )
    assert old_login.status_code == 401

    new_login = await api_client.post(
        "/api/v1/auth/login", json={"email": registered_user["email"], "password": new_password}
    )
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_reset_password_with_garbage_token_is_rejected(api_client):
    response = await api_client.post(
        "/api/v1/auth/reset-password", json={"token": "not-a-real-token", "new_password": "Whatever123!"}
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_verification_token_cannot_be_used_as_a_reset_token(api_client, db_session):
    """The purpose claim must actually be enforced - otherwise any issued
    token doubles as every other kind of token."""
    from api.services.auth_service import create_email_verification_token

    email = f"test-{uuid.uuid4().hex[:12]}@example.com"
    await api_client.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD})
    row = (await db_session.execute(text("SELECT id FROM core.users WHERE email = :email"), {"email": email})).fetchone()
    user_id = row.id

    verification_token = create_email_verification_token(user_id)
    response = await api_client.post(
        "/api/v1/auth/reset-password", json={"token": verification_token, "new_password": "Whatever123!"}
    )
    assert response.status_code == 400
