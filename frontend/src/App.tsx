import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';

import './index.css';
import type { Case, Evidence, EngineStatus, AuthUser } from './types';
import { EvidenceAPI } from './services/api';
import { AssessmentEngine } from './services/assessment';
import { AuthAPI, TokenStorage } from './services/auth';

import { GlobalCommandBar } from './components/GlobalCommandBar';
import { Sidebar } from './components/Sidebar';
import { CreateCaseModal } from './components/CreateCaseModal';
import { EditCaseModal } from './components/EditCaseModal';
import { DeleteCaseModal } from './components/DeleteCaseModal';
import { IngestionPipeline } from './components/IngestionPipeline';
import { DecisionWorkspace } from './components/DecisionWorkspace';
import { AuthScreen } from './components/AuthScreen';
import { RecentlyDeletedModal } from './components/RecentlyDeletedModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

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
  
  const [evidenceToDelete, setEvidenceToDelete] = useState<Evidence | null>(null);
  const [isRecentlyDeletedOpen, setIsRecentlyDeletedOpen] = useState(false);

  // Soft-deletes are recoverable server-side for a 24h grace period (see
  // api/constants.py's SOFT_DELETE_GRACE_PERIOD), but a user has no reason
  // to know that without a prompt right after the action - this surfaces a
  // short-lived Undo affordance for the "oops, wrong item" case.
  const [undoAction, setUndoAction] = useState<{ message: string; onUndo: () => void } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const offerUndo = useCallback((message: string, onUndo: () => void) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoAction({ message, onUndo });
    undoTimerRef.current = setTimeout(() => setUndoAction(null), 8000);
  }, []);

  const [engineStatus, setEngineStatus] = useState<EngineStatus>({ vit: 'ONLINE', c2pa: 'ONLINE' });
  const [lastSync, setLastSync] = useState<string>('00:00');

  // Validate any token left over from a previous session before rendering
  // the main app - a stale/expired token should drop straight to AuthScreen
  // rather than flashing the authenticated UI first.
  useEffect(() => {
    const token = TokenStorage.get();
    if (!token) { setIsCheckingAuth(false); return; }

    AuthAPI.me(token)
      .then(setCurrentUser)
      .catch(() => TokenStorage.clear())
      .finally(() => setIsCheckingAuth(false));
  }, []);

  const handleLogout = useCallback(() => {
    TokenStorage.clear();
    setCurrentUser(null);
  }, []);

  const syncDatabase = useCallback(async () => {
    try {
      const [evidenceData, caseData] = await Promise.all([
        EvidenceAPI.fetchLibrary(),
        EvidenceAPI.fetchCases(),
      ]);
      setEvidenceLibrary(evidenceData);
      setSelectedEvidence((prev) => prev ? evidenceData.find((e: Evidence) => e.id === prev.id) || prev : null);
      setCases(caseData);
      setActiveCase((prev) => prev ? caseData.find((c: Case) => c.id === prev.id) || null : null);
    } catch (err) {
      console.error("Database sync failed:", err);
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
    if (!currentUser) return;

    syncDatabase();
    fetchTelemetry();

    const dbInterval = setInterval(syncDatabase, 3000);
    const telemetryInterval = setInterval(fetchTelemetry, 10000);

    return () => { clearInterval(dbInterval); clearInterval(telemetryInterval); };
  }, [currentUser, syncDatabase, fetchTelemetry]);

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

      await syncDatabase();
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

      await syncDatabase();
      if (activeCase?.id === officialCase.id) setActiveCase(officialCase);
      setCaseToEdit(null);
    } catch (err: any) {
      setUploadError(`Case Update Failed: ${err.message}`);
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  const confirmDeleteCase = async () => {
    if (!caseToDelete) return;
    const deletedCaseId = caseToDelete.id;
    const deletedCaseName = caseToDelete.name;
    try {
      await EvidenceAPI.deleteCase(deletedCaseId);
      if (activeCase?.id === deletedCaseId) {
        setActiveCase(null);
        setSelectedEvidence(null);
      }
      await syncDatabase();
      setCaseToDelete(null);
      offerUndo(`Case "${deletedCaseName}" deleted.`, async () => {
        await EvidenceAPI.restoreCase(deletedCaseId);
        await syncDatabase();
        setUndoAction(null);
      });
    } catch (err: any) {
      setUploadError(`Case Deletion Failed: ${err.message}`);
      setTimeout(() => setUploadError(null), 5000);
    }
  };

  const confirmDeleteEvidence = async () => {
    if (!evidenceToDelete) return;
    const deletedEvidenceId = evidenceToDelete.id;

    try {
      await EvidenceAPI.deleteEvidence(deletedEvidenceId);
      if (selectedEvidence?.id === deletedEvidenceId) {
        setSelectedEvidence(null);
      }
      await syncDatabase();
      offerUndo('Evidence deleted.', async () => {
        await EvidenceAPI.restoreEvidence(deletedEvidenceId);
        await syncDatabase();
        setUndoAction(null);
      });
    } catch (err: any) {
      setUploadError(err.message || 'Failed to delete evidence.');
      setTimeout(() => setUploadError(null), 5000);
    } finally {
      setEvidenceToDelete(null);
    }
  };

  const filteredEvidence = activeCase ? evidenceLibrary.filter(item => item.case_id === activeCase.id) : [];
  const activeQueueCount = filteredEvidence.filter(item => item.status !== 'COMPLETED' || !item.ai_report).length;

  let priorityColor = 'var(--text-muted)';
  const pText = activeCase?.priority?.toLowerCase() || '';
  if (pText.includes('crit')) priorityColor = 'var(--c-crit)';
  else if (pText.includes('high')) priorityColor = 'var(--c-review)';
  else if (pText.includes('med')) priorityColor = 'var(--c-system)';
  else if (pText.includes('low') || pText.includes('routine')) priorityColor = 'var(--c-trust)';

  if (isCheckingAuth) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#050505' }}>
        <div className="mono animate-pulse" style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.1em' }}>LOADING...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onAuthenticated={setCurrentUser} />;
  }

  return (
    <>
      {uploadError && <div className="toast"><AlertCircle size={16} /> {uploadError}</div>}
      {undoAction && (
        <div className="toast-undo mono">
          {undoAction.message}
          <button onClick={undoAction.onUndo}>UNDO</button>
        </div>
      )}

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

        {isRecentlyDeletedOpen && (
          <RecentlyDeletedModal
            currentUserEmail={currentUser.email}
            onClose={() => setIsRecentlyDeletedOpen(false)}
            onRestored={syncDatabase}
          />
        )}

        {evidenceToDelete && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 5, 5, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#0a0a0a', border: '1px solid rgba(220, 38, 38, 0.4)', borderRadius: '6px', padding: '24px', width: '420px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(220, 38, 38, 0.1)' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--c-crit)', borderBottom: '1px solid rgba(220, 38, 38, 0.2)', paddingBottom: '12px' }}>
                <AlertCircle size={20} />
                <h2 className="mono" style={{ margin: 0, fontSize: '13px', letterSpacing: '0.15em', fontWeight: 600 }}>CONFIRM DELETION</h2>
              </div>
              
              <div style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Are you sure you want to purge the asset <strong style={{ color: 'var(--text-main)', fontWeight: 600 }}>{evidenceToDelete.filename.split('_').slice(1).join('_') || evidenceToDelete.filename}</strong>? 
                <br /><br />
                This will hide the item immediately. You'll have a short window to undo it before it's permanently purged.
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '4px' }}>
                <button 
                  onClick={() => setEvidenceToDelete(null)}
                  className="hover-bright mono"
                  style={{ padding: '8px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-main)', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em' }}
                >
                  CANCEL
                </button>
                <button 
                  onClick={confirmDeleteEvidence}
                  className="hover-bright mono"
                  style={{ padding: '8px 20px', background: 'rgba(220, 38, 38, 0.15)', border: '1px solid var(--c-crit)', color: 'var(--c-crit)', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em' }}
                >
                  PURGE EVIDENCE
                </button>
              </div>

            </div>
          </div>
        )}

        {isUploading && file && activeCase && (
          <IngestionPipeline file={file} activeCase={activeCase} useVit={useVit} useC2pa={useC2pa} onComplete={handleUploadComplete} onError={handleUploadError} />
        )}
      </div>

      <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#050505' }}>
        <GlobalCommandBar
          userEmail={currentUser.email}
          onLogout={handleLogout}
          onOpenRecentlyDeleted={() => setIsRecentlyDeletedOpen(true)}
        />

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
                   INITIALIZATION NEW CASE
                 </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: selectedEvidence ? 'column' : 'row', justifyContent: 'space-between', alignItems: selectedEvidence ? 'flex-start' : 'center', gap: '24px', marginBottom: '24px', flexShrink: 0 }}>
                  
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

                          // --- SYNCHRONIZED LEDGER STATUS COLORS ---
                          let statusHex = '#38bdf8'; // Sky Blue for Unverified
                          if (platformStatus === 'REJECTED') {
                            statusHex = '#a855f7'; // Vivid Purple for Rejected
                          } else if (ast.verdict === 'CRITICAL' || platformStatus === 'CRITICAL THREAT' || c2paStatus === 'INVALID') {
                            statusHex = '#ef4444'; // Red
                          } else if (ast.verdict === 'CONFLICT' || platformStatus === 'CONFLICT') {
                            statusHex = '#f59e0b'; // Amber/Orange
                          } else if (ast.verdict === 'TRUSTED' || ast.verdict === 'VERIFIED') {
                            statusHex = '#10b981'; // Green
                          } else if (ast.verdict === 'INCONCLUSIVE') {
                            statusHex = '#64748b'; // Dimmed Slate for Inconclusive
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

                              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, paddingLeft: '8px', gap: '16px' }}>
                                {isEval ? (
                                  <div className="mono animate-pulse" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    <span style={{ fontSize: '10px' }}>●</span> EVALUATING
                                  </div>
                                ) : (
                                  <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-main)', fontWeight: 600 }}>
                                    <span style={{ color: statusHex, fontSize: '10px' }}>●</span> {ast.conf === 'N/A' ? 'N/A' : `${ast.conf}%`}
                                  </div>
                                )}

                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEvidenceToDelete(item);
                                  }}
                                  className="hover-bright"
                                  title="Delete Evidence"
                                  style={{ 
                                    background: 'transparent', 
                                    border: 'none', 
                                    color: 'var(--c-crit)', 
                                    cursor: 'pointer', 
                                    padding: '4px', 
                                    display: 'flex',
                                    alignItems: 'center',
                                    opacity: isActive ? 1 : 0.4,
                                    transition: 'opacity 0.2s'
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
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

          {selectedEvidence && activeCase && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', backgroundColor: '#050505', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
               <DecisionWorkspace evidence={selectedEvidence} caseEvidence={filteredEvidence} onClose={() => setSelectedEvidence(null)} />
            </div>
          )}
        </div>
        
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
