import React from 'react';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import type { Case, Evidence } from '../types';
import { AssessmentEngine } from '../services/assessment';

interface SidebarProps {
  cases: Case[];
  activeCase: Case | null;
  evidenceLibrary: Evidence[];
  onSelectCase: (c: Case) => void;
  onCreateClick: () => void;
  onEditClick: (c: Case) => void;
  onDeleteClick: (c: Case) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ cases, activeCase, evidenceLibrary, onSelectCase, onCreateClick, onEditClick, onDeleteClick }) => {
  return (
    <aside style={{ width: '280px', backgroundColor: 'var(--bg-base)', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.15em' }}>ACTIVE INVESTIGATIONS</div>
          <button onClick={onCreateClick} className="hover-bright mono" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
            <Plus size={12} /> NEW
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cases.map(c => {
            const isActive = activeCase?.id === c.id;
            const caseEv = evidenceLibrary.filter(e => String(e.case_id) === String(c.id));
            
            let trusted = 0, review = 0, critical = 0;
            caseEv.forEach(e => {
               if (e.status === 'COMPLETED' && e.ai_report) {
                 const ast = AssessmentEngine.evaluate(e);
                 const type = ast.type?.toLowerCase() || '';
                 
                 if (type.includes('succ') || type.includes('verif') || type.includes('trusted') || type.includes('trust')) trusted++;
                 else if (type.includes('warn') || type.includes('review')) review++;
                 else if (type.includes('crit') || type.includes('threat')) critical++;
               }
            });

            return (
              <div key={c.id} 
                   onClick={() => onSelectCase(c)}
                   style={{ 
                     backgroundColor: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                     border: '1px solid',
                     borderColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                     borderRadius: '6px', padding: '16px', cursor: 'pointer',
                     transition: 'all 0.2s',
                     position: 'relative'
                   }}
                   className="case-card hover-bright">
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: isActive ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    {c.alias}
                  </div>
                  
                  {isActive && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={(e) => { e.stopPropagation(); onEditClick(c); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }} className="hover-bright">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteClick(c); }} style={{ background: 'transparent', border: 'none', color: 'var(--c-crit)', cursor: 'pointer', padding: '4px' }} className="hover-bright">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)' }}>
                  {caseEv.length} ASSETS
                </div>
                
                <div className="mono" style={{ display: 'flex', gap: '12px', fontSize: '10px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981' }}>● <span style={{ color: 'var(--text-muted)' }}>{trusted}</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>● <span style={{ color: 'var(--text-muted)' }}>{review}</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444' }}>● <span style={{ color: 'var(--text-muted)' }}>{critical}</span></div>
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};