// src/services/assessment.ts
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

export const AssessmentEngine = {
  evaluate: (evidence: Evidence): DetailedEvidenceAssessment => {
    if (!evidence?.ai_report) {
      return { 
        verdict: "EVALUATING" as any, 
        conf: "--", 
        type: "neutral", 
        msg: "Evaluating Pipeline...", 
        policy: "Pending",
        domains: [],
        totalScore: 0
      };
    }
    
    const prob = evidence.ai_report.deepfake_probability;
    const c2pa = evidence.ai_report.c2pa_data;
    // @ts-ignore
    const exif = evidence.metadata_dict?.exif;

    // Domain 1: Cryptographic Provenance (Max 30)
    let provScore = 0;
    let provEv: DomainEvidence[] = [];
    if (c2pa?.is_signed) {
        if (c2pa.status === "VALID") {
            provScore = 30;
            provEv.push({ text: "Valid C2PA Manifest & Signature", effect: 'Positive', pts: 30 });
        } else if (c2pa.status === "BROKEN_SIGNATURE") {
            provScore = 0;
            provEv.push({ text: "Signature Tampered / Broken", effect: 'Negative', pts: 0 });
        } else {
            provScore = 15;
            provEv.push({ text: "Partial/Invalid C2PA Manifest", effect: 'Warning', pts: 15 });
        }
    } else {
        provScore = 0;
        provEv.push({ text: "No Cryptographic Signature", effect: 'Neutral', pts: 0 });
    }

    // Domain 2: AI Authenticity (Max 25)
    let aiScore = 0;
    let aiEv: DomainEvidence[] = [];
    if (prob !== null && prob !== undefined) {
        if (prob < 0.15) {
            aiScore = 25;
            aiEv.push({ text: "ViT Inference: Clean (No anomalies)", effect: 'Positive', pts: 25 });
        } else if (prob < 0.40) {
            aiScore = 15;
            aiEv.push({ text: "ViT Inference: Minor artifacts", effect: 'Warning', pts: 15 });
        } else if (prob < 0.70) {
            aiScore = 5;
            aiEv.push({ text: "ViT Inference: Suspicious regions", effect: 'Warning', pts: 5 });
        } else {
            aiScore = 0;
            aiEv.push({ text: "ViT Inference: Synthetic/Deepfake", effect: 'Negative', pts: 0 });
        }
    } else {
        aiScore = 0;
        aiEv.push({ text: "Inference Unavailable (Faceless)", effect: 'Neutral', pts: 0 });
    }

    // Domain 3: Metadata Integrity (Max 15)
    let metaScore = 0;
    let metaEv: DomainEvidence[] = [];
    if (exif && !exif.anomalies?.likely_stripped) {
        metaScore += 5;
        metaEv.push({ text: "EXIF Profile Present", effect: 'Positive', pts: 5 });
        if (exif.anomalies?.gps_present) {
            metaScore += 5;
            metaEv.push({ text: "GPS Coordinates Embedded", effect: 'Positive', pts: 5 });
        } else {
            metaEv.push({ text: "No GPS Data", effect: 'Neutral', pts: 0 });
        }
        if (exif.anomalies?.makernotes_present) {
            metaScore += 5;
            metaEv.push({ text: "Raw MakerNotes Intact", effect: 'Positive', pts: 5 });
        } else {
            metaEv.push({ text: "No MakerNotes", effect: 'Neutral', pts: 0 });
        }
    } else {
        metaScore = 0;
        metaEv.push({ text: "Metadata Completely Stripped", effect: 'Negative', pts: 0 });
    }

    // Domain 4: Structural Consistency (Max 15)
    let structScore = 15;
    let structEv: DomainEvidence[] = [];
    if (exif?.anomalies) {
        let clean = true;
        if (exif.anomalies.ela_anomaly) {
            structScore -= 10;
            structEv.push({ text: "Error Level Analysis (ELA) Mismatch", effect: 'Negative', pts: -10 });
            clean = false;
        }
        if (exif.anomalies.double_compression) {
            structScore -= 5;
            structEv.push({ text: "Double JPEG Compression", effect: 'Warning', pts: -5 });
            clean = false;
        }
        if (exif.anomalies.color_profile_mismatch) {
            structScore -= 5;
            structEv.push({ text: "Color Profile Mismatch", effect: 'Warning', pts: -5 });
            clean = false;
        }
        if (clean) {
            structEv.push({ text: "File Structure & Quantization Consistent", effect: 'Positive', pts: 15 });
        }
    } else {
        structScore = 5;
        structEv.push({ text: "Insufficient Structural Data", effect: 'Neutral', pts: 5 });
    }
    structScore = Math.max(0, structScore);

    // Domain 5: Chain of Custody (Max 10)
    let cocScore = 10;
    let cocEv: DomainEvidence[] = [];
    if (exif?.anomalies) {
        let clean = true;
        if (exif.anomalies.likely_exported) {
            cocScore -= 5;
            cocEv.push({ text: `Export Pipeline: ${exif.fingerprint?.software || 'Unknown'}`, effect: 'Warning', pts: -5 });
            clean = false;
        }
        if (exif.anomalies.social_media_origin) {
            cocScore -= 5;
            cocEv.push({ text: "Social Media Platform Origin", effect: 'Warning', pts: -5 });
            clean = false;
        }
        if (clean) {
            cocEv.push({ text: "No Destructive Exports Detected", effect: 'Positive', pts: 10 });
        }
    } else {
        cocScore = 0;
        cocEv.push({ text: "Custody Traces Unavailable", effect: 'Neutral', pts: 0 });
    }
    cocScore = Math.max(0, cocScore);

    // Domain 6: Contextual Correlation (Max 5)
    let corrScore = 0;
    let corrEv: DomainEvidence[] = [];
    if (exif?.fingerprint?.make && exif.fingerprint.make !== 'Unknown') {
        corrScore = 5;
        corrEv.push({ text: `Sensor Identified: ${exif.fingerprint.make}`, effect: 'Positive', pts: 5 });
    } else if (exif?.extended?.phash) {
        corrScore = 3;
        corrEv.push({ text: "Visual DNA (pHash) Extracted", effect: 'Positive', pts: 3 });
    } else {
        corrEv.push({ text: "No Contextual Anchors", effect: 'Neutral', pts: 0 });
    }

    const totalScore = provScore + aiScore + metaScore + structScore + cocScore + corrScore;

    // Verdict Logic
    let verdict: any = 'UNVERIFIED';
    let type: 'trust' | 'neutral' | 'review' | 'crit' = 'neutral';
    let msg = "Insufficient Provenance";
    
    const hasMajorContradiction = (c2pa?.is_signed && c2pa?.status === "VALID" && prob !== null && prob > 0.70);
    const isCrit = (prob !== null && prob > 0.70) || c2pa?.status === "BROKEN_SIGNATURE";

    if (hasMajorContradiction) {
        verdict = 'CONFLICT'; type = 'review'; msg = "Evidence Contradicts";
    } else if (isCrit) {
        verdict = 'CRITICAL'; type = 'crit'; msg = "Likely Manipulated";
    } else if (totalScore >= 75) {
        verdict = 'VERIFIED'; type = 'trust'; msg = "Authenticity Established";
    } else if (totalScore >= 40) {
        verdict = 'UNVERIFIED'; type = 'neutral'; msg = "Insufficient Provenance";
    } else {
        verdict = 'INCONCLUSIVE'; type = 'review'; msg = "Low Integrity Score";
    }

    return {
        verdict,
        conf: totalScore.toFixed(1),
        type,
        msg,
        policy: "Weighted_XAI_v4.0",
        domains: [
            { name: 'Cryptographic Provenance', score: provScore, max: 30, weight: 30, evidence: provEv },
            { name: 'AI Authenticity', score: aiScore, max: 25, weight: 25, evidence: aiEv },
            { name: 'Metadata Integrity', score: metaScore, max: 15, weight: 15, evidence: metaEv },
            { name: 'Structural Consistency', score: structScore, max: 15, weight: 15, evidence: structEv },
            { name: 'Chain of Custody', score: cocScore, max: 10, weight: 10, evidence: cocEv },
            { name: 'Contextual Correlation', score: corrScore, max: 5, weight: 5, evidence: corrEv }
        ],
        totalScore
    };
  }
};
