from abc import ABC, abstractmethod
from types import TracebackType
from typing import Optional, Type

from application.ports.repositories import (
    ICaseRepository, 
    IEvidenceRepository, 
    IAnalysisRepository, 
    IJobRepository, 
    IAuditRepository
)

class IUnitOfWork(ABC):
    cases: ICaseRepository
    evidence: IEvidenceRepository
    analysis: IAnalysisRepository
    jobs: IJobRepository
    audit: IAuditRepository

    async def __aenter__(self) -> 'IUnitOfWork':
        return self

    async def __aexit__(
        self, 
        exc_type: Optional[Type[BaseException]], 
        exc_val: Optional[BaseException], 
        exc_tb: Optional[TracebackType]
    ) -> None:
        if exc_type is not None:
            await self.rollback()
        else:
            await self.commit()

    @abstractmethod
    async def commit(self) -> None:
        pass

    @abstractmethod
    async def rollback(self) -> None:
        pass