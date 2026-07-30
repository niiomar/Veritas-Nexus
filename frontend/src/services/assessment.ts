
import type { Evidence, EvidenceAssessment } from '../types';

export interface DomainEvidence {
  text: string;
  effect: 'Positive' | 'Negative' | 'Neutral' | 'Warning';
  pts: number;
}

export interface DomainScore {
  name: string;
  score: number;
  max: number;
  weight: number;
  evidence: DomainEvidence[];
}

export interface DetailedEvidenceAssessment extends EvidenceAssessment {
  domains: DomainScore[];
  totalScore: number;
}

const EVALUATING: DetailedEvidenceAssessment = {
  verdict: "EVALUATING" as EvidenceAssessment['verdict'],
  conf: "--",
  type: "neutral",
  msg: "Evaluating Pipeline...",
  policy: "Pending",
  domains: [],
  totalScore: 0
};

// Evidence analyzed before the scoring engine moved server-side has no
// stored `assessment` payload to render - it needs to be re-analyzed rather
// than silently guessed at again on the client.
const LEGACY_FALLBACK: DetailedEvidenceAssessment = {
  verdict: "UNVERIFIED" as EvidenceAssessment['verdict'],
  conf: "N/A",
  type: "neutral",
  msg: "Assessment unavailable - re-run analysis to compute a score.",
  policy: "Pending",
  domains: [],
  totalScore: 0
};

export const AssessmentEngine = {
  // The weighted, explainable trust score used to be computed here in the
  // browser (see git history) - that meant the verdict for a piece of
  // forensic evidence could be recomputed or spoofed by anyone with devtools
  // open, and it silently drifted from the backend's own C2PA status values.
  // It's now computed once, server-side, at analysis completion time
  // (api/services/assessment_engine.py) and stored on the evidence record;
  // this just renders whatever the server decided.
  evaluate: (evidence: Evidence): DetailedEvidenceAssessment => {
    if (!evidence?.ai_report) {
      return EVALUATING;
    }
    const assessment = (evidence.ai_report as unknown as { assessment?: DetailedEvidenceAssessment }).assessment;
    return assessment ?? LEGACY_FALLBACK;
  }
};
