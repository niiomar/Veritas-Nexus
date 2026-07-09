from domain.correlation import EvidenceGraph, FindingCategory, FindingSeverity
from domain.models import TrustLevel, Disposition
from domain.policies.base import EvaluationPolicy, PolicyResult


class UnsignedAuthenticPolicy(EvaluationPolicy):
    """
    Triggers when ML detects no manipulation, but cryptographic provenance is missing.
    Prevents safe files from being flagged as malicious purely due to lack of C2PA.
    """
    def evaluate(self, graph: EvidenceGraph) -> PolicyResult:
        synthetic_findings = graph.get_findings_by_category(FindingCategory.SYNTHETIC_ARTIFACT)
        provenance_findings = graph.get_findings_by_category(FindingCategory.PROVENANCE)
        
        has_ml_pass = any(f.severity == FindingSeverity.INFO for f in synthetic_findings)
        has_no_c2pa = any(f.severity == FindingSeverity.WARNING for f in provenance_findings)
        
        # Ensure no critical ML flags exist before granting moderate trust
        has_critical_ml = any(f.severity == FindingSeverity.CRITICAL for f in synthetic_findings)
        
        if has_ml_pass and has_no_c2pa and not has_critical_ml:
            return PolicyResult(
                triggered=True,
                status_override="UNSIGNED_AUTHENTIC",
                trust_level=TrustLevel.MODERATE,
                disposition=Disposition.APPROVED,
                rationale="Media appears authentic according to forensic analysis, however no Content Credentials are present.",
                recommendation="Proceed with standard verification. Lack of provenance does not indicate manipulation."
            )
        return PolicyResult(triggered=False)