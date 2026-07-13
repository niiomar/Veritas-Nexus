import React from 'react';
import type { Case } from '../types';

export const Sidebar: React.FC<{ cases: Case[], activeCase: Case, onSelectCase: (c: Case) => void }> = ({ cases, activeCase, onSelectCase }) => (
  <aside className="sidebar-cases" style={{ width: '280px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
    
    {/* HEADER */}
    <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
        ACTIVE INVESTIGATIONS
      </div>
    </div>
    
    {/* LIST */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0' }}>
      {cases.map((c) => {
        const isActive = activeCase.id === c.id;
        
        return (
          <div 
            key={c.id} 
            role="button" 
            tabIndex={0} 
            onClick={() => onSelectCase(c)} 
            onKeyDown={(e) => { if (e.key === 'Enter') onSelectCase(c); }}
            style={{ 
              padding: '0.75rem 1.5rem', 
              display: 'flex', 
              flexDirection: 'column',
              gap: '0.25rem',
              cursor: 'pointer',
              background: isActive ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
              borderLeft: `3px solid ${isActive ? 'var(--text-main)' : 'transparent'}`,
              transition: 'background 0.2s',
            }}
            // If you have a hover class in index.css like .hover-bright, you can add it here
            className="hover-bright"
          >
            <div className="mono" style={{ 
              fontSize: '0.85rem', 
              fontWeight: isActive ? 600 : 500, 
              color: isActive ? 'var(--text-main)' : 'var(--text-muted)' 
            }}>
              {c.alias}
            </div>
            
            <div style={{ 
              fontSize: '0.8rem', 
              color: isActive ? 'var(--text-muted)' : 'var(--text-faint)', 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis' 
            }}>
              {c.name}
            </div>
          </div>
        );
      })}
    </div>
    
  </aside>
);