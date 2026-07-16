import React from 'react';
import { PenSquare, Trash2, FolderClosed } from 'lucide-react';
import type { Case, Evidence } from '../types';
import { AssessmentEngine } from '../services/assessment';

export const Sidebar: React.FC<{ 
  cases: Case[], 
  activeCase: Case | null, 
  evidenceLibrary: Evidence[],
  onSelectCase: (c: Case) => void, 
  onCreateClick: () => void, 
  onEditClick: (c: Case) => void, 
  onDeleteClick: (c: Case) => void 
}> = ({ cases, activeCase, evidenceLibrary, onSelectCase, onCreateClick, onEditClick, onDeleteClick }) => {

  const getCaseStats = (caseId: string) => {
    const caseEv = evidenceLibrary.filter(e => e.case_id === caseId);
    let verified = 0, pending = 0, critical = 0;

    caseEv.forEach(ev => {
      if (ev.status !== 'COMPLETED' || !ev.ai_report) {
        pending++;
      } else {
        const ast = AssessmentEngine.evaluate(ev);
        if (ast.type === 'trust') verified++;
        else if (ast.type === 'crit') critical++;
      }
    });

    return { total: caseEv.length, verified, pending, critical };
  };

  return (
    <div style={{ width: '280px', flexShrink: 0, backgroundColor: '#0a0a0c', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.1em' }}>ACTIVE INVESTIGATIONS</div>
        <button onClick={onCreateClick} className="hover-bright mono" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-main)', borderRadius: '4px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer' }}>+ NEW</button>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {cases.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px 0', color: 'var(--text-faint)' }}>
            <FolderClosed size={24} />
            <span className="mono" style={{ fontSize: '11px' }}>NO CASES FOUND</span>
          </div>
        ) : (
          cases.map(c => {
            const stats = getCaseStats(c.id);
            const isActive = activeCase?.id === c.id;
            
            return (
              <div key={c.id} style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.04)' : 'transparent', border: '1px solid', borderColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '8px', padding: '16px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.2s', borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent' }} onClick={() => onSelectCase(c)} className="hover-bright">
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: isActive ? 'var(--text-main)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                    {c.alias}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={(e) => { e.stopPropagation(); onEditClick(c); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: '4px' }} className="hover-bright"><PenSquare size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteClick(c); }} style={{ background: 'transparent', border: 'none', color: 'var(--c-crit)', cursor: 'pointer', padding: '4px' }} className="hover-bright"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', marginBottom: '12px' }}>
                  {stats.total} ASSET{stats.total !== 1 ? 'S' : ''}
                </div>

                <div className="mono" style={{ display: 'flex', gap: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#10b981' }}>●</span> {stats.verified} Verified
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#f59e0b' }}>●</span> {stats.pending} Pending
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#ef4444' }}>●</span> {stats.critical} Critical
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
};