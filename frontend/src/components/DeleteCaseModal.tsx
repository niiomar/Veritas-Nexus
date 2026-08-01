import React from 'react';
import type { Case } from '../types';

interface DeleteCaseModalProps {
  caseToDelete: Case;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteCaseModal: React.FC<DeleteCaseModalProps> = ({ caseToDelete, onClose, onConfirm }) => {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ backgroundColor: '#0a0a0c', border: '1px solid var(--c-crit)', borderRadius: '8px', width: '420px', padding: '32px', boxShadow: '0 4px 24px rgba(220, 38, 38, 0.1)' }}>
        
        <div className="mono" style={{ fontSize: '12px', color: 'var(--c-crit)', letterSpacing: '0.1em', marginBottom: '24px', borderBottom: '1px solid rgba(220, 38, 38, 0.2)', paddingBottom: '12px', fontWeight: 600 }}>
          CRITICAL ALERT: CONFIRM DELETION
        </div>

        <div style={{ color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.6', marginBottom: '32px' }}>
          Are you sure you want to delete <span className="mono" style={{ color: 'var(--text-main)', fontWeight: 600 }}>{caseToDelete.alias}</span>? 
          <br /><br />
          <span style={{ color: 'var(--text-muted)' }}>This will hide the case and its evidence immediately. You'll have a short window to undo it before it's permanently purged.</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            onClick={onClose} 
            className="mono hover-bright" 
            style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}
          >
            CANCEL
          </button>
          <button 
            onClick={onConfirm} 
            className="mono hover-bright" 
            style={{ padding: '8px 16px', background: 'var(--c-crit)', border: 'none', color: '#000', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
          >
            CONFIRM PURGE
          </button>
        </div>
      </div>
    </div>
  );
};