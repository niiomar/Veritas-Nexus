import { useState, useEffect, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';

import './index.css';
import type { Case, Evidence, EngineStatus } from './types';
import { EvidenceAPI } from './services/api';
import { AssessmentEngine } from './services/assessment';

import { GlobalCommandBar } from './components/GlobalCommandBar';
import { Sidebar } from './components/Sidebar';
import { CreateCaseModal } from './components/CreateCaseModal';
import { EditCaseModal } from './components/EditCaseModal';
import { DeleteCaseModal } from './components/DeleteCaseModal';
import { IngestionPipeline } from './components/IngestionPipeline';
import { DecisionWorkspace } from './components/DecisionWorkspace';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const [useVit, setUseVit] = useState(true);
  const [useC2pa, setUseC2pa] = useState(true);
  
  const [evidenceLibrary, setEvidenceLibrary] = useState<Evidence[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  
  const [cases, setCases] = useState<Case[]>([]);
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [caseToEdit, setCaseToEdit] = useState<Case | null>(null);
  const [caseToDelete, setCaseToDelete] = useState<Case | null>(null);
  
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({ vit: 'ONLINE', c2pa: 'ONLINE' });
  const [lastSync, setLastSync] = useState<string>('00:00');

  const syncDatabase = useCallback(async () => {
    try {
      const evidenceData = await EvidenceAPI.fetchLibrary();
      setEvidenceLibrary(evidenceData);
      setSelectedEvidence((prev) => prev ? evidenceData.find((e: Evidence) => e.id === prev.id) || prev : null);
    } catch (err) {
      console.error("Evidence sync failed:", err);
    }

    const cached = localStorage.getItem('veritas_cases');
    if (cached) {
      const parsedCases = JSON.parse(cached);
      setCases(parsedCases);
      setActiveCase((prev) => prev ? parsedCases.find((c: Case) => c.id === prev.id) || prev : null);
    }

    const now = new Date();
    setLastSync(now.toTimeString().split(' ')[0].substring(0, 5));
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
    syncDatabase();
    fetchTelemetry();
    
    const dbInterval = setInterval(syncDatabase, 3000);
    const telemetryInterval = setInterval(fetchTelemetry, 10000);
    
    return () => { clearInterval(dbInterval); clearInterval(telemetryInterval); };
  }, [syncDatabase, fetchTelemetry]);

  const handleUploadComplete = useCallback(() => {
    setIsUploading(false);
    setFile(null);
    syncDatabase();
  }, [syncDatabase]);

  const handleUploadError = useCallback((msg: string) => {
    setIsUploading(false);
    setFile(null);
    setUploadError(msg);
    setTimeout(() => setUploadError(null), 5000);
  }, []);

  const handleCreateCase = async (newCase: Case) => {
    try {
      const dbResponse = await EvidenceAPI.createCase(newCase);
      const officialCase: Case = {
        ...newCase,
        id: dbResponse.id || dbResponse.case_id,
        name: dbResponse.title || newCase.name,
      };
      
      setCases(prev => {
        const updated = [officialCase, ...prev];
        localStorage.setItem('veritas_cases', JSON.stringify(updated));
        return updated;
      });
      setActiveCase(officialCase);
      setIsCreateModalOpen(false);
    } catch (err: any) {
      setUploadError(`Case Creation Failed: ${err.message}`);
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  const handleUpdateCase = async (updatedCase: Case) => {
    try {
      const dbResponse = await EvidenceAPI.updateCase(updatedCase.id, updatedCase);
      const officialCase: Case = {
        ...updatedCase,
        name: dbResponse.title || updatedCase.name,
      };
      
      setCases(prev => {
        const updated = prev.map(c => c.id === officialCase.id ? officialCase : c);
        localStorage.setItem('veritas_cases', JSON.stringify(updated));
        return updated;
      });
      if (activeCase?.id === officialCase.id) setActiveCase(officialCase);
      setCaseToEdit(null);
    } catch (err: any) {
      setUploadError(`Case Update Failed: ${err.message}`);
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  const confirmDeleteCase = async () => {
    if (!caseToDelete) return;
    try {
      setCases(prev => {
        const updated = prev.filter(c => c.id !== caseToDelete.id);
        localStorage.setItem('veritas_cases', JSON.stringify(updated));
        return updated;
      });
      if (activeCase?.id === caseToDelete.id) {
        setActiveCase(null);
        setSelectedEvidence(null);
      }
      setCaseToDelete(null); 
    } catch (err: any) {
      setUploadError(`Case Deletion Failed: ${err.message}`);
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  const filteredEvidence = activeCase ? evidenceLibrary.filter(item => item.case_id === activeCase.id) : [];
  const activeQueueCount = filteredEvidence.filter(item => item.status !== 'COMPLETED' || !item.ai_report).length;

  // ROBUST DYNAMIC COLOR LOGIC
  let priorityColor = 'var(--text-muted)';
  const pText = activeCase?.priority?.toLowerCase() || '';
  if (pText.includes('crit')) priorityColor = 'var(--c-crit)';
  else if (pText.includes('high')) priorityColor = 'var(--c-review)';
  else if (pText.includes('med')) priorityColor = 'var(--c-system)';
  else if (pText.includes('low') || pText.includes('routine')) priorityColor = 'var(--c-trust)';

  return (
    <>
      {uploadError && <div className="toast"><AlertCircle size={16} /> {uploadError}</div>}

      {/* HIGH-PRIORITY MODAL LAYER */}
      <div style={{ position: 'relative', zIndex: 999 }}>
        {isCreateModalOpen && (
          <CreateCaseModal onClose={() => setIsCreateModalOpen(false)} onSubmit={handleCreateCase} />
        )}

        {caseToEdit && (
          <EditCaseModal initialCase={caseToEdit} onClose={() => setCaseToEdit(null)} onSubmit={handleUpdateCase} />
        )}

        {caseToDelete && (
          <DeleteCaseModal caseToDelete={caseToDelete} onClose={() => setCaseToDelete(null)} onConfirm={confirmDeleteCase} />
        )}

        {isUploading && file && activeCase && (
          <IngestionPipeline file={file} activeCase={activeCase} useVit={useVit} useC2pa={useC2pa} onComplete={handleUploadComplete} onError={handleUploadError} />
        )}
      </div>

      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#050505' }}>
        <GlobalCommandBar />

        <div className="main-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          <Sidebar 
            cases={cases} 
            activeCase={activeCase} 
            evidenceLibrary={evidenceLibrary}
            onSelectCase={(c) => { setActiveCase(c); setSelectedEvidence(null); }} 
            onCreateClick={() => setIsCreateModalOpen(true)}
            onEditClick={(c) => setCaseToEdit(c)}
            onDeleteClick={(c) => setCaseToDelete(c)} 
          />

          <main style={{ 
            flex: selectedEvidence ? '0 0 280px' : '1', 
            display: 'flex', flexDirection: 'column', 
            padding: selectedEvidence ? '24px' : '48px', 
            borderRight: selectedEvidence ? '1px solid rgba(255,255,255,0.05)' : 'none',
            overflow: 'hidden', maxWidth: selectedEvidence ? '280px' : '1200px',
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
                <div style={{ display: 'flex', flexDirection: selectedEvidence ? 'column' : 'row', justifyContent: 'space-between', alignItems: selectedEvidence ? 'flex-start' : 'center', gap: '24px', marginBottom: '24px', flexShrink: 0 }}>
                  
                  {/* REDESIGNED CASE HEADER */}
                  <div style={{ minWidth: 0, width: '100%' }}>
                    <div className="mono" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '16px', fontSize: '10px', letterSpacing: '0.15em' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: 'var(--text-faint)' }}>PRIORITY</span>
                        <span style={{ color: priorityColor, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: priorityColor, boxShadow: `0 0 8px ${priorityColor}` }}></span>
                          {activeCase.priority.toUpperCase()}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ color: 'var(--text-faint)' }}>ANALYST</span>
                        <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{activeCase.analyst.toUpperCase()}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: selectedEvidence ? '28px' : '48px', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        {activeCase.alias}
                      </div>

                      {!selectedEvidence && (
                        <div className="mono" style={{ fontSize: '13px', color: 'var(--c-system)', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ width: '24px', height: '1px', backgroundColor: 'var(--c-system)', opacity: 0.5 }}></span>
                          {activeCase.name}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: selectedEvidence ? 'column' : 'row', alignItems: selectedEvidence ? 'flex-start' : 'center', gap: '16px', marginTop: '0', width: selectedEvidence ? '100%' : 'auto' }}>
                    <div className="mono" style={{ display: 'flex', gap: '16px', fontSize: '10px', color: 'var(--text-faint)' }}>
                      <label className="hover-bright" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: useVit ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        <input type="checkbox" checked={useVit} onChange={e => setUseVit(e.target.checked)} style={{ accentColor: 'var(--text-main)', cursor: 'pointer' }} />
                        ViT-CORE
                      </label>
                      <label className="hover-bright" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: useC2pa ? 'var(--text-main)' : 'var(--text-muted)' }}>
                        <input type="checkbox" checked={useC2pa} onChange={e => setUseC2pa(e.target.checked)} style={{ accentColor: 'var(--text-main)', cursor: 'pointer' }} />
                        C2PA VERIFY
                      </label>
                    </div>

                    <div style={{ width: selectedEvidence ? '100%' : 'auto' }}>
                      <input type="file" id="file-upload" style={{ display: 'none' }} onChange={(e) => { if(e.target.files?.[0]) { setFile(e.target.files[0]); setIsUploading(true); } }} />
                      <button 
                        className="hover-bright mono" 
                        disabled={!useVit && !useC2pa}
                        onClick={() => document.getElementById('file-upload')?.click()} 
                        style={{ 
                          width: selectedEvidence ? '100%' : 'auto',
                          padding: '8px 16px', background: 'transparent', color: (!useVit && !useC2pa) ? 'var(--text-muted)' : 'var(--text-main)', 
                          border: '1px solid', borderColor: (!useVit && !useC2pa) ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.2)', 
                          borderRadius: '4px', fontWeight: 500, fontSize: '11px', letterSpacing: '0.1em', cursor: (!useVit && !useC2pa) ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        ＋ INGEST
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
                     <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em', fontWeight: 500 }}>EVIDENCE LEDGER</div>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                    {filteredEvidence.length === 0 ? (
                      <div style={{ padding: '24px 0', color: 'var(--text-faint)', fontSize: '14px' }}>Awaiting payload ingestion.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {filteredEvidence.map((item) => {
                          const ast = AssessmentEngine.evaluate(item);
                          const isEval = item.status !== 'COMPLETED' || !item.ai_report;
                          const cleanName = item.filename.split('_').slice(1).join('_') || item.filename;
                          const isActive = selectedEvidence?.id === item.id;
                          
                          const issuer = item.ai_report?.c2pa_data?.issuer || 'Unknown Publisher';
                          const vitRan = item.ai_report?.deepfake_probability !== null;
                          const c2paRan = item.ai_report?.c2pa_data?.raw_status !== "Bypassed by User";
                          const c2paVerified = item.ai_report?.c2pa_data?.is_signed === true;

                          const platformStatus = item.ai_report?.platform_status;
                          const c2paStatus = item.ai_report?.c2pa_data?.status;
                          
                          let finalColorType = ast.type;
                          if (ast.type === 'crit' || platformStatus === 'CRITICAL THREAT' || c2paStatus === 'BROKEN_SIGNATURE') {
                            finalColorType = 'crit';
                          } else if (platformStatus === 'UNVERIFIED' || ast.type === 'review' || ast.type === 'neutral' || ast.verdict === 'UNKNOWN') {
                            finalColorType = 'review';
                          } else {
                            finalColorType = 'trust';
                          }

                        
                          return (
                            <div key={item.id} role="button" tabIndex={0} onClick={() => setSelectedEvidence(item)}
                                 style={{ 
                                   display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', 
                                   padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', 
                                   backgroundColor: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                                   borderLeft: isActive ? '3px solid var(--text-main)' : '3px solid transparent',
                                   borderTop: '1px solid rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.02)',
                                   transition: 'all 0.2s'
                                 }}
                                 className="hover-bright">
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '13px', color: isActive ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  ● {cleanName}
                                </div>
                                
                                {!isEval && (
                                   <div className="mono" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '9px', color: 'var(--text-faint)' }}>
                                     <span style={{ color: 'var(--text-muted)', maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{issuer}</span>
                                     <span>•</span>
                                     <span style={{ color: vitRan ? 'var(--text-muted)' : 'var(--text-faint)' }}>ViT {vitRan ? '✓' : '-'}</span>
                                     <span style={{ color: c2paRan ? (c2paVerified ? 'var(--text-muted)' : 'var(--text-faint)') : 'var(--text-faint)' }}>C2PA {c2paRan ? (c2paVerified ? '✓' : '✕') : '-'}</span>
                                   </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, paddingLeft: '8px' }}>
                                {isEval ? (
                                  <div className="mono animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    <span style={{ fontSize: '10px' }}>●</span> EVALUATING
                                  </div>
                                ) : (
                                  <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-main)', fontWeight: 600 }}>
                                    <span style={{ color: `var(--c-${finalColorType})`, fontSize: '10px' }}>●</span> {ast.conf === 'N/A' ? 'N/A' : `${ast.conf}%`}
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
               <DecisionWorkspace evidence={selectedEvidence} caseEvidence={filteredEvidence} onClose={() => setSelectedEvidence(null)} />
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
              QUEUE <span style={{ color: 'var(--text-main)' }}>{activeQueueCount}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '48px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              LAST SYNC <span style={{ color: 'var(--text-muted)' }}>{lastSync}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
