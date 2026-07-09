from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.persistence.database import async_session_maker
from infrastructure.persistence.unit_of_work import SQLUnitOfWork
from infrastructure.storage.local_storage import LocalStorageService
from infrastructure.events.local_dispatcher import LocalEventDispatcher
from infrastructure.identity.jwt_provider import JWTIdentityProvider

from application.ports.unit_of_work import IUnitOfWork
from application.ports.services import IStorageService, IIdentityProvider
from application.ports.events import IEventDispatcher

from application.use_cases.upload_evidence import UploadEvidenceUseCase
from application.use_cases.case_management import CreateCaseUseCase

# --- Infrastructure Providers ---

async def get_db_session() -> AsyncSession:
    async with async_session_maker() as session:
        yield session

def get_uow(session: AsyncSession = Depends(get_db_session)) -> IUnitOfWork:
    # We pass the session factory to the UoW
    return SQLUnitOfWork(async_session_maker)

def get_storage_service() -> IStorageService:
    return LocalStorageService(base_dir="/app/storage_vault")

def get_event_dispatcher() -> IEventDispatcher:
    # In Phase 1, this is a singleton in-memory dispatcher.
    # In a real deployment, this would inject a Redis/Kafka client.
    return LocalEventDispatcher()

def get_identity_provider(request: Request) -> IIdentityProvider:
    # Extracts the JWT from the incoming FastAPI request context
    return JWTIdentityProvider()

# --- Mock Implementations for Phase 1 ---
# (To be replaced with concrete implementations as built out)
class SimpleHashService:
    async def generate_sha256(self, file_stream) -> str:
        import hashlib
        file_bytes = file_stream.read()
        file_stream.seek(0)
        return hashlib.sha256(file_bytes).hexdigest()

class SimpleClock:
    def utcnow(self):
        from datetime import datetime, timezone
        return datetime.now(timezone.utc)

def get_hash_service(): return SimpleHashService()
def get_clock(): return SimpleClock()

# --- Use Case Factories ---

def get_upload_evidence_use_case(
    uow: IUnitOfWork = Depends(get_uow),
    storage: IStorageService = Depends(get_storage_service),
    hasher = Depends(get_hash_service),
    clock = Depends(get_clock),
    dispatcher: IEventDispatcher = Depends(get_event_dispatcher)
) -> UploadEvidenceUseCase:
    return UploadEvidenceUseCase(uow, storage, hasher, clock, dispatcher)

def get_create_case_use_case(
    uow: IUnitOfWork = Depends(get_uow),
    identity: IIdentityProvider = Depends(get_identity_provider),
    clock = Depends(get_clock)
) -> CreateCaseUseCase:
    return CreateCaseUseCase(uow, identity, clock)