import React from 'react';
import { Shield, LogOut } from 'lucide-react';

interface GlobalCommandBarProps {
  userEmail?: string;
  onLogout?: () => void;
}

export const GlobalCommandBar: React.FC<GlobalCommandBarProps> = ({ userEmail, onLogout }) => (
  <header className="global-command-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-main)', fontWeight: 600 }}>
      <Shield size={18} color="var(--c-system)" />
      <span style={{ letterSpacing: '0.05em' }}>VERITAS NEXUS</span>
    </div>

    {userEmail && onLogout && (
      <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.05em' }}>
        <span>{userEmail.toUpperCase()}</span>
        <button
          onClick={onLogout}
          className="hover-bright"
          title="Log out"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <LogOut size={14} /> LOG OUT
        </button>
      </div>
    )}
  </header>
);
