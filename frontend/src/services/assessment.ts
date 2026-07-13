// src/services/assessment.ts
import type { Evidence, EvidenceAssessment } from '../types';

export const AssessmentEngine = {
  evaluate: (evidence: Evidence): EvidenceAssessment => {
    if (!evidence.ai_report) return { verdict: "EVALUATING", conf: "--", type: "neutral", msg: "Evaluating Pipeline...", policy: "Pending" };
    
    const prob = evidence.ai_report.deepfake_probability;
    const c2pa = evidence.ai_report.c2pa_data;

    if (prob === null) {
        if (c2pa?.status === 'VALID') return { verdict: "TRUSTED", conf: "N/A", type: "trust", msg: "ViT-CORE Bypassed", policy: "CryptoProvenance_v1" };
        if (c2pa?.is_signed) return { verdict: "CONFLICT", conf: "N/A", type: "review", msg: "ViT-CORE Bypassed", policy: "BrokenSignatureReview_v1" };
        return { verdict: "UNKNOWN", conf: "N/A", type: "neutral", msg: "Engines Offline", policy: "NoTelemetry_v1" };
    }
    
    if (prob < 0.15) return { verdict: "HIGH TRUST", conf: ((1 - prob) * 100).toFixed(1), type: "trust", msg: "Authentic Distribution", policy: "StandardAuthenticity_v1.2" };
    if (prob < 0.70) return { verdict: "CONFLICT", conf: (prob * 100).toFixed(1), type: "review", msg: "Anomalies Detected", policy: "AnomalyReview_v1.0" };
    
    return { verdict: "QUARANTINE", conf: (prob * 100).toFixed(1), type: "crit", msg: "Synthetic Match", policy: "CriticalThreshold_v2.1" };
  }
};