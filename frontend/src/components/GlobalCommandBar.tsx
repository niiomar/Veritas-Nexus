import React from 'react';
import { Shield } from 'lucide-react';

export const GlobalCommandBar: React.FC = () => (
  <header className="global-command-bar">
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-main)', fontWeight: 600 }}>
      <Shield size={18} color="var(--c-system)" /> 
      <span style={{ letterSpacing: '0.05em' }}>VERITAS NEXUS</span>
    </div>
    {/* Classification header removed */}
  </header>
);