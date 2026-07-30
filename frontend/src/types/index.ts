export type ThreatPriority = "Critical" | "High" | "Routine";

export interface Case {
  id: string;
  name: string;
  alias: string;
  analyst: string;
  priority: ThreatPriority;
  created: string;
  count: number;
}

export type ProvenanceStatus = "VALID" | "INVALID" | "UNSIGNED" | "PARTIAL";

export interface C2PAAction {
  action: string;
  agent: string;
  timestamp: string;
  description: string;
}

export interface C2PAData {
  is_signed: boolean;
  status: ProvenanceStatus;
  raw_status: string;
  issuer: string | null;
  algorithm: string | null;
  timestamp: string | null; // Changed to string to handle actual UTC dates
  error?: string | null;
  manifest_history?: C2PAAction[]; // added for the Provenance Graph
}

export interface AIReport {
  deepfake_probability: number | null;
  c2pa_data: C2PAData | null;
  platform_status: string;
  disposition: string;
  threat_summary: string | null;
}

export type EvidenceStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface Evidence {
  id: string;
  case_id: string;
  filename: string;
  sha256: string;
  status: EvidenceStatus;
  storage_uri: string;
  uploaded_by: string;
  uploaded_at: string; 
  created_at?: string; 
  upload_date?: string; 
  ai_report: AIReport | null;
}

export type AssessmentType = "trust" | "review" | "crit" | "neutral";

export interface EvidenceAssessment {
  verdict: string;
  conf: string;
  type: AssessmentType;
  msg: string;
  policy: string;
}

export interface EngineStatus {
  vit: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  c2pa: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
}
