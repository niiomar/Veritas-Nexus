// src/services/assessment.ts
import type { Evidence, EvidenceAssessment } from '../types';

export interface EvidenceMatrixItem {
  evidence: string;
  weight: number;
  effect: 'Positive' | 'Warning' | 'Critical' | 'Neutral';
  category: 'Authenticity' | 'Provenance' | 'Structural';
}

export interface DetailedEvidenceAssessment extends EvidenceAssessment {
  matrix: EvidenceMatrixItem[];
  contributors: {
    authenticity: number;
    provenance: number;
    structural: number;
  };
}

export const AssessmentEngine = {
  evaluate: (evidence: Evidence): DetailedEvidenceAssessment => {
    if (!evidence.ai_report) {
      return { 
        verdict: "EVALUATING" as any, 
        conf: "--", 
        type: "neutral", 
        msg: "Evaluating Pipeline...", 
        policy: "Pending",
        matrix: [],
        contributors: { authenticity: 0, provenance: 0, structural: 0 }
      };
    }
    
    const prob = evidence.ai_report.deepfake_probability;
    const c2pa = evidence.ai_report.c2pa_data;
    // @ts-ignore
    const exif = evidence.metadata_dict?.exif;

    const matrix: EvidenceMatrixItem[] = [];
    let score = 50; 
    
    let authScore = 0;
    let provScore = 0;
    let structScore = 0;

    const addRule = (desc: string, weight: number, effect: 'Positive' | 'Warning' | 'Critical' | 'Neutral', category: 'Authenticity' | 'Provenance' | 'Structural') => {
      matrix.push({ evidence: desc, weight, effect, category });
      score += weight;
      if (category === 'Authenticity') authScore += weight;
      if (category === 'Provenance') provScore += weight;
      if (category === 'Structural') structScore += weight;
    };

    // --- PROVENANCE & AUTHENTICITY EVALUATION ---
    if (c2pa?.is_signed) {
        addRule("C2PA Cryptographic Signature Present", 25, "Positive", "Authenticity");
        if (c2pa.status === "VALID") {
            addRule("C2PA Manifest Validated", 20, "Positive", "Authenticity");
        } else if (c2pa.status === "BROKEN_SIGNATURE") {
            addRule("C2PA Signature Tampered/Broken", -50, "Critical", "Provenance");
        }
    } else {
        addRule("No C2PA Provenance Found", -5, "Neutral", "Provenance");
    }

    if (exif) {
        if (exif.fingerprint?.make && exif.fingerprint.make !== 'Unknown') {
            addRule(`Original Hardware Identified (${exif.fingerprint.make})`, 10, "Positive", "Authenticity");
        }
        if (exif.anomalies?.likely_stripped) {
            addRule("Metadata Completely Stripped", -15, "Warning", "Provenance");
        }
        if (exif.anomalies?.likely_exported) {
            addRule("Export/Editor Signature Detected", -10, "Warning", "Provenance");
        }
        if (exif.anomalies?.social_media_origin) {
            addRule("Social Media Compression Signature", -5, "Neutral", "Provenance");
        }
    } else {
        addRule("No Standard EXIF Data Found", -10, "Warning", "Provenance");
    }

    // --- STRUCTURAL CONSISTENCY EVALUATION (ViT & CV) ---
    if (prob !== null) {
        if (prob < 0.20) {
            addRule("ViT Inference: High Structural Integrity", 25, "Positive", "Structural");
        } else if (prob > 0.70) {
            addRule("ViT Inference: Synthetic Artifacts Detected", -35, "Critical", "Structural");
        } else {
            addRule("ViT Inference: Inconclusive/Borderline", -5, "Neutral", "Structural");
        }
    } else {
        addRule("Neural Inference Unavailable (No Viable Subject)", 0, "Neutral", "Structural");
    }

    if (exif?.anomalies) {
        if (exif.anomalies.ela_anomaly) {
            addRule("Error Level Analysis (ELA) Mismatch", -20, "Critical", "Structural");
        }
        if (exif.anomalies.double_compression) {
            addRule("Double JPEG Compression Detected", -10, "Warning", "Structural");
        }
        if (exif.anomalies.color_profile_mismatch) {
            addRule("Color Profile Mismatch", -8, "Warning", "Structural");
        }
    }

    const finalScore = Math.max(0, Math.min(100, score));

    // --- DETERMINE FORENSIC VERDICT ---
    let verdict: any = 'UNVERIFIED';
    let type: 'trust' | 'neutral' | 'review' | 'crit' = 'neutral';
    let msg = "Insufficient Provenance";
    
    const hasMajorContradiction = (authScore > 15 && structScore <= -15) || (c2pa?.is_signed && c2pa?.status === "VALID" && prob !== null && prob > 0.70);
    const lacksInformation = matrix.length <= 4 && !c2pa?.is_signed && prob === null;

    if (hasMajorContradiction) {
        verdict = 'CONFLICT';
        type = 'review';
        msg = "Evidence Contradicts";
    } else if (lacksInformation) {
        verdict = 'INCONCLUSIVE';
        type = 'review';
        msg = "Evidence Insufficient";
    } else if (finalScore >= 80) {
        verdict = 'VERIFIED';
        type = 'trust';
        msg = "Authenticity Established";
    } else if (finalScore <= 35 || c2pa?.status === 'BROKEN_SIGNATURE') {
        verdict = 'CRITICAL';
        type = 'crit';
        msg = "Likely Manipulated";
    } else {
        verdict = 'UNVERIFIED';
        type = 'neutral';
        msg = "Insufficient Provenance";
    }

    return {
        verdict,
        conf: finalScore.toFixed(1),
        type,
        msg,
        policy: `WeightedMatrix_v3.0`,
        matrix,
        contributors: {
            authenticity: authScore,
            provenance: provScore,
            structural: structScore
        }
    };
  }
};
