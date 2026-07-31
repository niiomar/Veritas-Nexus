import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_db_session, get_current_user
from api.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    create_email_verification_token,
    create_password_reset_token,
    decode_token,
    InvalidTokenError,
)
from api.services.email_service import send_verification_email, send_password_reset_email
from infrastructure.persistence.models import UserORM

router = APIRouter()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


def _user_payload(user: UserORM) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "is_verified": user.is_verified,
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db_session)):
    """Self-service signup. Accounts start unverified; login is blocked
    until the email verification link is used (see /verify)."""
    existing = (await db.execute(select(UserORM).where(UserORM.email == request.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with that email already exists.")

    now = datetime.now(timezone.utc)
    user = UserORM(
        id=uuid.uuid4(),
        email=request.email,
        password_hash=hash_password(request.password),
        is_verified=False,
        role="ANALYST",
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    await db.flush()

    await db.execute(
        text("""
            INSERT INTO core.audit_events (id, resource_id, action, created_at, performed_by)
            VALUES (:id, :resource_id, 'USER_REGISTERED', :created_at, :performed_by)
        """),
        {"id": str(uuid.uuid4()), "resource_id": str(user.id), "created_at": now, "performed_by": user.email},
    )
    await db.commit()

    verification_token = create_email_verification_token(user.id)
    send_verification_email(user.email, f"{FRONTEND_URL}/?verify_token={verification_token}")

    return {"status": "success", "message": "Account created. Check your email to verify your account before logging in."}


@router.get("/verify")
async def verify_email(token: str, db: AsyncSession = Depends(get_db_session)):
    try:
        user_id = decode_token(token, expected_purpose="verify_email")
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification link.")

    user = (await db.execute(select(UserORM).where(UserORM.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")

    user.is_verified = True
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {"status": "success", "message": "Email verified. You can now log in."}


@router.post("/login")
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db_session)):
    # Deliberately the same generic error for "no such user" and "wrong
    # password" - distinguishing them lets an attacker enumerate accounts.
    invalid_credentials = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    user = (await db.execute(select(UserORM).where(UserORM.email == request.email))).scalar_one_or_none()
    if not user or not verify_password(request.password, user.password_hash):
        raise invalid_credentials

    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email before logging in.")

    access_token = create_access_token(user.id)
    return {"status": "success", "access_token": access_token, "token_type": "bearer", "user": _user_payload(user)}


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: AsyncSession = Depends(get_db_session)):
    """Always returns the same generic response whether or not the email is
    registered, so this endpoint can't be used to enumerate accounts."""
    user = (await db.execute(select(UserORM).where(UserORM.email == request.email))).scalar_one_or_none()
    if user:
        reset_token = create_password_reset_token(user.id)
        send_password_reset_email(user.email, f"{FRONTEND_URL}/?reset_token={reset_token}")

    return {"status": "success", "message": "If an account with that email exists, a password reset link has been sent."}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: AsyncSession = Depends(get_db_session)):
    try:
        user_id = decode_token(request.token, expected_purpose="reset_password")
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset link.")

    user = (await db.execute(select(UserORM).where(UserORM.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")

    user.password_hash = hash_password(request.new_password)
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()

    return {"status": "success", "message": "Password reset. You can now log in with your new password."}


@router.get("/me")
async def get_me(current_user: UserORM = Depends(get_current_user)):
    return _user_payload(current_user)
