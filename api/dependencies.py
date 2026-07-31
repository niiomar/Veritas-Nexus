import logging

from dotenv import load_dotenv
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.persistence.database import async_session_maker
from infrastructure.persistence.models import UserORM
from api.services.auth_service import decode_token, InvalidTokenError

load_dotenv()

logger = logging.getLogger("Dependencies")

# --- Database session ---

async def get_db_session() -> AsyncSession:
    async with async_session_maker() as session:
        yield session

# --- Per-user authentication ---
# Replaces the earlier shared PLATFORM_API_KEY stopgap: every state-changing
# route now requires a real logged-in user (api/routers/auth.py issues the
# JWT on login), and actions get attributed to that user instead of a
# client-supplied name or "SYSTEM".

async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db_session),
) -> UserORM:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header.")

    token = authorization.removeprefix("Bearer ").strip()
    try:
        user_id = decode_token(token, expected_purpose="access")
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.")

    user = (await db.execute(select(UserORM).where(UserORM.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return user
