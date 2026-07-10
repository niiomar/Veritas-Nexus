import { useState } from 'react';
import { Shield, UploadCloud, Activity, Database, Clock, Fingerprint, Lock, CheckCircle } from 'lucide-react';

const embeddedStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700&display=swap');

  :root {
    --bg-main: #0f172a;
    --bg-panel: #1e293b;
    --bg-hover: #334155;
    --accent-primary: #3b82f6;
    --accent-glow: rgba(59, 130, 246, 0.5);
    --text-main: #f8fafc;
    --text-muted: #94a3b8;
    --border-color: #334155;
  }

  body {
    font-family: 'Inter', sans-serif;
    background-color: var(--bg-main);
    color: var(--text-main);
    margin: 0;
    padding: 0;
    min-height: 100vh;
  }

  h1, h2, h3, h4 { font-family: 'Montserrat', sans-serif; margin: 0; }
  
  .dashboard-container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
  
  .kpi-strip { display: flex; gap: 1.5rem; margin-bottom: 2rem; }
  .kpi-card { background-color: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem 1.5rem; flex: 1; display: flex; align-items: center; gap: 1rem; }
  .kpi-data h4 { color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
  .kpi-data p { font-size: 1.25rem; font-weight: 600; color: var(--text-main); margin: 0; }
  
  .grid-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 2rem; }
  
  .panel { background-color: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 2rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
  .panel-header { border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem; }
  
  .upload-zone { border: 2px dashed var(--border-color); border-radius: 8px; padding: 3rem 2rem; text-align: center; background-color: rgba(15, 23, 42, 0.5); transition: all 0.2s ease; margin-bottom: 1.5rem; }
  .upload-zone:hover { border-color: var(--accent-primary); background-color: rgba(59, 130, 246, 0.05); }
  
  .btn-primary { background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; width: 100%; justify-content: center; transition: box-shadow 0.2s ease; }
  .btn-primary:hover:not(:disabled) { box-shadow: 0 0 15px var(--accent-glow); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  
  .timeline { display: flex; flex-direction: column; gap: 1rem; }
  .timeline-event { display: flex; gap: 1rem; padding: 1rem; background-color: rgba(15, 23, 42, 0.5); border-left: 3px solid var(--accent-primary); border-radius: 0 6px 6px 0; }
  .timeline-time { font-family: monospace; font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem; }
  .timeline-action { font-weight: 600; font-size: 0.95rem; }
  .timeline-context { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem; }
`;

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [ingestResult, setIngestResult] = useState<{ sha256: string; evidence_id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ACTIVE_CASE_ID = "ced83594-cd59-4ca9-8a0c-6733fd93dc4c"; 

  const handleIngest = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setIsUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append("case_id", ACTIVE_CASE_ID);
    formData.append("uploaded_by", "Analyst_01");
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/api/v1/evidence/", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        // Extract the actual traceback/error message from FastAPI's JSON response
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed with status: ${response.status}`);
      }

      const data = await response.json();
      setIngestResult({
        sha256: data.sha256,
        evidence_id: data.evidence_id
      });
      
    } catch (err: any) {
      setError(err.message || "Failed to connect to Nexus Backend.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      {/* This style tag forcefully injects the CSS straight into the DOM. 
        It bypasses Webpack/Vite loaders entirely. 
      */}
      <style dangerouslySetInnerHTML={{ __html: embeddedStyles }} />
      
      <div className="dashboard-container">
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Shield size={32} color="#3b82f6" />
              Veritas Nexus
            </h1>
            <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>NSB // C2pa-Veritas Evidence Ingestion Node</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.9rem', fontWeight: 600 }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></div>
            NODE ACTIVE
          </div>
        </header>

        <div className="kpi-strip">
          <div className="kpi-card">
            <Activity color="#3b82f6" size={24} />
            <div className="kpi-data">
              <h4>System Status</h4>
              <p>Ready for Ingestion</p>
            </div>
          </div>
          <div className="kpi-card">
            <Database color="#8b5cf6" size={24} />
            <div className="kpi-data">
              <h4>Database Connection</h4>
              <p>PostgreSQL Synced</p>
            </div>
          </div>
          <div className="kpi-card">
            <Lock color="#10b981" size={24} />
            <div className="kpi-data">
              <h4>Security Protocol</h4>
              <p>SHA-256 Enforced</p>
            </div>
          </div>
        </div>

        <div className="grid-layout">
          <main className="panel">
            <div className="panel-header">
              <h2>Secure Upload Pipeline</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Initialize cryptographic hashing and queue evidence for ViT-CORE-FORENSICS analysis.
              </p>
            </div>
            
            <div className="upload-zone">
              <UploadCloud size={48} color="#94a3b8" style={{ margin: '0 auto 1rem auto' }} />
              <h3 style={{ marginBottom: '0.5rem' }}>Drag & Drop Evidence File</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Supports video, images, and raw data captures.
              </p>
              
              <input 
                type="file" 
                id="evidence-upload" 
                style={{ display: 'none' }} 
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setIngestResult(null); 
                  setError(null);
                }}
              />
              <label 
                htmlFor="evidence-upload" 
                style={{ 
                  backgroundColor: 'var(--bg-hover)', 
                  padding: '0.5rem 1rem', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  border: '1px solid var(--border-color)'
                }}>
                Browse Files
              </label>

              {file && (
                <div style={{ marginTop: '1.5rem', color: '#10b981', fontWeight: 500 }}>
                  Selected: {file.name}
                </div>
              )}
              
              {error && (
                <div style={{ marginTop: '1rem', color: '#ef4444', fontSize: '0.9rem' }}>
                  Error: {error}
                </div>
              )}
            </div>

            <button 
              className="btn-primary" 
              onClick={handleIngest}
              disabled={isUploading || !file}
            >
              {isUploading ? (
                <>Processing...</>
              ) : (
                <>
                  <Fingerprint size={20} />
                  Generate Hash & Ingest Evidence
                </>
              )}
            </button>
          </main>

          <aside className="panel">
            <div className="panel-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={20} color="#8b5cf6" />
                Historical Actions
              </h3>
            </div>
            
            <div className="timeline">
              <div className="timeline-event">
                <div>
                  <span className="timeline-time">{new Date().toISOString()}</span>
                  <div className="timeline-action">System Initialized</div>
                  <div className="timeline-context">Awaiting secure payload ingestion.</div>
                </div>
              </div>
              
              {ingestResult ? (
                <div className="timeline-event" style={{ borderLeftColor: '#10b981' }}>
                  <div>
                    <span className="timeline-time">{new Date().toISOString()}</span>
                    <div className="timeline-action" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle size={16} /> 
                      Provenance Hash Generated
                    </div>
                    <div className="timeline-context" style={{ wordBreak: 'break-all', fontFamily: 'monospace', marginTop: '0.5rem', color: 'var(--text-main)' }}>
                      SHA-256: {ingestResult.sha256}
                    </div>
                    <div className="timeline-context" style={{ marginTop: '0.5rem' }}>
                      Evidence ID: {ingestResult.evidence_id}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="timeline-event" style={{ opacity: 0.5, borderLeftColor: 'var(--border-color)' }}>
                  <div>
                    <span className="timeline-time">Pending...</span>
                    <div className="timeline-action">Provenance Graph Creation</div>
                    <div className="timeline-context">Will generate upon successful SHA-256 validation.</div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

export default App;
