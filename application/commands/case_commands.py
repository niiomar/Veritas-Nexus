from dataclasses import dataclass
from typing import Optional
from uuid import UUID

@dataclass(slots=True, frozen=True)
class CreateCaseCommand:
    title: str
    description: Optional[str]
    priority: str

@dataclass(slots=True, frozen=True)
class CloseCaseCommand:
    case_id: UUID
    closed_by: str