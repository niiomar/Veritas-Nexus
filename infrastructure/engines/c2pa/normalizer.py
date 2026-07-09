from typing import List

from domain.models import AnalysisRun
from domain.correlation import Finding, FindingCategory, FindingSeverity, FindingSubtype

class C2paNormalizer:
    """
    Translates raw C2PA cryptographic output into standardized domain Findings.
    """
    
    def normalize(self, run: AnalysisRun) -> List[Finding]:
        findings = []
        
        # Scenario 1: Cryptographic signature is valid and intact
        if run.verdict == "VALID":
            issuer = run.payload.get("active_manifest", {}).get("issuer", "Unknown Issuer")
            findings.append(
                Finding(
                    evidence_id=run.evidence_id,
                    analysis_run_id=run.analysis_id,
                    category=FindingCategory.PROVENANCE,
                    subtype=FindingSubtype.GENERIC_MANIPULATION, # Using generic for a standard info log
                    severity=FindingSeverity.INFO,
                    confidence=1.0,
                    title="Valid Provenance Chain",
                    description=f"Cryptographic chain is intact and verified. Issued by: {issuer}.",
                    engine_name="C2PA-Veritas",
                    engine_version="1.4.0",
                    source="Embedded Manifest",
                    metadata={"issuer": issuer}
                )
            )
            
            # Extract and normalize sequence invariants (Omission Detection) if present
            seq = run.payload.get("active_manifest", {}).get("sequence_invariants")
            if seq:
                expected = seq.get("expected_count")
                actual = seq.get("actual_count")
                
                if actual < expected:
                    findings.append(
                        Finding(
                            evidence_id=run.evidence_id,
                            analysis_run_id=run.analysis_id,
                            category=FindingCategory.PROVENANCE,
                            subtype=FindingSubtype.GENERIC_MANIPULATION,
                            severity=FindingSeverity.CRITICAL,
                            confidence=1.0,
                            title="Sequence Omission Detected",
                            description=f"Cryptographic sequence broken. Expected {expected} assets in batch, but only found {actual}.",
                            engine_name="C2PA-Veritas",
                            engine_version="1.4.0",
                            source="Sequence Invariant Assertion",
                            metadata={"batch_id": seq.get("batch_id")}
                        )
                    )

        # Scenario 2: File has no cryptographic manifest (stripped or never signed)
        elif run.verdict == "NO_MANIFEST":
            findings.append(
                Finding(
                    evidence_id=run.evidence_id,
                    analysis_run_id=run.analysis_id,
                    category=FindingCategory.PROVENANCE,
                    subtype=FindingSubtype.MISSING_MANIFEST,
                    severity=FindingSeverity.WARNING,
                    confidence=1.0,
                    title="Missing Content Credentials",
                    description="No digital provenance data detected. The asset is completely unsigned.",
                    engine_name="C2PA-Veritas",
                    engine_version="1.4.0"
                )
            )
            
        # Scenario 3: Signature validation failed (tampering detected)
        elif run.verdict == "INVALID":
            findings.append(
                Finding(
                    evidence_id=run.evidence_id,
                    analysis_run_id=run.analysis_id,
                    category=FindingCategory.PROVENANCE,
                    subtype=FindingSubtype.INVALID_SIGNATURE,
                    severity=FindingSeverity.CRITICAL,
                    confidence=1.0,
                    title="Cryptographic Tampering Detected",
                    description="Signature validation failed. The asset's pixels or metadata were altered post-signing.",
                    engine_name="C2PA-Veritas",
                    engine_version="1.4.0",
                    source="Signature Validator"
                )
            )
            
        return findings