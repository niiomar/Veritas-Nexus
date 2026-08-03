import { TokenStorage } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Real per-user auth (see services/auth.ts) superseded the old shared
// X-API-Key stopgap - every state-changing request now carries the logged-in
// user's JWT instead.
const authHeaders = (extra?: Record<string, string>) => {
  const token = TokenStorage.get();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
};

const parseFastAPIError = (errorData: any, defaultMessage: string) => {
  if (!errorData) return defaultMessage;
  if (typeof errorData.detail === 'string') return errorData.detail;
  if (Array.isArray(errorData.detail)) {
    return errorData.detail.map((err: any) => `Field '${err.loc[err.loc.length - 1]}': ${err.msg}`).join(' | ');
  }
  return defaultMessage;
};

export const EvidenceAPI = {
  fetchCases: async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/cases`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch case list');
    const data = await response.json();
    return Array.isArray(data) ? data : (data.cases || []);
  },

  fetchLibrary: async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/evidence/`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch evidence library');
    const data = await response.json();
    return Array.isArray(data) ? data : (data.evidence || []);
  },

  fetchDeletedCases: async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/cases?deleted_only=true`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch recently deleted cases');
    const data = await response.json();
    return Array.isArray(data) ? data : (data.cases || []);
  },

  fetchDeletedEvidence: async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/evidence/?deleted_only=true`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Failed to fetch recently deleted evidence');
    const data = await response.json();
    return Array.isArray(data) ? data : (data.evidence || []);
  },

  checkHealth: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/health`);
      if (!response.ok) throw new Error('Health check failed');
      const data = await response.json();
      return { vit: data.vit_status || 'OFFLINE', c2pa: data.c2pa_status || 'OFFLINE' };
    } catch (err) {
      return { vit: 'OFFLINE', c2pa: 'OFFLINE' };
    }
  },

  createCase: async (caseData: any) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/cases`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        title: caseData.name,
        alias: caseData.alias,
        priority: caseData.priority,
        analyst: caseData.analyst,
        description: `Investigation initialized by ${caseData.analyst}`
      }),
    });
    if (!response.ok) throw new Error(parseFastAPIError(await response.json().catch(()=>null), 'Failed to create case in PostgreSQL'));
    return response.json();
  },

  updateCase: async (caseId: string, caseData: any) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/cases/${caseId}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        title: caseData.name,
        alias: caseData.alias,
        priority: caseData.priority,
        analyst: caseData.analyst,
        description: `Investigation updated by ${caseData.analyst}`
      }),
    });
    if (!response.ok) throw new Error(parseFastAPIError(await response.json().catch(()=>null), 'Failed to update case in PostgreSQL'));
    return response.json();
  },

  deleteCase: async (caseId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/cases/${caseId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error(parseFastAPIError(await response.json().catch(()=>null), 'Failed to delete case from PostgreSQL'));
    return true;
  },

  restoreCase: async (caseId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/cases/${caseId}/restore`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error(parseFastAPIError(await response.json().catch(()=>null), 'Failed to restore case'));
    return true;
  },

  uploadPayload: async (file: File, caseId: string, useVit: boolean = true, useC2pa: boolean = true) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("case_id", caseId);

    // FASTAPI requires these as strings in the form data
    formData.append("use_vit", String(useVit));
    formData.append("use_c2pa", String(useC2pa));

    const response = await fetch(`${API_BASE_URL}/api/v1/evidence/`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    if (!response.ok) throw new Error(parseFastAPIError(await response.json().catch(()=>null), `Upload failed with status ${response.status}`));
    return response.json();
  },

  deleteEvidence: async (evidenceId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/evidence/${evidenceId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error(parseFastAPIError(await response.json().catch(()=>null), 'Failed to delete evidence'));
    return true;
  },

  restoreEvidence: async (evidenceId: string) => {
    const response = await fetch(`${API_BASE_URL}/api/v1/evidence/${evidenceId}/restore`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error(parseFastAPIError(await response.json().catch(()=>null), 'Failed to restore evidence'));
    return true;
  },

  generateReport: async (evidenceId: string): Promise<{ report_id: string }> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/reports/${evidenceId}`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error(parseFastAPIError(await response.json().catch(()=>null), 'Failed to generate report'));
    return response.json();
  },

  downloadReport: async (reportId: string): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/reports/${reportId}/download`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error('Failed to download report');
    return response.blob();
  },

  listReports: async (evidenceId: string): Promise<{ report_id: string; generated_by: string; generated_at: string; sha256: string }[]> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/reports/${evidenceId}`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error('Failed to list reports');
    const data = await response.json();
    return data.reports || [];
  },
};
