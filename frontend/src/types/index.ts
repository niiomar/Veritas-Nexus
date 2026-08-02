// Matches the backend's CasePriority enum (domain/models.py used to define this
// before it was removed; api/routers/cases.py is the live source of truth now).
// This used to say "Critical" | "High" | "Routine", which never matched what
// CreateCaseModal/EditCaseModal actually send - it provided no real type safety.
export type ThreatPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Case {
  id: string;
  name: string;
  alias: string;
  analyst: string;
  priority: ThreatPriority;
  created_by?: string;
  created: string;
  count: number;
  deleted_at?: string;
  purge_at?: string;
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
  timestamp: string | null;
  error?: string | null;
  manifest_history?: C2PAAction[];
}

export interface AIReport {
  deepfake_probability: number | null;
  c2pa_data: C2PAData | null;
  platform_status: string;
  disposition: string;
  threat_summary: string | null;
  // Present on anything scored since server-side scoring was introduced;
  // absent on older records - api/routers/reports.py 409s without it, so
  // the frontend checks for it before offering to generate a report.
  assessment?: unknown;
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
  deleted_at?: string;
  purge_at?: string;
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

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  is_verified: boolean;
}
