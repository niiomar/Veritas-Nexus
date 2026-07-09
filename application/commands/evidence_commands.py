from dataclasses import dataclass
from uuid import UUID

@dataclass(slots=True, frozen=True)
class UploadEvidenceCommand:
    case_id: UUID
    filename: str
    original_filename: str
    mime_type: str
    uploaded_by: str

@dataclass(slots=True, frozen=True)
class ProcessEvidenceCommand:
    job_id: UUID
    evidence_id: UUID