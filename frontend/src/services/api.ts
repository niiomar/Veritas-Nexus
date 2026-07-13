// src/services/api.ts
import type { Evidence, EngineStatus } from '../types';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const EvidenceAPI = {
  fetchLibrary: async (): Promise<Evidence[]> => {
    const response = await fetch(`${API_URL}/api/v1/evidence`);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    return data.evidence || [];
  },

  uploadPayload: async (caseId: string, analyst: string, file: File, signal?: AbortSignal): Promise<void> => {
    const formData = new FormData();
    formData.append("case_id", caseId);
    formData.append("uploaded_by", analyst);
    formData.append("file", file);
    
    const response = await fetch(`${API_URL}/api/v1/evidence`, { method: "POST", body: formData, signal });
    if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Backend Error ${response.status}: ${errorData}`);
    }
  },

  // NEW: Dynamic Telemetry Ping
  checkHealth: async (): Promise<EngineStatus> => {
    try {
      // Point this to whatever health endpoint you create in FastAPI
      const response = await fetch(`${API_URL}/api/v1/health`);
      if (response.ok) {
         const data = await response.json();
         // Assumes backend returns { vit_status: "ONLINE", c2pa_status: "ONLINE" }
         return { 
           vit: data.vit_status || 'ONLINE', 
           c2pa: data.c2pa_status || 'ONLINE' 
         };
      }
      return { vit: 'OFFLINE', c2pa: 'OFFLINE' };
    } catch {
      // If the fetch completely fails, the engines are offline
      return { vit: 'OFFLINE', c2pa: 'OFFLINE' };
    }
  }
};