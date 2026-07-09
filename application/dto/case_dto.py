from dataclasses import dataclass
from datetime import datetime
from typing import List
from uuid import UUID

@dataclass(slots=True)
class CaseDTO:
    case_id: UUID
    case_number: str
    title: str
    priority: str
    status: str
    created_at: datetime
    evidence_count: int
    tags: List[str]