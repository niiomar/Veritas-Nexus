from uuid import UUID
from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domain.models import Case, CasePriority, CaseStatus
from application.ports.repositories import ICaseRepository
from infrastructure.persistence.models import CaseORM

class SQLCaseRepository(ICaseRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def add(self, case: Case) -> None:
        orm_case = CaseORM(
            id=case.case_id,
            case_number=case.case_number,
            title=case.title,
            description=case.description,
            priority=case.priority,
            status=case.status,
            created_by=case.created_by,
            created_at=case.created_at,
            updated_at=case.updated_at,
            tags=case.tags
        )
        self._session.add(orm_case)

    async def update(self, case: Case) -> None:
        stmt = select(CaseORM).where(CaseORM.id == case.case_id)
        result = await self._session.execute(stmt)
        orm_case = result.scalar_one_or_none()
        
        if orm_case:
            orm_case.status = case.status
            orm_case.priority = case.priority
            orm_case.updated_at = case.updated_at
            orm_case.tags = case.tags

    async def get(self, case_id: UUID) -> Optional[Case]:
        stmt = select(CaseORM).where(CaseORM.id == case_id)
        result = await self._session.execute(stmt)
        orm_case = result.scalar_one_or_none()

        if not orm_case:
            return None

        return Case(
            case_id=orm_case.id,
            case_number=orm_case.case_number,
            title=orm_case.title,
            description=orm_case.description,
            priority=CasePriority(orm_case.priority.value),
            status=CaseStatus(orm_case.status.value),
            created_by=orm_case.created_by,
            created_at=orm_case.created_at,
            updated_at=orm_case.updated_at,
            tags=orm_case.tags,
            evidence_ids=[] # Hydrated via separate query or specific relationship load if needed
        )

    async def find_by_case_number(self, case_number: str) -> Optional[Case]:
        stmt = select(CaseORM).where(CaseORM.case_number == case_number)
        result = await self._session.execute(stmt)
        orm_case = result.scalar_one_or_none()
        return self.get(orm_case.id) if orm_case else None

    async def list_open_cases(self) -> List[Case]:
        stmt = select(CaseORM).where(CaseORM.status == CaseStatus.OPEN)
        result = await self._session.execute(stmt)
        return [await self.get(orm.id) for orm in result.scalars().all()]

    async def archive(self, case_id: UUID) -> None:
        stmt = select(CaseORM).where(CaseORM.id == case_id)
        result = await self._session.execute(stmt)
        orm_case = result.scalar_one_or_none()
        if orm_case:
            orm_case.status = CaseStatus.ARCHIVED