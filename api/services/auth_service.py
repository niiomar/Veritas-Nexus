"""Password hashing and JWT issuing/verification for real per-user auth
(api/routers/auth.py), replacing the shared PLATFORM_API_KEY stopgap.

Email-verification and password-reset links are just short-lived JWTs with a
`purpose` claim rather than a separate tokens table - one less table to
migrate and clean up, at the cost of not being able to revoke a single
outstanding link early (acceptable for a first pass).
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
import jwt

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"

ACCESS_TOKEN_TTL = timedelta(hours=12)
EMAIL_VERIFICATION_TTL = timedelta(hours=24)
PASSWORD_RESET_TTL = timedelta(hours=1)

TokenPurpose = Literal["access", "verify_email", "reset_password"]


def _require_secret() -> str:
    if not JWT_SECRET:
        raise RuntimeError(
            "JWT_SECRET is not set. Generate one with "
            "`python -c \"import secrets; print(secrets.token_urlsafe(32))\"` and put it in .env."
        )
    return JWT_SECRET


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed hash - never let this crash the login endpoint.
        return False


def create_token(user_id: uuid.UUID, purpose: TokenPurpose, ttl: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "purpose": purpose,
        "iat": now,
        "exp": now + ttl,
    }
    return jwt.encode(payload, _require_secret(), algorithm=JWT_ALGORITHM)


def create_access_token(user_id: uuid.UUID) -> str:
    return create_token(user_id, "access", ACCESS_TOKEN_TTL)


def create_email_verification_token(user_id: uuid.UUID) -> str:
    return create_token(user_id, "verify_email", EMAIL_VERIFICATION_TTL)


def create_password_reset_token(user_id: uuid.UUID) -> str:
    return create_token(user_id, "reset_password", PASSWORD_RESET_TTL)


class InvalidTokenError(Exception):
    pass


def decode_token(token: str, expected_purpose: TokenPurpose) -> uuid.UUID:
    """Returns the user id encoded in the token, or raises InvalidTokenError
    if it's malformed, expired, or issued for a different purpose (so an
    email-verification link can't double as a password-reset link, etc.)."""
    try:
        payload = jwt.decode(token, _require_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as e:
        raise InvalidTokenError(str(e)) from e

    if payload.get("purpose") != expected_purpose:
        raise InvalidTokenError("Token purpose mismatch.")

    try:
        return uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as e:
        raise InvalidTokenError("Token missing a valid subject.") from e
