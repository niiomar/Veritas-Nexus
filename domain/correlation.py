from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from domain.models import Evidence, AnalysisRun, AuthenticityAssessment, AuditEvent

def _now() -> datetime:
    return datetime.now(timezone.utc)

class FindingCategory(str, Enum):
    PROVENANCE = "PROVENANCE"
    SYNTHETIC_ARTIFACT = "SYNTHETIC_ARTIFACT"
    METADATA_ANOMALY = "METADATA_ANOMALY"
    BIOMETRIC_MISMATCH = "BIOMETRIC_MISMATCH"
    STEGANOGRAPHY = "STEGANOGRAPHY"

class FindingSubtype(str, Enum):
    FACE_SWAP = "FACE_SWAP"
    VOICE_CLONE = "VOICE_CLONE"
    INVALID_SIGNATURE = "INVALID_SIGNATURE"
    MISSING_MANIFEST = "MISSING_MANIFEST"
    EXIF_MISMATCH = "EXIF_MISMATCH"
    EDITING_SOFTWARE_DETECTED = "EDITING_SOFTWARE_DETECTED"
    GENERIC_MANIPULATION = "GENERIC_MANIPULATION"

class FindingSeverity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"

@dataclass(slots=True, frozen=True)
class Finding:
    finding_id: UUID = field(default_factory=uuid4)
    evidence_id: UUID = field(default_factory=uuid4)
    analysis_run_id: UUID = field(default_factory=uuid4)
    
    category: FindingCategory = FindingCategory.SYNTHETIC_ARTIFACT
    subtype: FindingSubtype = FindingSubtype.GENERIC_MANIPULATION
    
    severity: FindingSeverity = FindingSeverity.INFO
    confidence: float = 0.0 
    
    title: str = ""
    description: str = ""
    
    engine_name: str = ""
    engine_version: str = ""
    
    source: Optional[str] = None       
    location: Optional[str] = None     
    
    metadata: Dict[str, Any] = field(default_factory=dict)
    references: List[str] = field(default_factory=list) 
    
    created_at: datetime = field(default_factory=_now)

@dataclass(slots=True)
class EvidenceGraph:
    evidence: Evidence
    analysis_runs: List[AnalysisRun] = field(default_factory=list)
    findings: List[Finding] = field(default_factory=list)
    assessment_history: List[AuthenticityAssessment] = field(default_factory=list)
    audit_trail: List[AuditEvent] = field(default_factory=list)
    related_evidence_ids: List[UUID] = field(default_factory=list)

    def get_findings_by_category(self, category: FindingCategory) -> List[Finding]:
        return [f for f in self.findings if f.category == category]

    def has_critical_findings(self) -> bool:
        return any(f.severity == FindingSeverity.CRITICAL for f in self.findings)
