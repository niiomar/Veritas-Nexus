const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Helper to decode FastAPI 422 Validation Arrays into human-readable text
const parseFastAPIError = (errorData: any, defaultMessage: string) => {
  if (!errorData) return defaultMessage;
  if (typeof errorData.detail === 'string') return errorData.detail;
  
  if (Array.isArray(errorData.detail)) {
    return errorData.detail.map((err: any) => {
      const field = err.loc[err.loc.length - 1];
      return `Field '${field}': ${err.msg}`;
    }).join(' | ');
  }
  
  return defaultMessage;
};

export const EvidenceAPI = {
  fetchLibrary: async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/evidence/`);
    if (!response.ok) {
      throw new Error('Failed to fetch evidence library');
    }
    const data = await response.json();
    return data.evidence || [];
  },

  checkHealth: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/health`);
      if (!response.ok) {
        throw new Error('Health check failed');
      }
      const data = await response.json();
      return {
        vit: data.vit_status || 'OFFLINE',
        c2pa: data.c2pa_status || 'OFFLINE'
      };
    } catch (err) {
      return { vit: 'OFFLINE', c2pa: 'OFFLINE' };
    }
  },

  createCase: async (caseData: any) => {
    // URL has NO trailing slash to prevent 307 Redirect CORS issues
    const response = await fetch(`${API_BASE_URL}/api/v1/cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Removed the 'id' field so PostgreSQL generates its own official UUID
      body: JSON.stringify({
        title: caseData.name, 
        alias: caseData.alias,
        priority: caseData.priority,
        analyst: caseData.analyst,
        description: `Investigation initialized by ${caseData.analyst}`
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(parseFastAPIError(errorData, 'Failed to create case in PostgreSQL'));
    }
    
    return response.json();
  },

  uploadPayload: async (file: File, caseId: string, uploadedBy: string = "Analyst_01") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("case_id", caseId);
    formData.append("uploaded_by", uploadedBy);

    const response = await fetch(`${API_BASE_URL}/api/v1/evidence/`, {
      method: 'POST',
      body: formData, 
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(parseFastAPIError(errorData, `Upload failed with status ${response.status}`));
    }

    return response.json();
  }
};
