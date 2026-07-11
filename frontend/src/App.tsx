import { useState, useEffect } from 'react';
import { 
  Shield, UploadCloud, Activity, Database, Clock, Fingerprint, Lock, 
  CheckCircle, FileText, AlertTriangle, AlertCircle, ShieldCheck, XCircle, 
  User, Layers, Cpu, GitMerge, FileCode2, Scale, Terminal, 
  Search, Network, Plus, ArrowRight, X, BarChart3, ChevronRight, ServerCrash
} from 'lucide-react';

const embeddedStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --bg-base: #09090b; 
    --bg-panel: #18181b; 
    --bg-hover: #27272a; 
    --border-color: #27272a;
    --accent: #3b82f6;
    --text-main: #fafafa;
    --text-muted: #a1a1aa;
    
    --trust-high: #10b981;
    --trust-conflict: #f59e0b;
    --trust-critical: #ef4444;
  }

  body { font-family: 'Inter', sans-serif; background-color: var(--bg-base); color: var(--text-main); margin: 0; padding: 0; height: 100vh; overflow: hidden; }
  .mono { font-family: 'JetBrains Mono', monospace; }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .app-container { display: flex; height: 100vh; width: 100%; }

  .sidebar { width: 260px; background: var(--bg-base); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; flex-shrink: 0; }
  .sidebar-header { padding: 1.5rem; display: flex; align-items: center; gap: 0.75rem; font-weight: 600; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); }
  .sidebar-content { flex: 1; overflow-y: auto; padding: 1.5rem 1rem; }
  .sidebar-section-title { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; padding-left: 0.5rem; font-weight: 600; }

  .nav-item { padding: 0.75rem 1rem; border-radius: 6px; cursor: pointer; transition: background 0.2s; margin-bottom: 0.25rem; }
  .nav-item:hover { background: var(--bg-panel); }
  .nav-item.active { background: var(--bg-panel); border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0; }
  .nav-item-title { font-weight: 500; font-size: 0.9rem; margin-bottom: 0.25rem; }
  .nav-item-meta { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); }

  .workspace { flex: 1; display: flex; flex-direction: column; min-width: 0; position: relative; background: var(--bg-base); }
  .topbar { height: 65px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; padding: 0 2rem; flex-shrink: 0; }
  .topbar-stats { display: flex; gap: 2rem; font-size: 0.8rem; }
  .stat-item { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); }
  .stat-val { color: var(--text-main); font-weight: 600; font-family: 'JetBrains Mono', monospace; }

  .content-area { flex: 1; overflow-y: auto; padding: 2rem 3rem; }

  .case-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; }
  .case-title { font-size: 2rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 1rem; }
  .case-meta { display: flex; gap: 1.5rem; color: var(--text-muted); font-size: 0.85rem; }
  .meta-item { display: flex; align-items: center; gap: 0.4rem; }

  .btn-primary { background: var(--text-main); color: var(--bg-base); border: none; padding: 0.6rem 1.25rem; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: opacity 0.2s; }
  .btn-primary:hover { opacity: 0.9; }

  .ledger-container { border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-base); overflow: hidden; }
  .grid-header { display: grid; grid-template-columns: 1.5fr 2fr 1fr 1fr; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-color); background: var(--bg-panel); font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .grid-row { display: grid; grid-template-columns: 1.5fr 2fr 1fr 1fr; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); align-items: center; transition: background 0.2s; cursor: pointer; gap: 1rem; }
  .grid-row:hover { background: var(--bg-panel); }
  .grid-row:last-child { border-bottom: none; }
  .grid-col:last-child { display: flex; justify-content: flex-end; }

  .badge { padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; font-family: 'JetBrains Mono', monospace; display: inline-flex; align-items: center; justify-content: center; }
  .badge.trust { color: var(--trust-high); background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); }
  .badge.conflict { color: var(--trust-conflict); background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); }
  .badge.critical { color: var(--trust-critical); background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); }
  .badge.neutral { color: var(--text-muted); background: var(--bg-hover); border: 1px solid var(--border-color); }

  .decision-center { width: 500px; background: var(--bg-panel); border-left: 1px solid var(--border-color); display: flex; flex-direction: column; z-index: 20; transform: translateX(100%); transition: transform 0.3s ease; position: absolute; right: 0; top: 0; bottom: 0; box-shadow: -20px 0 40px rgba(0,0,0,0.5); }
  .decision-center.open { transform: translateX(0); }
  .dc-header { padding: 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; }
  .dc-scroll { flex: 1; overflow-y: auto; padding: 1.5rem; }

  .dc-score-box { text-align: center; padding: 2rem 1rem; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 2rem; background: var(--bg-base); }
  .score-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem; }
  .score-verdict { font-size: 1.8rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 0.5rem; }

  .findings-group { margin-bottom: 2rem; }
  .findings-group h4 { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;}
  .finding-item { display: flex; gap: 0.75rem; align-items: flex-start; margin-bottom: 1rem; font-size: 0.85rem; }
  .finding-icon { flex-shrink: 0; margin-top: 0.1rem; }

  /* RICH C2PA TELEMETRY CARD */
  .c2pa-telemetry-card { background: var(--bg-base); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.25rem; margin-top: 1rem; }
  .telemetry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }
  .telemetry-item-label { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
  .telemetry-item-val { font-size: 0.85rem; font-weight: 500; }

  .pipeline-node { display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 0.5rem; background: var(--bg-base); }
  .pipeline-arrow { display: flex; justify-content: center; color: var(--border-color); margin-bottom: 0.5rem; }

  .upload-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; }
  .upload-modal { background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; width: 450px; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); }
  .upload-zone { border: 1px dashed var(--border-color); border-radius: 8px; padding: 3rem 2rem; text-align: center; cursor: pointer; margin: 1.5rem 0; background: var(--bg-base); }
  .upload-zone:hover { border-color: var(--text-muted); }
  
  .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
`;

const INITIAL_CASES = [
  { id: "ced83594-cd59-4ca9-8a0c-6733fd93dc4c", name: "Operation Blackwood", alias: "CASE-104", analyst: "Analyst_01", priority: "Critical", created: "2026-07-01", count: 14 },
  { id: "00000000-0000-0000-0000-000000000211", name: "Intercept Beta-9", alias: "CASE-211", analyst: "Analyst_04", priority: "High", created: "2026-07-08", count: 3 },
  { id: "00000000-0000-0000-0000-000000000300", name: "Routine Sweep 44", alias: "CASE-300", analyst: "Analyst_02", priority: "Routine", created: "2026-07-10", count: 42 }
];

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [evidenceLibrary, setEvidenceLibrary] = useState<any[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<any | null>(null);
  const [activeCase, setActiveCase] = useState(INITIAL_CASES[0]);

  const fetchLibrary = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/v1/evidence");
      if (response.ok) {
        const data = await response.json();
        setEvidenceLibrary(data.evidence || []);
        setSelectedEvidence((prev) => prev ? data.evidence.find((e: any) => e.id === prev.id) || prev : null);
      }
    } catch (err) { console.error("Failed to sync:", err); }
  };

  useEffect(() => {
    fetchLibrary();
    const interval = setInterval(fetchLibrary, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleIngest = async () => {
    if (!file) return setError("Please select a file.");
    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("case_id", activeCase.id);
    formData.append("uploaded_by", activeCase.analyst);
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/api/v1/evidence", { method: "POST", body: formData });
      if (!response.ok) throw new Error(`Upload failed`);
      setFile(null);
      setUploadModalOpen(false);
      fetchLibrary(); 
    } catch (err: any) { setError(err.message); } 
    finally { setIsUploading(false); }
  };

  const filteredEvidence = evidenceLibrary.filter(item => item.case_id === activeCase.id);

  const getAssessment = (item: any) => {
    if (!item.ai_report) return { type: "neutral", msg: "Evaluating...", verdict: "EVALUATING" };
    
    const prob = item.ai_report.deepfake_probability;
    const c2pa = item.ai_report.c2pa_data;

    if (prob === null) {
        if (c2pa?.status === 'VALID') return { verdict: "TRUSTED", conf: "N/A", type: "trust", msg: "ViT-CORE Bypassed", policy: "CryptoProvenance_v1", details: "Neural engine bypassed. Absolute trust established purely via cryptographic signature." };
        if (c2pa?.is_signed) return { verdict: "CONFLICT", conf: "N/A", type: "conflict", msg: "ViT-CORE Bypassed", policy: "BrokenSignatureReview_v1", details: "Neural engine bypassed. Cryptographic signature present but invalid or partial." };
        return { verdict: "UNKNOWN", conf: "N/A", type: "neutral", msg: "ViT-CORE Offline", policy: "NoTelemetry_v1", details: "Neither Neural nor Cryptographic telemetry available." };
    }

    if (prob < 0.15) return { verdict: "HIGH TRUST", conf: ((1 - prob) * 100).toFixed(1), type: "trust", msg: "No Synthetic Artifacts", policy: "StandardAuthenticity_v1.2", details: "Pixel distributions consistent with natural capture." };
    if (prob < 0.70) return { verdict: "CONFLICT", conf: (prob * 100).toFixed(1), type: "conflict", msg: "Anomalies Detected", policy: "AnomalyReview_v1.0", details: "Minor structural anomalies detected in visual framework." };
    return { verdict: "QUARANTINE", conf: (prob * 100).toFixed(1), type: "critical", msg: "High Synthetic Confidence", policy: "CriticalThreshold_v2.1", details: "Severe synthetic generation patterns identified." };
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: embeddedStyles }} />
      
      {uploadModalOpen && (
        <div className="upload-modal-overlay" onClick={() => setUploadModalOpen(false)}>
          <div className="upload-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Secure Asset Ingestion</h3>
              <X size={18} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setUploadModalOpen(false)} />
            </div>
            <div className="upload-zone" onClick={() => document.getElementById('file-upload')?.click()}>
              <input type="file" id="file-upload" style={{ display: 'none' }} onChange={(e) => { setFile(e.target.files?.[0] || null); setError(null); }} />
              <Fingerprint size={28} color="var(--text-muted)" style={{ margin: '0 auto 1rem auto' }} />
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Select Physical Asset</div>
            </div>
            {file && <div className="mono" style={{ color: 'var(--trust-high)', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>TARGET: {file.name}</div>}
            {error && <div style={{ color: 'var(--trust-critical)', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleIngest} disabled={isUploading || !file}>
              {isUploading ? "INGESTING..." : "SIGN & INGEST"}
            </button>
          </div>
        </div>
      )}

      <div className="app-container">
        
        <aside className="sidebar">
          <div className="sidebar-header">
            <Shield size={20} color="var(--accent)" /> Veritas Nexus
          </div>
          <div className="sidebar-content">
            <div className="sidebar-section-title">Open Investigations</div>
            {INITIAL_CASES.map((c) => (
              <div key={c.id} className={`nav-item ${activeCase.id === c.id ? 'active' : ''}`} onClick={() => { setActiveCase(c); setSelectedEvidence(null); }}>
                <div className="nav-item-title">{c.name}</div>
                <div className="nav-item-meta">
                  <span className="mono">{c.alias}</span>
                  <span style={{ color: c.priority === 'Critical' ? 'var(--trust-critical)' : c.priority === 'High' ? 'var(--trust-conflict)' : 'var(--text-muted)' }}>{c.priority}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="workspace">
          <header className="topbar">
            <div className="topbar-stats">
              <div className="stat-item">Cases: <span className="stat-val">17</span></div>
              <div className="stat-item">Alerts: <span className="stat-val" style={{ color: 'var(--trust-critical)' }}>4</span></div>
              <div className="stat-item">Reviews: <span className="stat-val" style={{ color: 'var(--trust-conflict)' }}>11</span></div>
            </div>
            <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              CLASSIFICATION: <span style={{ color: 'var(--trust-conflict)' }}>TOP SECRET // NSB</span>
            </div>
          </header>

          <div className="content-area" onClick={() => setSelectedEvidence(null)}>
            <div className="case-header">
              <div>
                <div className="mono" style={{ color: 'var(--accent)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{activeCase.alias}</div>
                <div className="case-title">{activeCase.name}</div>
                <div className="case-meta">
                  <span className="meta-item"><User size={14}/> {activeCase.analyst}</span>
                  <span className="meta-item"><Clock size={14}/> {activeCase.created}</span>
                </div>
              </div>
              <button className="btn-primary" onClick={(e) => { e.stopPropagation(); setUploadModalOpen(true); }}>
                <Plus size={16} /> INGEST ASSET
              </button>
            </div>

            <div className="ledger-container" onClick={(e) => e.stopPropagation()}>
              <div className="grid-header">
                <div>Target Asset</div>
                <div>Machine Findings</div>
                <div>Provenance</div>
                <div style={{ textAlign: 'right' }}>Assessment</div>
              </div>
              
              <div className="grid-body">
                {filteredEvidence.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Workspace initialized. Awaiting physical evidence ingestion.</div>
                ) : (
                  filteredEvidence.map((item) => {
                    const assessment = getAssessment(item);
                    const isEval = item.status !== 'COMPLETED' || !item.ai_report;
                    const c2pa = item.ai_report?.c2pa_data;

                    return (
                      <div key={item.id} className="grid-row" onClick={() => setSelectedEvidence(item)}>
                        <div className="grid-col truncate">
                          <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.filename.split('_').slice(1).join('_') || item.filename}</div>
                          <div className="hash-cell truncate">SHA-256: {item.sha256}</div>
                        </div>

                        <div className="grid-col truncate">
                          {isEval ? (
                             <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}><Activity size={14} className="animate-pulse" /> Evaluating...</span>
                          ) : item.ai_report.deepfake_probability === null ? (
                             <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}><ServerCrash size={14}/> ViT-CORE Bypassed</span>
                          ) : (
                             <span style={{ color: `var(--trust-${assessment.type})`, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                               {assessment.type === 'trust' ? <CheckCircle size={14}/> : assessment.type === 'conflict' ? <AlertCircle size={14}/> : <XCircle size={14}/>} {assessment.msg}
                             </span>
                          )}
                        </div>

                        <div className="grid-col">
                          {(() => {
                            if (isEval) return <span className="badge neutral">PENDING</span>;
                            if (c2pa?.status === "VALID") return <span className="badge trust">SIGNED</span>;
                            if (c2pa?.status === "BROKEN_SIGNATURE") return <span className="badge conflict">{c2pa.raw_status || "BROKEN SIG"}</span>;
                            return <span className="badge neutral">UNSIGNED</span>;
                          })()}
                        </div>

                        <div className="grid-col">
                          <span className={`badge ${isEval ? 'neutral' : assessment.type}`}>{isEval ? 'EVALUATING' : assessment.verdict}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <aside className={`decision-center ${selectedEvidence ? 'open' : ''}`}>
            {selectedEvidence && (() => {
              const assessment = getAssessment(selectedEvidence);
              const isEval = selectedEvidence.status !== 'COMPLETED' || !selectedEvidence.ai_report;
              const c2pa = selectedEvidence.ai_report?.c2pa_data;
              const vitProb = selectedEvidence.ai_report?.deepfake_probability;

              return (
                <>
                  <div className="dc-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.05em' }}>
                      <Scale size={16} color="var(--accent)" /> DECISION ENGINE
                    </div>
                    <X size={18} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setSelectedEvidence(null)} />
                  </div>
                  
                  <div className="dc-scroll">
                    <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                      <div className="truncate">ASSET: {selectedEvidence.filename}</div>
                      <div className="truncate">HASH: {selectedEvidence.sha256}</div>
                    </div>

                    {!isEval ? (
                      <>
                        <div className="dc-score-box">
                          <div className="score-label">Overall Assessment</div>
                          <div className="score-verdict" style={{ color: `var(--trust-${assessment.type})` }}>{assessment.verdict}</div>
                          <div className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Confidence: {assessment.conf}%</div>
                        </div>

                        <div className="findings-group">
                          <h4><BarChart3 size={14} /> Atomic Findings</h4>
                          
                          <div className="finding-item">
                            <div className="finding-icon" style={{ color: vitProb === null ? 'var(--text-muted)' : `var(--trust-${assessment.type})` }}>
                               {vitProb === null ? <ServerCrash size={14}/> : assessment.type === 'trust' ? <CheckCircle size={14}/> : assessment.type === 'conflict' ? <AlertTriangle size={14}/> : <XCircle size={14}/>}
                            </div>
                            <div>
                              <div style={{ fontWeight: 500 }}>Synthetic Integrity</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                                {vitProb === null ? "Neural evaluation engine bypassed or unreachable." : assessment.msg}
                              </div>
                            </div>
                          </div>
                          
                          <div className="finding-item">
                            <div className="finding-icon" style={{ color: c2pa?.status === 'VALID' ? 'var(--trust-high)' : c2pa?.status === 'BROKEN_SIGNATURE' ? 'var(--trust-conflict)' : 'var(--text-muted)' }}>
                              {c2pa?.status === 'VALID' ? <ShieldCheck size={14}/> : c2pa?.status === 'BROKEN_SIGNATURE' ? <AlertTriangle size={14}/> : <AlertCircle size={14}/>}
                            </div>
                            <div>
                              <div style={{ fontWeight: 500 }}>
                                Cryptographic Provenance {c2pa?.error && <span style={{color: 'var(--trust-critical)'}}>(ERROR)</span>}
                              </div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                                {c2pa?.error ? c2pa.error :
                                 c2pa?.status === 'VALID' ? `Cryptographic signature verified.` : 
                                 c2pa?.status === 'BROKEN_SIGNATURE' ? "Manifest validation error or partial signature detected." : 
                                 "No C2PA signature detected on media payload."}
                              </div>
                            </div>
                          </div>

                          {c2pa?.is_signed || c2pa?.status === "BROKEN_SIGNATURE" ? (
                            <div className="c2pa-telemetry-card">
                              <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Fingerprint size={12}/> CRYPTOGRAPHIC IDENTITY
                              </div>
                              <div className="telemetry-grid">
                                <div>
                                  <div className="telemetry-item-label">Issuer Authority</div>
                                  <div className="telemetry-item-val truncate" title={c2pa.issuer || "Unknown"}>{c2pa.issuer || "Unknown"}</div>
                                </div>
                                <div>
                                  <div className="telemetry-item-label">Validation Status</div>
                                  <div className="telemetry-item-val" style={{ color: c2pa.status === 'VALID' ? 'var(--trust-high)' : 'var(--trust-critical)' }}>{c2pa.status}</div>
                                </div>
                                <div>
                                  <div className="telemetry-item-label">Algorithm</div>
                                  <div className="telemetry-item-val">{c2pa.algorithm || "Unknown"}</div>
                                </div>
                                <div>
                                  <div className="telemetry-item-label">Proc. Time</div>
                                  <div className="telemetry-item-val">{c2pa.timestamp ? `${c2pa.timestamp}s` : "--"}</div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="c2pa-telemetry-card" style={{ borderStyle: 'dashed' }}>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No cryptographic manifest detected.</div>
                              </div>
                          )}
                          
                        </div>

                        <div className="findings-group">
                          <h4><GitMerge size={14} /> Policy Execution</h4>
                          <div className="pipeline-node">
                            <Fingerprint size={16} color="var(--text-muted)" />
                            <div className="mono" style={{ fontSize: '0.75rem' }}>Asset Normalization</div>
                          </div>
                          <div className="pipeline-arrow"><ArrowRight size={14}/></div>
                          
                          {vitProb !== null && (
                            <>
                              <div className="pipeline-node">
                                <Cpu size={16} color="var(--accent)" />
                                <div className="mono" style={{ fontSize: '0.75rem' }}>ViT-CORE Processing</div>
                              </div>
                              <div className="pipeline-arrow"><ArrowRight size={14}/></div>
                            </>
                          )}
                          
                          <div className="pipeline-node" style={{ borderLeft: `3px solid var(--trust-${assessment.type})` }}>
                            <Scale size={16} color={`var(--trust-${assessment.type})`} />
                            <div>
                              <div className="mono" style={{ fontSize: '0.75rem' }}>Triggered: {assessment.policy}</div>
                            </div>
                          </div>
                        </div>

                      </>
                    ) : (
                       <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                        <Activity size={28} color="var(--accent)" className="animate-pulse" style={{ margin: '0 auto 1rem auto' }} />
                        <div className="mono" style={{ fontSize: '0.75rem' }}>EVALUATING PIPELINE</div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </aside>

        </main>
      </div>
    </>
  );
}

export default App;
