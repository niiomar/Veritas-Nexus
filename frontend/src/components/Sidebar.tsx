import React from 'react';
import type { Case, Evidence } from '../types';
import { AssessmentEngine } from '../services/assessment';

interface SidebarProps {
  cases: Case[];
  activeCase: Case | null;
  evidenceLibrary: Evidence[];
  onSelectCase: (c: Case) => void;
  onCreateClick: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ cases, activeCase, evidenceLibrary, onSelectCase, onCreateClick }) => {
  return (
    <aside style={{
      width: '320px',
      backgroundColor: '#0a0a0c',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0
    }}>
      <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="mono" style={{ fontSize: '11px', letterSpacing: '0.15em', fontWeight: 500, color: 'var(--text-faint)' }}>
          ACTIVE INVESTIGATIONS
        </div>
        <button 
          onClick={onCreateClick} 
          className="mono hover-bright" 
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-main)', borderRadius: '4px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer' }}
        >
          + NEW
        </button>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {cases.length === 0 ? (
          <div className="mono" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '11px', letterSpacing: '0.1em' }}>
            NO ACTIVE CASES
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {cases.map((c) => {
              const isActive = activeCase !== null && c.id === activeCase.id;
              
              // DYNAMIC CALCULATION: Replaces the fake math with exact library data
              const caseEvidence = evidenceLibrary.filter(e => e.case_id === c.id);
              const stats = caseEvidence.reduce((acc, item) => {
                const verdict = AssessmentEngine.evaluate(item);
                if (verdict.type === 'safe') acc.safe++;
                if (verdict.type === 'warn') acc.warn++;
                if (verdict.type === 'crit') acc.crit++;
                return acc;
              }, { safe: 0, warn: 0, crit: 0 });

              return (
                <div 
                  key={c.id}
                  onClick={() => onSelectCase(c)}
                  className="hover-bright"
                  style={{
                    padding: '16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.04)' : 'transparent',
                    border: '1px solid',
                    borderColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: isActive ? 'var(--text-main)' : 'var(--text-muted)' }}>
                      {c.alias}
                    </div>
                    
                    <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.05em' }}>
                      {caseEvidence.length} ASSETS
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: 'var(--c-safe)', fontSize: '10px' }}>●</span> {stats.safe}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: 'var(--c-warn)', fontSize: '10px' }}>●</span> {stats.warn}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: 'var(--c-crit)', fontSize: '10px' }}>●</span> {stats.crit}
                      </div>
                    </div>
                    
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
