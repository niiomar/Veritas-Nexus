from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

def _now() -> datetime:
    return datetime.now(timezone.utc)

# Enums
class CasePriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class CaseStatus(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    CLOSED = "CLOSED"
    ARCHIVED = "ARCHIVED"

class AnalysisStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"

class TrustLevel(str, Enum):
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LOW = "LOW"
    UNKNOWN = "UNKNOWN"

class Disposition(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ESCALATE = "ESCALATE"
    MANUAL_REVIEW = "MANUAL_REVIEW"

class EngineId(str, Enum):
    VIT_CORE = "VIT_CORE"
    C2PA = "C2PA"
    AUDIO = "AUDIO"
    OCR = "OCR"

class JobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

# Entities
@dataclass(slots=True)
class Case:
    case_id: UUID = field(default_factory=uuid4)
    case_number: str = ""
    title: str = ""
    description: Optional[str] = None
    priority: CasePriority = CasePriority.MEDIUM
    status: CaseStatus = CaseStatus.OPEN
    created_by: str = ""
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime = field(default_factory=_now)
    tags: List[str] = field(default_factory=list)
    evidence_ids: List[UUID] = field(default_factory=list)

@dataclass(slots=True)
class Evidence:
    evidence_id: UUID = field(default_factory=uuid4)
    case_id: UUID = field(default_factory=uuid4)
    filename: str = ""
    original_filename: str = ""
    mime_type: str = ""
    file_size: int = 0
    sha256: str = ""
    uploaded_by: str = ""
    uploaded_at: datetime = field(default_factory=_now)
    storage_uri: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    labels: List[str] = field(default_factory=list)
    current_assessment_id: Optional[UUID] = None

@dataclass(slots=True)
class AnalysisJob:
    job_id: UUID = field(default_factory=uuid4)
    evidence_id: UUID = field(default_factory=uuid4)
    status: JobStatus = JobStatus.QUEUED
    priority: int = 1
    engines_requested: List[EngineId] = field(default_factory=list)
    engines_completed: List[EngineId] = field(default_factory=list)
    created_at: datetime = field(default_factory=_now)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    retry_count: int = 0
    failure_reason: Optional[str] = None

@dataclass(slots=True)
class EngineManifest:
    manifest_id: UUID = field(default_factory=uuid4)
    engine_id: EngineId = EngineId.VIT_CORE
    engine_version: str = ""
    model_version: str = ""
    weights_sha256: str = ""
    git_commit: str = ""
    python_version: str = ""
    torch_version: Optional[str] = None
    cuda_version: Optional[str] = None
    build_timestamp: datetime = field(default_factory=_now)
    supported_media: List[str] = field(default_factory=list)
    supported_features: List[str] = field(default_factory=list)

@dataclass(slots=True, frozen=True)
class AnalysisRun:
    analysis_id: UUID = field(default_factory=uuid4)
    evidence_id: UUID = field(default_factory=uuid4)
    engine_manifest_id: UUID = field(default_factory=uuid4)
    started_at: datetime = field(default_factory=_now)
    completed_at: datetime = field(default_factory=_now)
    duration_ms: int = 0
    status: AnalysisStatus = AnalysisStatus.PENDING
    verdict: str = ""
    confidence: float = 0.0
    payload: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

@dataclass(slots=True, frozen=True)
class AuthenticityAssessment:
    assessment_id: UUID = field(default_factory=uuid4)
    evidence_id: UUID = field(default_factory=uuid4)
    generated_at: datetime = field(default_factory=_now)
    generated_by: str = ""
    overall_status: str = ""
    trust_level: TrustLevel = TrustLevel.UNKNOWN
    disposition: Disposition = Disposition.MANUAL_REVIEW
    confidence: float = 0.0
    rationale: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    conflicts: List[str] = field(default_factory=list)
    evidence_sources: List[str] = field(default_factory=list)
    related_analysis_runs: List[UUID] = field(default_factory=list)

@dataclass(slots=True, frozen=True)
class Report:
    report_id: UUID = field(default_factory=uuid4)
    evidence_id: UUID = field(default_factory=uuid4)
    assessment_id: UUID = field(default_factory=uuid4)
    report_type: str = ""
    generated_at: datetime = field(default_factory=_now)
    generated_by: str = ""
    storage_uri: str = ""
    sha256: str = ""

@dataclass(slots=True, frozen=True)
class AuditEvent:
    event_id: UUID = field(default_factory=uuid4)
    timestamp: datetime = field(default_factory=_now)
    actor: str = ""
    action: str = ""
    resource_type: str = ""
    resource_id: UUID = field(default_factory=uuid4)
    metadata: Dict[str, Any] = field(default_factory=dict)
