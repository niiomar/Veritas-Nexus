import { useState, useEffect } from 'react';
import { Shield, UploadCloud, Activity, Database, Clock, Fingerprint, Lock, CheckCircle, FileText, AlertTriangle } from 'lucide-react';

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

  body { font-family: 'Inter', sans-serif; background-color: var(--bg-main); color: var(--text-main); margin: 0; padding: 0; min-height: 100vh; }
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

  .table-container { margin-top: 2rem; }
  .data-table { width: 100%; border-collapse: collapse; text-align: left; }
  .data-table th { padding: 1rem; border-bottom: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .data-table td { padding: 1rem; border-bottom: 1px solid var(--border-color); font-size: 0.9rem; }
  .data-table tr { transition: background-color 0.2s ease; cursor: pointer; }
  .data-table tr:hover { background-color: rgba(255, 255, 255, 0.02); }
  
  .badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; display: inline-block; }
  .badge.pending { background-color: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
  .badge.processing { background-color: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }
  .badge.completed { background-color: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
  .hash-cell { font-family: monospace; color: var(--text-muted); max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

  /* Modal Styles */
  .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 50; }
  .modal-content { background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; width: 650px; max-width: 90%; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); overflow: hidden; animation: slideIn 0.2s ease-out; }
  .modal-header { padding: 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background-color: rgba(15, 23, 42, 0.3); flex-shrink: 0; }
  .modal-body { padding: 1.5rem; overflow-y: auto; }
  .close-btn { background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; line-height: 1; }
  .close-btn:hover { color: white; }
  .report-card { background: rgba(15, 23, 42, 0.5); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.5rem; margin-top: 1.5rem; }
  .threat-text { font-size: 1.05rem; line-height: 1.6; border-left: 3px solid #ef4444; padding-left: 1rem; margin-top: 1rem; color: #f8fafc; font-family: 'Montserrat', sans-serif; font-weight: 500;}
  .score-high { color: #ef4444; font-weight: 700; font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
  
  @keyframes slideIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [ingestResult, setIngestResult] = useState<{ sha256: string; evidence_id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [evidenceLibrary, setEvidenceLibrary] = useState<any[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<any | null>(null);

  const ACTIVE_CASE_ID = "ced83594-cd59-4ca9-8a0c-6733fd93dc4c"; 

  const fetchLibrary = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/v1/evidence/");
      if (response.ok) {
        const data = await response.json();
        setEvidenceLibrary(data.evidence || []);
        
        // Use functional state update to prevent the "stale closure" race condition
        setSelectedEvidence((prevSelected) => {
          // If the user already clicked close, KEEP it closed.
          if (!prevSelected) return null; 
          
          // If it is still open, seamlessly update the text inside it.
          const updatedTarget = data.evidence.find((e: any) => e.id === prevSelected.id);
          return updatedTarget || prevSelected;
        });
      }
    } catch (err) {
      console.error("Failed to sync library:", err);
    }
  };

  useEffect(() => {
    fetchLibrary();
    const pollingInterval = setInterval(fetchLibrary, 3000);
    return () => clearInterval(pollingInterval);
  }, [selectedEvidence]); // Re-bind interval so it captures current state

  const handleIngest = async () => {
    if (!file) return setError("Please select a file first.");
    setIsUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append("case_id", ACTIVE_CASE_ID);
    formData.append("uploaded_by", "Analyst_01");
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/api/v1/evidence/", { method: "POST", body: formData });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Upload failed with status: ${response.status}`);
      }
      const data = await response.json();
      setIngestResult({ sha256: data.sha256, evidence_id: data.evidence_id });
      setFile(null); 
      fetchLibrary(); 
    } catch (err: any) {
      setError(err.message || "Failed to connect to Nexus Backend.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: embeddedStyles }} />
      
      {/* Modal Overlay for AI Report */}
      {selectedEvidence && (
        <div className="modal-overlay" onClick={() => setSelectedEvidence(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={24} color="#3b82f6" />
                Intelligence Briefing
              </h3>
              <button className="close-btn" onClick={() => setSelectedEvidence(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Target Asset</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: '0.25rem' }}>{selectedEvidence.filename}</div>
                <div className="hash-cell" style={{ marginTop: '0.25rem', maxWidth: '100%' }}>{selectedEvidence.sha256}</div>
              </div>
              
              {selectedEvidence.status === 'COMPLETED' && selectedEvidence.ai_report ? (
                <div className="report-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <span style={{ fontWeight: 500 }}>ViT-CORE Manipulation Probability</span>
                    <span className="score-high">
                      <AlertTriangle size={24} />
                      {(selectedEvidence.ai_report.deepfake_probability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                    <div style={{ color: '#3b82f6', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Phi-3 Threat Assessment</div>
                    <div className="threat-text">
                      {selectedEvidence.ai_report.threat_summary}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <Activity size={32} color="#3b82f6" style={{ margin: '0 auto 1rem auto', animation: 'pulse 2s infinite' }} />
                  <p>Analysis is currently <strong>{selectedEvidence.status}</strong>.<br/>Awaiting ViT-CORE and Phi-3 pipeline completion.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-container">
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Shield size={32} color="#3b82f6" /> Veritas Nexus</h1>
            <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>NSB // C2pa-Veritas Evidence Ingestion Node</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.9rem', fontWeight: 600 }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></div> NODE ACTIVE
          </div>
        </header>

        <div className="kpi-strip">
          <div className="kpi-card">
            <Activity color="#3b82f6" size={24} />
            <div className="kpi-data"><h4>System Status</h4><p>Ready for Ingestion</p></div>
          </div>
          <div className="kpi-card">
            <Database color="#8b5cf6" size={24} />
            <div className="kpi-data"><h4>Database Connection</h4><p>PostgreSQL Synced</p></div>
          </div>
          <div className="kpi-card">
            <Lock color="#10b981" size={24} />
            <div className="kpi-data"><h4>Security Protocol</h4><p>SHA-256 Enforced</p></div>
          </div>
        </div>

        <div className="grid-layout">
          <main className="panel">
            <div className="panel-header">
              <h2>Secure Upload Pipeline</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Initialize cryptographic hashing and queue evidence for ViT-CORE-FORENSICS analysis.</p>
            </div>
            
            <div className="upload-zone">
              <UploadCloud size={48} color="#94a3b8" style={{ margin: '0 auto 1rem auto' }} />
              <h3 style={{ marginBottom: '0.5rem' }}>Drag & Drop Evidence File</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Supports video, images, and raw data captures.</p>
              
              <input type="file" id="evidence-upload" style={{ display: 'none' }} onChange={(e) => { setFile(e.target.files?.[0] || null); setIngestResult(null); setError(null); }} />
              <label htmlFor="evidence-upload" style={{ backgroundColor: 'var(--bg-hover)', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', border: '1px solid var(--border-color)' }}>Browse Files</label>

              {file && <div style={{ marginTop: '1.5rem', color: '#10b981', fontWeight: 500 }}>Selected: {file.name}</div>}
              {error && <div style={{ marginTop: '1rem', color: '#ef4444', fontSize: '0.9rem' }}>Error: {error}</div>}
            </div>

            <button className="btn-primary" onClick={handleIngest} disabled={isUploading || !file}>
              {isUploading ? <>Processing...</> : <><Fingerprint size={20} /> Generate Hash & Ingest Evidence</>}
            </button>
          </main>

          <aside className="panel">
            <div className="panel-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={20} color="#8b5cf6" /> Historical Actions</h3>
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
                    <div className="timeline-action" style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={16} /> Provenance Hash Generated</div>
                    <div className="timeline-context" style={{ wordBreak: 'break-all', fontFamily: 'monospace', marginTop: '0.5rem', color: 'var(--text-main)' }}>SHA-256: {ingestResult.sha256}</div>
                  </div>
                </div>
              ) : (
                <div className="timeline-event" style={{ opacity: 0.5, borderLeftColor: 'var(--border-color)' }}>
                  <div>
                    <span className="timeline-time">Pending...</span>
                    <div className="timeline-action">Provenance Graph Creation</div>
                    <div className="timeline-context">Will generate upon successful validation.</div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        <div className="panel table-container">
          <div className="panel-header" style={{ marginBottom: '0' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileText size={20} color="#3b82f6" /> Active Case Evidence Library</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Cryptographic Hash (SHA-256)</th>
                <th>Timestamp (UTC)</th>
                <th>Analysis Status</th>
              </tr>
            </thead>
            <tbody>
              {evidenceLibrary.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No evidence ingested yet.</td></tr>
              ) : (
                evidenceLibrary.map((item) => (
                  <tr key={item.id} onClick={() => setSelectedEvidence(item)}>
                    <td style={{ fontWeight: 500, color: 'var(--text-main)' }}>{item.filename}</td>
                    <td><span className="hash-cell" title={item.sha256}>{item.sha256}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{new Date(item.uploaded_at).toLocaleString()}</td>
                    <td><span className={`badge ${item.status.toLowerCase()}`}>{item.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
      </div>
    </>
  );
}

export default App;
