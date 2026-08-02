import React, { useEffect, useState } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';
import type { Case, Evidence } from '../types';
import { EvidenceAPI } from '../services/api';

interface RecentlyDeletedModalProps {
  currentUserEmail: string;
  onClose: () => void;
  onRestored: () => void;
}

const formatTimeRemaining = (purgeAt?: string): string => {
  if (!purgeAt) return '';
  const msRemaining = new Date(purgeAt).getTime() - Date.now();
  if (msRemaining <= 0) return 'Purging soon';
  const hours = Math.floor(msRemaining / 3600000);
  const minutes = Math.floor((msRemaining % 3600000) / 60000);
  return hours > 0 ? `Purges in ${hours}h ${minutes}m` : `Purges in ${minutes}m`;
};

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: '16px',
};

export const RecentlyDeletedModal: React.FC<RecentlyDeletedModalProps> = ({ currentUserEmail, onClose, onRestored }) => {
  const [deletedCases, setDeletedCases] = useState<Case[]>([]);
  const [deletedEvidence, setDeletedEvidence] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [cases, evidence] = await Promise.all([
        EvidenceAPI.fetchDeletedCases(),
        EvidenceAPI.fetchDeletedEvidence(),
      ]);
      setDeletedCases(cases);
      setDeletedEvidence(evidence);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recently deleted items.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const restoreCase = async (c: Case) => {
    setRestoringId(c.id);
    try {
      await EvidenceAPI.restoreCase(c.id);
      setDeletedCases(prev => prev.filter(item => item.id !== c.id));
      onRestored();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore case.');
    } finally {
      setRestoringId(null);
    }
  };

  const restoreEvidence = async (e: Evidence) => {
    setRestoringId(e.id);
    try {
      await EvidenceAPI.restoreEvidence(e.id);
      setDeletedEvidence(prev => prev.filter(item => item.id !== e.id));
      onRestored();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore evidence.');
    } finally {
      setRestoringId(null);
    }
  };

  const isEmpty = !isLoading && deletedCases.length === 0 && deletedEvidence.length === 0;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '560px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-main)', letterSpacing: '0.1em', padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Trash2 size={16} color="var(--text-muted)" />
          RECENTLY DELETED
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isLoading && (
            <div className="mono animate-pulse" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>LOADING...</div>
          )}

          {error && (
            <div className="mono" style={{ padding: '16px 24px', color: 'var(--c-crit)', fontSize: '11px' }}>{error}</div>
          )}

          {isEmpty && (
            <div className="mono" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '11px' }}>
              Nothing here. Deleted cases and evidence show up for a short recovery window before they're permanently purged.
            </div>
          )}

          {deletedCases.length > 0 && (
            <div>
              <div className="mono" style={{ padding: '10px 16px', fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.05em', background: 'var(--bg-surface)' }}>CASES</div>
              {deletedCases.map(c => {
                const canRestore = c.created_by === currentUserEmail;
                return (
                  <div key={c.id} style={rowStyle}>
                    <div style={{ minWidth: 0 }}>
                      <div className="truncate" style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 500 }}>{c.name}</div>
                      <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '2px' }}>
                        {formatTimeRemaining(c.purge_at)}{!canRestore && ` · deleted by ${c.created_by}`}
                      </div>
                    </div>
                    {canRestore ? (
                      <button
                        onClick={() => restoreCase(c)}
                        disabled={restoringId === c.id}
                        className="mono hover-bright"
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--c-trust)', color: 'var(--c-trust)', borderRadius: '4px', cursor: restoringId === c.id ? 'default' : 'pointer', fontSize: '10px', fontWeight: 600, opacity: restoringId === c.id ? 0.5 : 1 }}
                      >
                        <RotateCcw size={12} /> RESTORE
                      </button>
                    ) : (
                      <span className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', flexShrink: 0 }}>NOT YOURS</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {deletedEvidence.length > 0 && (
            <div>
              <div className="mono" style={{ padding: '10px 16px', fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.05em', background: 'var(--bg-surface)' }}>EVIDENCE</div>
              {deletedEvidence.map(e => {
                const canRestore = e.uploaded_by === currentUserEmail;
                const displayName = e.filename?.split('_').slice(1).join('_') || e.filename;
                return (
                  <div key={e.id} style={rowStyle}>
                    <div style={{ minWidth: 0 }}>
                      <div className="truncate" style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: 500 }}>{displayName}</div>
                      <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', marginTop: '2px' }}>
                        {formatTimeRemaining(e.purge_at)}{!canRestore && ` · uploaded by ${e.uploaded_by}`}
                      </div>
                    </div>
                    {canRestore ? (
                      <button
                        onClick={() => restoreEvidence(e)}
                        disabled={restoringId === e.id}
                        className="mono hover-bright"
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--c-trust)', color: 'var(--c-trust)', borderRadius: '4px', cursor: restoringId === e.id ? 'default' : 'pointer', fontSize: '10px', fontWeight: 600, opacity: restoringId === e.id ? 0.5 : 1 }}
                      >
                        <RotateCcw size={12} /> RESTORE
                      </button>
                    ) : (
                      <span className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', flexShrink: 0 }}>NOT YOURS</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={onClose} className="mono hover-bright" style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}>CLOSE</button>
        </div>
      </div>
    </div>
  );
};
