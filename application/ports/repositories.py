from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID
from domain.models import Case, Evidence, AnalysisRun, AuthenticityAssessment, AuditEvent, AnalysisJob

class ICaseRepository(ABC):
    @abstractmethod
    async def add(self, case: Case) -> None: pass

    @abstractmethod
    async def update(self, case: Case) -> None: pass

    @abstractmethod
    async def get(self, case_id: UUID) -> Optional[Case]: pass

class IEvidenceRepository(ABC):
    @abstractmethod
    async def add(self, evidence: Evidence) -> None: pass

    @abstractmethod
    async def update(self, evidence: Evidence) -> None: pass

    @abstractmethod
    async def get(self, evidence_id: UUID) -> Optional[Evidence]: pass

class IAnalysisRepository(ABC):
    @abstractmethod
    async def add_run(self, run: AnalysisRun) -> None: pass

    @abstractmethod
    async def get_runs_for_evidence(self, evidence_id: UUID) -> List[AnalysisRun]: pass

    @abstractmethod
    async def add_assessment(self, assessment: AuthenticityAssessment) -> None: pass

class IJobRepository(ABC):
    @abstractmethod
    async def add(self, job: AnalysisJob) -> None: pass

    @abstractmethod
    async def update(self, job: AnalysisJob) -> None: pass

    @abstractmethod
    async def get(self, job_id: UUID) -> Optional[AnalysisJob]: pass

class IAuditRepository(ABC):
    @abstractmethod
    async def add(self, event: AuditEvent) -> None: pass
