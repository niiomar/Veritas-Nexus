import React, { useState } from 'react';

interface CreateCaseModalProps {
  onClose: () => void;
  onSubmit: (caseData: any) => void;
}

export const CreateCaseModal: React.FC<CreateCaseModalProps> = ({ onClose, onSubmit }) => {
  const [alias, setAlias] = useState('');
  const [name, setName] = useState('');
  const [priority, setPriority] = useState('LOW');
  const [analyst, setAnalyst] = useState('Analyst_01');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      id: crypto.randomUUID(),
      alias: alias.toUpperCase(),
      name,
      priority,
      analyst,
      created: new Date().toISOString().split('T')[0],
      count: 0
    });
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', width: '400px', padding: '32px' }}>
        <div className="mono" style={{ fontSize: '12px', color: 'var(--text-main)', letterSpacing: '0.1em', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
          INITIALIZE NEW INVESTIGATION
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="mono" style={{ display: 'block', fontSize: '10px', color: 'var(--text-faint)', marginBottom: '8px' }}>SYSTEM ALIAS (e.g. CASE-404)</label>
            <input required value={alias} onChange={e => setAlias(e.target.value)} style={{ width: '100%', backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', padding: '10px', borderRadius: '4px', fontFamily: 'inherit' }} />
          </div>

          <div>
            <label className="mono" style={{ display: 'block', fontSize: '10px', color: 'var(--text-faint)', marginBottom: '8px' }}>OPERATION NAME</label>
            <input required value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', padding: '10px', borderRadius: '4px', fontFamily: 'inherit' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label className="mono" style={{ display: 'block', fontSize: '10px', color: 'var(--text-faint)', marginBottom: '8px' }}>PRIORITY</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} style={{ width: '100%', backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', padding: '10px', borderRadius: '4px' }}>
    
                <option value="LOW">Low (Routine)</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className="mono" style={{ display: 'block', fontSize: '10px', color: 'var(--text-faint)', marginBottom: '8px' }}>ASSIGNED TO</label>
              <input required value={analyst} onChange={e => setAnalyst(e.target.value)} style={{ width: '100%', backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', padding: '10px', borderRadius: '4px', fontFamily: 'inherit' }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" onClick={onClose} className="mono hover-bright" style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}>CANCEL</button>
            <button type="submit" className="mono hover-bright" style={{ padding: '8px 16px', background: 'var(--text-main)', border: 'none', color: '#000', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>CREATE CASE</button>
          </div>
        </form>
      </div>
    </div>
  );
};
