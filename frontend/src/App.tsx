<<<<<<< HEAD
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
=======
// src/App.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, Network, Plus, Globe, FileText, ChevronRight, AlertCircle } from 'lucide-react';
>>>>>>> 79c5f88650c1859b71654981f454f8077097e16a

import './index.css';
import type { Case, Evidence, EngineStatus } from './types';
import { EvidenceAPI } from './services/api';
import { AssessmentEngine } from './services/assessment';

import { GlobalCommandBar } from './components/GlobalCommandBar';
import { Sidebar } from './components/Sidebar';
<<<<<<< HEAD
=======
import { TelemetrySidebar } from './components/TelemetrySidebar';
>>>>>>> 79c5f88650c1859b71654981f454f8077097e16a
import { IngestionPipeline } from './components/IngestionPipeline';
import { DecisionWorkspace } from './components/DecisionWorkspace';

const INITIAL_CASES: Case[] = [
  { id: "ced83594-cd59-4ca9-8a0c-6733fd93dc4c", name: "Operation Blackwood", alias: "CASE-104", analyst: "Analyst_01", priority: "Critical", created: "2026-07-01", count: 14 },
  { id: "00000000-0000-0000-0000-000000000211", name: "Intercept Beta-9", alias: "CASE-211", analyst: "Analyst_04", priority: "High", created: "2026-07-08", count: 3 },
  { id: "00000000-0000-0000-0000-000000000300", name: "Routine Sweep 44", alias: "CASE-300", analyst: "Analyst_02", priority: "Routine", created: "2026-07-10", count: 42 }
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [evidenceLibrary, setEvidenceLibrary] = useState<Evidence[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [activeCase, setActiveCase] = useState<Case>(INITIAL_CASES[0]);
  
<<<<<<< HEAD
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({ vit: 'ONLINE', c2pa: 'ONLINE' });

=======
  // Dynamic Engine Telemetry State
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({ vit: 'ONLINE', c2pa: 'ONLINE' });

  // Poll Database Library
>>>>>>> 79c5f88650c1859b71654981f454f8077097e16a
  const fetchLibrary = useCallback(async () => {
    try {
      const evidence = await EvidenceAPI.fetchLibrary();
      setEvidenceLibrary(evidence);
      setSelectedEvidence((prev) => prev ? evidence.find((e) => e.id === prev.id) || prev : null);
    } catch (err) {
      console.error("Failed to sync database:", err);
    }
  }, []);

<<<<<<< HEAD
=======
  // Poll Engine Cluster Health
>>>>>>> 79c5f88650c1859b71654981f454f8077097e16a
  const fetchTelemetry = useCallback(async () => {
    const status = await EvidenceAPI.checkHealth();
    setEngineStatus(status);
  }, []);

  useEffect(() => {
    fetchLibrary();
    fetchTelemetry();
    
<<<<<<< HEAD
=======
    // Check DB every 3 seconds, Check Engines every 10 seconds
>>>>>>> 79c5f88650c1859b71654981f454f8077097e16a
    const dbInterval = setInterval(fetchLibrary, 3000);
    const telemetryInterval = setInterval(fetchTelemetry, 10000);
    
    return () => { clearInterval(dbInterval); clearInterval(telemetryInterval); };
  }, [fetchLibrary, fetchTelemetry]);

  const handleUploadComplete = useCallback(() => {
    setIsUploading(false);
    setFile(null);
    fetchLibrary();
  }, [fetchLibrary]);

  const handleUploadError = useCallback((msg: string) => {
    setIsUploading(false);
    setFile(null);
    setUploadError(msg);
    setTimeout(() => setUploadError(null), 5000);
  }, []);

  const filteredEvidence = evidenceLibrary.filter(item => item.case_id === activeCase.id);
<<<<<<< HEAD
  
  const metrics = useMemo(() => filteredEvidence.reduce((acc, curr) => {
    const ast = AssessmentEngine.evaluate(curr);
    if (ast.type === 'crit') acc.critical++;
    if (ast.type === 'warn') acc.conflicts++;
=======
  const metrics = useMemo(() => filteredEvidence.reduce((acc, curr) => {
    const ast = AssessmentEngine.evaluate(curr);
    if (ast.type === 'crit') acc.critical++;
    if (ast.type === 'review') acc.conflicts++;
>>>>>>> 79c5f88650c1859b71654981f454f8077097e16a
    return acc;
  }, { critical: 0, conflicts: 0 }), [filteredEvidence]);

  return (
    <>
      {uploadError && <div className="toast"><AlertCircle size={16} /> {uploadError}</div>}

      {isUploading && file && (
        <IngestionPipeline file={file} activeCase={activeCase} onComplete={handleUploadComplete} onError={handleUploadError} />
      )}

<<<<<<< HEAD
      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#050505' }}>
        <GlobalCommandBar />

        {/* MASTER-DETAIL LAYOUT */}
        <div className="main-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          <Sidebar cases={INITIAL_CASES} activeCase={activeCase} onSelectCase={(c) => { setActiveCase(c); setSelectedEvidence(null); }} />

          {/* LEFT: EVIDENCE LEDGER (Shrinks when dossier is open) */}
          <main style={{ 
            flex: selectedEvidence ? '0 0 450px' : '1', 
            display: 'flex', flexDirection: 'column', 
            padding: selectedEvidence ? '32px' : '64px 96px', 
            borderRight: selectedEvidence ? '1px solid rgba(255,255,255,0.05)' : 'none',
            overflow: 'hidden', maxWidth: selectedEvidence ? '450px' : '1200px',
            transition: 'all 0.2s ease', margin: selectedEvidence ? '0' : '0'
          }}>
            
            {/* HERO SECTION */}
            <div style={{ display: 'flex', flexDirection: selectedEvidence ? 'column' : 'row', justifyContent: 'space-between', alignItems: selectedEvidence ? 'flex-start' : 'center', gap: '24px', marginBottom: '48px', flexShrink: 0 }}>
              <div>
                <div className="mono" style={{ display: 'flex', gap: '16px', marginBottom: '16px', color: 'var(--text-faint)', fontSize: '11px', letterSpacing: '0.15em' }}>
                  <span>{activeCase.priority.toUpperCase()}</span>
                  <span>•</span>
                  <span>{activeCase.analyst.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: selectedEvidence ? '32px' : '48px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: '12px' }}>
                  {activeCase.alias}
                </div>
                {!selectedEvidence && (
                  <div style={{ fontSize: '20px', color: 'var(--text-muted)' }}>{activeCase.name}</div>
                )}
              </div>
              <div>
                <input type="file" id="file-upload" style={{ display: 'none' }} onChange={(e) => { if(e.target.files?.[0]) { setFile(e.target.files[0]); setIsUploading(true); } }} />
                <button 
                  className="hover-bright mono" 
                  onClick={() => document.getElementById('file-upload')?.click()} 
                  style={{ padding: '8px 16px', background: 'transparent', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', fontWeight: 500, fontSize: '11px', letterSpacing: '0.1em', cursor: 'pointer' }}
                >
                  ＋ INGEST
                </button>
              </div>
            </div>

            {/* LEDGER LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }}>
                 <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em', fontWeight: 500 }}>EVIDENCE LEDGER</div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px' }}>
                {filteredEvidence.length === 0 ? (
                  <div style={{ padding: '48px 0', color: 'var(--text-faint)', fontSize: '14px' }}>Awaiting payload ingestion.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {filteredEvidence.map((item) => {
                      const ast = AssessmentEngine.evaluate(item);
                      const isEval = item.status !== 'COMPLETED' || !item.ai_report;
                      const cleanName = item.filename.split('_').slice(1).join('_') || item.filename;
                      const isActive = selectedEvidence?.id === item.id;

                      return (
                        <div key={item.id} role="button" tabIndex={0} onClick={() => setSelectedEvidence(item)}
                             style={{ 
                               display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                               padding: '12px 16px', borderRadius: '6px', cursor: 'pointer', 
                               backgroundColor: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                               borderLeft: isActive ? '3px solid var(--text-main)' : '3px solid transparent'
                             }}
                             className="hover-bright">
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                            <div style={{ fontWeight: 500, fontSize: '14px', color: isActive ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              ● {cleanName}
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                            {isEval ? (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }} className="mono animate-pulse">EVALUATING...</span>
                            ) : (
                              <div className="mono" style={{ fontWeight: 600, fontSize: '12px', color: `var(--c-${ast.type})`, letterSpacing: '0.05em' }}>{ast.verdict.toUpperCase()}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* RIGHT: DECISION WORKSPACE DOSSIER (Occupies remaining space) */}
          {selectedEvidence && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', backgroundColor: '#050505' }}>
               <DecisionWorkspace evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
            </div>
          )}

        </div>
        
        {/* ULTRA-QUIET TELEMETRY FOOTER */}
        <div style={{ height: '36px', background: 'var(--bg-base)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              ViT-CORE <span style={{ color: engineStatus.vit === 'ONLINE' ? 'var(--text-muted)' : 'var(--c-crit)', marginLeft: '4px' }}>●</span>
            </div>
            <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              C2PA <span style={{ color: engineStatus.c2pa === 'ONLINE' ? 'var(--text-muted)' : 'var(--c-crit)', marginLeft: '4px' }}>●</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '32px' }}>
            <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{metrics.critical} CRITICAL</div>
            <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{metrics.conflicts} CONFLICTS</div>
          </div>
        </div>

      </div>
    </>
  );
}
=======
      {selectedEvidence && (
        <DecisionWorkspace evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
      )}

      <div className="app-container">
        <GlobalCommandBar />

        <div className="main-layout">
          <Sidebar cases={INITIAL_CASES} activeCase={activeCase} onSelectCase={(c) => { setActiveCase(c); setSelectedEvidence(null); }} />

          <main className="workspace-core">
            <div className="investigation-arena">
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <span className="badge b-crit">THREAT LEVEL: {activeCase.priority.toUpperCase()}</span>
                    <span className="badge b-neutral"><User size={10} style={{display:'inline', marginRight:'4px'}}/> LEAD: {activeCase.analyst.toUpperCase()}</span>
                  </div>
                  <div className="case-id-large" style={{ fontSize: '2.5rem' }}>{activeCase.alias}</div>
                  <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{activeCase.name}</div>
                </div>
                <div>
                  <input type="file" id="file-upload" style={{ display: 'none' }} onChange={(e) => { if(e.target.files?.[0]) { setFile(e.target.files[0]); setIsUploading(true); } }} />
                  <button className="btn-sys" onClick={() => document.getElementById('file-upload')?.click()}><Plus size={16} /> INGEST PAYLOAD</button>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header"><Network size={14}/> EVIDENCE RELATIONSHIP GRAPH</div>
                <div className="panel-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', backgroundImage: 'radial-gradient(circle at 50% 50%, var(--border-color) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                   <div style={{ color: 'var(--text-faint)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Globe size={16}/> Graph visualization mapping initialized for {filteredEvidence.length} assets.</div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header"><FileText size={14}/> EVIDENCE INTELLIGENCE LEDGER</div>
                <div>
                  {filteredEvidence.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-faint)', fontSize: '0.85rem' }}>Awaiting payload ingestion.</div>
                  ) : (
                    filteredEvidence.map((item) => {
                      const ast = AssessmentEngine.evaluate(item);
                      const isEval = item.status !== 'COMPLETED' || !item.ai_report;
                      return (
                        <div key={item.id} className="ledger-commit" role="button" tabIndex={0} onClick={() => setSelectedEvidence(item)} onKeyDown={(e) => { if (e.key === 'Enter') setSelectedEvidence(item); }}>
                          <div className="commit-icon" style={{ color: isEval ? 'var(--text-muted)' : `var(--c-${ast.type})`, background: isEval ? 'var(--text-muted)' : `var(--c-${ast.type})` }}></div>
                          <div style={{ flex: '2', minWidth: 0 }}><div className="truncate" style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.filename.split('_').slice(1).join('_') || item.filename}</div><div className="mono truncate" style={{ fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>{item.sha256}</div></div>
                          <div style={{ flex: '1', display: 'flex', gap: '0.5rem' }}>
                            {!isEval && item.ai_report?.deepfake_probability !== null && <span className="badge b-neural" title="ViT-CORE Processed">ViT</span>}
                            {!isEval && item.ai_report?.c2pa_data?.is_signed && <span className="badge b-crypto" title="C2PA Validated">C2PA</span>}
                          </div>
                          <div style={{ flex: '1.5', textAlign: 'right' }}>
                            {isEval ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} className="animate-pulse">EVALUATING...</span> : <div><div style={{ fontWeight: 700, fontSize: '0.85rem', color: `var(--c-${ast.type})` }}>{ast.verdict}</div><div className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-faint)' }}>CONF: {ast.conf}%</div></div>}
                          </div>
                          <div><ChevronRight size={16} color="var(--text-faint)" /></div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </main>

          <TelemetrySidebar metrics={metrics} engineStatus={engineStatus} />
        </div>
      </div>
    </>
  );
}
>>>>>>> 79c5f88650c1859b71654981f454f8077097e16a
