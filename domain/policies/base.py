from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from domain.correlation import EvidenceGraph
from domain.models import TrustLevel, Disposition


@dataclass(slots=True)
class PolicyResult:
    triggered: bool
    status_override: Optional[str] = None
    trust_level: Optional[TrustLevel] = None
    disposition: Optional[Disposition] = None
    rationale: Optional[str] = None
    recommendation: Optional[str] = None
    is_conflict: bool = False


class EvaluationPolicy(ABC):
    """
    Base contract for all correlation rules.
    Operates on the entire Evidence Graph to make judgments.
    """
    @abstractmethod
    def evaluate(self, graph: EvidenceGraph) -> PolicyResult:
        pass