import React from 'react';
import { Edit2, Trash2, Plus } from 'lucide-react';
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

export const Sidebar: React.FC<SidebarProps> = ({
  cases, activeCase, evidenceLibrary, onSelectCase, onCreateClick, onEditClick, onDeleteClick
}) => {
  return (
    <aside style={{ width: '280px', flexShrink: 0, backgroundColor: '#0a0a0c', borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em' }}>ACTIVE INVESTIGATIONS</div>
        <button onClick={onCreateClick} className="hover-bright mono" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-main)', borderRadius: '4px', padding: '4px 8px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Plus size={12} /> NEW
        </button>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {cases.map((c) => {
            const isActive = activeCase?.id === c.id;
            const caseEv = evidenceLibrary.filter(e => e.case_id === c.id);
            
            // 6-TIER STATS CALCULATION
            const stats = caseEv.reduce((acc, ev) => {
              const { verdict } = AssessmentEngine.evaluate(ev);
              const platformStatus = ev.ai_report?.platform_status;
              const c2paStatus = ev.ai_report?.c2pa_data?.status;

              if (platformStatus === 'REJECTED') {
                acc.rejected++;
              } else if (verdict === 'CRITICAL' || platformStatus === 'CRITICAL THREAT' || c2paStatus === 'BROKEN_SIGNATURE') {
                acc.critical++;
              } else if (verdict === 'CONFLICT' || platformStatus === 'CONFLICT') {
                acc.conflict++;
              } else if (verdict === 'TRUSTED' || verdict === 'VERIFIED') {
                acc.verified++;
              } else if (verdict === 'INCONCLUSIVE') {
                acc.inconclusive++;
              } else {
                acc.unverified++;
              }
              return acc;
            }, { verified: 0, unverified: 0, conflict: 0, critical: 0, inconclusive: 0, rejected: 0 });

            return (
              <div key={c.id} onClick={() => onSelectCase(c)} style={{
                backgroundColor: isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
                border: '1px solid',
                borderColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                borderRadius: '8px',
                padding: '16px',
                cursor: 'pointer',
                position: 'relative',
                borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                transition: 'all 0.2s'
              }} className="hover-bright">
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{c.alias || c.name}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={(e) => { e.stopPropagation(); onEditClick(c); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }} className="hover-bright"><Edit2 size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteClick(c); }} style={{ background: 'transparent', border: 'none', color: 'var(--c-crit)', cursor: 'pointer', padding: 0 }} className="hover-bright"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', marginBottom: '12px' }}>
                  {caseEv.length} ASSETS
                </div>
                
                {/* 6-TIER UI GRID */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', 
                  rowGap: '10px', 
                  columnGap: '8px', 
                  fontSize: '10px', 
                  whiteSpace: 'nowrap' 
                }} className="mono">
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: stats.verified > 0 ? '#10b981' : 'rgba(255,255,255,0.1)' }}></div>
                    <span style={{ color: 'var(--text-muted)' }}><span style={{color: stats.verified > 0 ? 'var(--text-main)' : 'var(--text-faint)'}}>{stats.verified}</span> Verified</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: stats.unverified > 0 ? '#cbd5e1' : 'rgba(255,255,255,0.1)' }}></div>
                    <span style={{ color: 'var(--text-muted)' }}><span style={{color: stats.unverified > 0 ? 'var(--text-main)' : 'var(--text-faint)'}}>{stats.unverified}</span> Unverified</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: stats.conflict > 0 ? '#f59e0b' : 'rgba(255,255,255,0.1)', boxShadow: stats.conflict > 0 ? '0 0 8px rgba(245,158,11,0.4)' : 'none' }}></div>
                    <span style={{ color: 'var(--text-muted)' }}><span style={{color: stats.conflict > 0 ? 'var(--text-main)' : 'var(--text-faint)'}}>{stats.conflict}</span> Conflict</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: stats.critical > 0 ? '#ef4444' : 'rgba(255,255,255,0.1)', boxShadow: stats.critical > 0 ? '0 0 8px rgba(239,68,68,0.4)' : 'none' }}></div>
                    <span style={{ color: 'var(--text-muted)' }}><span style={{color: stats.critical > 0 ? 'var(--text-main)' : 'var(--text-faint)'}}>{stats.critical}</span> Critical</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: stats.inconclusive > 0 ? '#64748b' : 'rgba(255,255,255,0.1)' }}></div>
                    <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}><span style={{color: stats.inconclusive > 0 ? 'var(--text-main)' : 'var(--text-faint)'}}>{stats.inconclusive}</span> Inconclusive</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    
                    {/*  Vivid Violet for Rejected */}
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: stats.rejected > 0 ? '#8b5cf6' : 'rgba(255,255,255,0.1)' }}></div>
                    <span style={{ color: 'var(--text-muted)' }}><span style={{color: stats.rejected > 0 ? 'var(--text-main)' : 'var(--text-faint)'}}>{stats.rejected}</span> Rejected</span>
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
