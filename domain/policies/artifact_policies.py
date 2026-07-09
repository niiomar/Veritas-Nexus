from domain.correlation import EvidenceGraph, FindingCategory, FindingSeverity
from domain.models import TrustLevel, Disposition
from domain.policies.base import EvaluationPolicy, PolicyResult


class ConflictingEvidencePolicy(EvaluationPolicy):
    """
    Acts as a circuit breaker. Triggers if strong cryptography exists alongside 
    strong ML detections of synthetic artifacts.
    """
    def evaluate(self, graph: EvidenceGraph) -> PolicyResult:
        synthetic_findings = graph.get_findings_by_category(FindingCategory.SYNTHETIC_ARTIFACT)
        provenance_findings = graph.get_findings_by_category(FindingCategory.PROVENANCE)
        
        has_ml_fail = any(f.severity == FindingSeverity.CRITICAL for f in synthetic_findings)
        has_crypto_pass = any(f.severity == FindingSeverity.INFO for f in provenance_findings)
        
        if has_ml_fail and has_crypto_pass:
            return PolicyResult(
                triggered=True,
                status_override="CONFLICTING_EVIDENCE",
                trust_level=TrustLevel.LOW,
                disposition=Disposition.ESCALATE,
                rationale="Cryptographic provenance is intact, but forensic analysis detected strong synthetic artifacts.",
                recommendation="ESCALATE: Manual analyst review required. Investigate potential signing of manipulated media.",
                is_conflict=True
            )
        return PolicyResult(triggered=False)


class CriticalArtifactDetectedPolicy(EvaluationPolicy):
    """
    Standard policy for severe deepfake detection.
    """
    def evaluate(self, graph: EvidenceGraph) -> PolicyResult:
        if graph.has_critical_findings():
            # Extract highest confidence critical finding for the rationale
            criticals = [f for f in graph.findings if f.severity == FindingSeverity.CRITICAL]
            highest_conf = sorted(criticals, key=lambda x: x.confidence, reverse=True)[0]

            return PolicyResult(
                triggered=True,
                status_override="MANIPULATION_DETECTED",
                trust_level=TrustLevel.LOW,
                disposition=Disposition.REJECTED,
                rationale=f"Critical synthetic artifacts detected ({highest_conf.subtype.value}).",
                recommendation="Asset fails authenticity checks. Discard or isolate as adversarial evidence.",
                is_conflict=False
            )
        return PolicyResult(triggered=False)