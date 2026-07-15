const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const parseFastAPIError = (errorData: any, defaultMessage: string) => {
  if (!errorData) return defaultMessage;
  if (typeof errorData.detail === 'string') return errorData.detail;
  if (Array.isArray(errorData.detail)) {
    return errorData.detail.map((err: any) => `Field '${err.loc[err.loc.length - 1]}': ${err.msg}`).join(' | ');
  }
  return defaultMessage;
};

export const EvidenceAPI = {
  fetchLibrary: async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/evidence/`);
    if (!response.ok) throw new Error('Failed to fetch evidence library');
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
    const response = await fetch(`${API_BASE_URL}/api/v1/cases/${caseId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(parseFastAPIError(await response.json().catch(()=>null), 'Failed to delete case from PostgreSQL'));
    return true;
  },

  // ADDED: useVit and useC2pa parameters
  uploadPayload: async (file: File, caseId: string, uploadedBy: string = "Analyst_01", useVit: boolean = true, useC2pa: boolean = true) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("case_id", caseId);
    formData.append("uploaded_by", uploadedBy);
    
    // FASTAPI requires these as strings in the form data
    formData.append("use_vit", String(useVit));
    formData.append("use_c2pa", String(useC2pa));

    const response = await fetch(`${API_BASE_URL}/api/v1/evidence/`, {
      method: 'POST',
      body: formData, 
    });
    if (!response.ok) throw new Error(parseFastAPIError(await response.json().catch(()=>null), `Upload failed with status ${response.status}`));
    return response.json();
  }
};