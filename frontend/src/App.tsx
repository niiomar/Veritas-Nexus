import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';

import './index.css';
import type { Case, Evidence, EngineStatus } from './types';
import { EvidenceAPI } from './services/api';
import { AssessmentEngine } from './services/assessment';

import { GlobalCommandBar } from './components/GlobalCommandBar';
import { Sidebar } from './components/Sidebar';
import { CreateCaseModal } from './components/CreateCaseModal';
import { IngestionPipeline } from './components/IngestionPipeline';
import { DecisionWorkspace } from './components/DecisionWorkspace';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const [evidenceLibrary, setEvidenceLibrary] = useState<Evidence[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  
  const [cases, setCases] = useState<Case[]>([]);
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({ vit: 'ONLINE', c2pa: 'ONLINE' });
  const [lastSync, setLastSync] = useState<string>('00:00');

  const fetchLibrary = useCallback(async () => {
    try {
      const evidence = await EvidenceAPI.fetchLibrary();
      setEvidenceLibrary(evidence);
      setSelectedEvidence((prev) => prev ? evidence.find((e) => e.id === prev.id) || prev : null);
      
      const now = new Date();
      setLastSync(now.toTimeString().split(' ')[0].substring(0, 5));
    } catch (err) {
      console.error("Failed to sync database:", err);
    }
  }, []);

  const fetchTelemetry = useCallback(async () => {
    try {
      const status = await EvidenceAPI.checkHealth();
      setEngineStatus(status);
    } catch (err) {
      setEngineStatus({ vit: 'OFFLINE', c2pa: 'OFFLINE' });
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
    fetchTelemetry();
    
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

  const handleCreateCase = async (newCase: Case) => {
    try {
      // 1. Tell the database to create the case
      const dbResponse = await EvidenceAPI.createCase(newCase);
      
      // 2. OVERRIDE React's fake data with the official database data
      const officialCase: Case = {
        ...newCase,
        id: dbResponse.id || dbResponse.case_id, // Captures official Postgres UUID
        name: dbResponse.title || newCase.name,
      };
      
      // 3. Save the official case to the UI
      setCases(prev => [officialCase, ...prev]);
      setActiveCase(officialCase);
      setIsCreateModalOpen(false);
    } catch (err: any) {
      console.error("Database sync failed:", err);
      setUploadError(`Case Creation Failed: ${err.message}`);
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  const filteredEvidence = activeCase ? evidenceLibrary.filter(item => item.case_id === activeCase.id) : [];

  return (
    <>
      {uploadError && <div className="toast"><AlertCircle size={16} /> {uploadError}</div>}

      {isCreateModalOpen && (
        <CreateCaseModal 
          onClose={() => setIsCreateModalOpen(false)} 
          onSubmit={handleCreateCase} 
        />
      )}

      {isUploading && file && activeCase && (
        <IngestionPipeline file={file} activeCase={activeCase} onComplete={handleUploadComplete} onError={handleUploadError} />
      )}

      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#050505' }}>
        <GlobalCommandBar />

        {/* MASTER-DETAIL LAYOUT */}
        <div className="main-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          <Sidebar 
            cases={cases} 
            activeCase={activeCase} 
            evidenceLibrary={evidenceLibrary}
            onSelectCase={(c) => { setActiveCase(c); setSelectedEvidence(null); }} 
            onCreateClick={() => setIsCreateModalOpen(true)}
          />

          {/* LEFT: EVIDENCE LEDGER (Shrinks when dossier is open) */}
          <main style={{ 
            flex: selectedEvidence ? '0 0 450px' : '1', 
            display: 'flex', flexDirection: 'column', 
            padding: selectedEvidence ? '32px' : '64px 96px', 
            borderRight: selectedEvidence ? '1px solid rgba(255,255,255,0.05)' : 'none',
            overflow: 'hidden', maxWidth: selectedEvidence ? '450px' : '1200px',
            transition: 'all 0.2s ease', margin: 0
          }}>
            
            {!activeCase ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-faint)' }}>
                 <div className="mono" style={{ fontSize: '14px', letterSpacing: '0.15em', marginBottom: '16px' }}>NO INVESTIGATION SELECTED</div>
                 <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Create a new case or select one from the sidebar to begin analysis.</div>
                 <button 
                   onClick={() => setIsCreateModalOpen(true)}
                   className="mono hover-bright" 
                   style={{ marginTop: '32px', background: 'var(--text-main)', border: 'none', color: '#000', borderRadius: '4px', padding: '12px 24px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', letterSpacing: '0.1em' }}
                 >
                   INITIALIZE NEW CASE
                 </button>
              </div>
            ) : (
              <>
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

                {/* HIGH-DENSITY LEDGER LIST */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }}>
                     <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em', fontWeight: 500 }}>EVIDENCE LEDGER</div>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px' }}>
                    {filteredEvidence.length === 0 ? (
                      <div style={{ padding: '48px 0', color: 'var(--text-faint)', fontSize: '14px' }}>Awaiting payload ingestion.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredEvidence.map((item) => {
                          const ast = AssessmentEngine.evaluate(item);
                          const isEval = item.status !== 'COMPLETED' || !item.ai_report;
                          const cleanName = item.filename.split('_').slice(1).join('_') || item.filename;
                          const isActive = selectedEvidence?.id === item.id;
                          
                          const issuer = item.ai_report?.c2pa_data?.issuer || 'Unknown Publisher';
                          const dateStr = item.uploaded_at.split('T')[0];
                          const vitChecked = item.ai_report?.deepfake_probability !== null;
                          const c2paChecked = item.ai_report?.c2pa_data?.is_signed === true;

                          return (
                            <div key={item.id} role="button" tabIndex={0} onClick={() => setSelectedEvidence(item)}
                                 style={{ 
                                   display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', 
                                   padding: '16px', borderRadius: '6px', cursor: 'pointer', 
                                   backgroundColor: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                                   borderLeft: isActive ? '3px solid var(--text-main)' : '3px solid transparent',
                                   borderTop: '1px solid rgba(255,255,255,0.02)',
                                   borderRight: '1px solid rgba(255,255,255,0.02)',
                                   borderBottom: '1px solid rgba(255,255,255,0.02)',
                                   transition: 'all 0.2s'
                                 }}
                                 className="hover-bright">
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '14px', color: isActive ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  ● {cleanName}
                                </div>
                                
                                {!isEval && (
                                   <div className="mono" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '10px', color: 'var(--text-faint)' }}>
                                     <span style={{ color: 'var(--text-muted)' }}>{issuer}</span>
                                     <span>•</span>
                                     <span>{dateStr}</span>
                                     <span>•</span>
                                     <span style={{ color: vitChecked ? 'var(--text-muted)' : 'var(--text-faint)' }}>ViT {vitChecked ? '✓' : '✕'}</span>
                                     <span style={{ color: c2paChecked ? 'var(--text-muted)' : 'var(--text-faint)' }}>C2PA {c2paChecked ? '✓' : '✕'}</span>
                                   </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, paddingLeft: '16px' }}>
                                {isEval ? (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }} className="mono animate-pulse">EVALUATING</span>
                                ) : (
                                  <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-main)', fontWeight: 600 }}>
                                    <span style={{ color: `var(--c-${ast.type})`, fontSize: '12px' }}>●</span> {ast.conf}%
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </main>

          {/* RIGHT: DOSSIER */}
          {selectedEvidence && activeCase && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', backgroundColor: '#050505', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
               <DecisionWorkspace evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
            </div>
          )}
        </div>
        
        {/* OPERATIONS CENTER TELEMETRY FOOTER */}
        <div className="mono" style={{ height: '40px', background: 'var(--bg-base)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0, zIndex: 10, fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
          
          <div style={{ display: 'flex', gap: '48px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              ViT-CORE <span style={{ color: engineStatus.vit === 'ONLINE' ? '#10b981' : 'var(--c-crit)', fontWeight: 600 }}>{engineStatus.vit}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              C2PA <span style={{ color: engineStatus.c2pa === 'ONLINE' ? '#10b981' : 'var(--c-crit)', fontWeight: 600 }}>{engineStatus.c2pa}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              QUEUE <span style={{ color: 'var(--text-main)' }}>0</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '48px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              CPU <span style={{ color: 'var(--text-muted)' }}>12%</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              GPU <span style={{ color: 'var(--text-main)' }}>41%</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              LAST SYNC <span style={{ color: 'var(--text-muted)' }}>{lastSync}</span>
            </div>
          </div>

        </div>

      </div>
    </>
  );
}
