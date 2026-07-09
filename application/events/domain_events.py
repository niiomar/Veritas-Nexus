from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID, uuid4

@dataclass(slots=True, frozen=True)
class DomainEvent:
    evidence_id: UUID
    event_id: UUID
    occurred_at: datetime

    @classmethod
    def create_base(cls, evidence_id: UUID):
        """Helper to create the base fields for any event."""
        return {
            "evidence_id": evidence_id,
            "event_id": uuid4(),
            "occurred_at": datetime.now(timezone.utc)
        }

@dataclass(slots=True, frozen=True)
class EvidenceUploadedEvent(DomainEvent):
    case_id: UUID
    storage_uri: str

@dataclass(slots=True, frozen=True)
class AnalysisJobStartedEvent(DomainEvent):
    job_id: UUID

@dataclass(slots=True, frozen=True)
class AnalysisJobCompletedEvent(DomainEvent):
    job_id: UUID
    assessment_id: UUID