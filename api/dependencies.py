import os
import secrets
import logging

from dotenv import load_dotenv
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.persistence.database import async_session_maker

load_dotenv()

logger = logging.getLogger("Dependencies")

# --- Database session ---

async def get_db_session() -> AsyncSession:
    async with async_session_maker() as session:
        yield session

# --- Shared-secret API key gate ---
# Stopgap authorization for state-changing routes: not per-user auth, just a
# shared secret that keeps opportunistic/automated traffic off the raw API.
# See PLATFORM_API_KEY in .env.example.

PLATFORM_API_KEY = os.getenv("PLATFORM_API_KEY")

if not PLATFORM_API_KEY:
    logger.warning("PLATFORM_API_KEY is not set - all API-key-gated routes will reject every request.")

async def require_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> None:
    if not PLATFORM_API_KEY or not x_api_key or not secrets.compare_digest(x_api_key, PLATFORM_API_KEY):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid API key.")
