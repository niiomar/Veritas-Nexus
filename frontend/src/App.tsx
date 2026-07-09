import { useState } from 'react';
import { Shield, UploadCloud, Activity, Database, Clock, Fingerprint, Lock } from 'lucide-react';

function App() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Shield className="text-accent-primary" size={32} color="#3b82f6" />
            Veritas Nexus
          </h1>
          <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>NSB // C2pa-Veritas Evidence Ingestion Node</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.9rem', fontWeight: 600 }}>
          <div style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></div>
          NODE ACTIVE
        </div>
      </header>

      {/* KPI Strip */}
      <div className="kpi-strip">
        <div className="kpi-card">
          <Activity color="#3b82f6" size={24} />
          <div className="kpi-data">
            <h4>System Status</h4>
            <p>Ready for Ingestion</p>
          </div>
        </div>
        <div className="kpi-card">
          <Database color="#8b5cf6" size={24} />
          <div className="kpi-data">
            <h4>Database Connection</h4>
            <p>PostgreSQL Synced</p>
          </div>
        </div>
        <div className="kpi-card">
          <Lock color="#10b981" size={24} />
          <div className="kpi-data">
            <h4>Security Protocol</h4>
            <p>SHA-256 Enforced</p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid-layout">
        {/* Left Column: Ingestion Pipeline */}
        <main className="panel">
          <div className="panel-header">
            <h2>Secure Upload Pipeline</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Initialize cryptographic hashing and queue evidence for ViT-CORE-FORENSICS analysis.
            </p>
          </div>
          
          <div className="upload-zone">
            <UploadCloud size={48} color="#94a3b8" style={{ margin: '0 auto 1rem auto' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Drag & Drop Evidence File</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Supports video, images, and raw data captures.
            </p>
            
            {/* Hidden file input for a cleaner UI */}
            <input 
              type="file" 
              id="evidence-upload" 
              style={{ display: 'none' }} 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <label 
              htmlFor="evidence-upload" 
              style={{ 
                backgroundColor: 'var(--bg-hover)', 
                padding: '0.5rem 1rem', 
                borderRadius: '6px', 
                cursor: 'pointer',
                fontSize: '0.9rem',
                border: '1px solid var(--border-color)'
              }}>
              Browse Files
            </label>

            {file && (
              <div style={{ marginTop: '1.5rem', color: '#10b981', fontWeight: 500 }}>
                Selected: {file.name}
              </div>
            )}
          </div>

          <button className="btn-primary">
            <Fingerprint size={20} />
            Generate Hash & Ingest Evidence
          </button>
        </main>

        {/* Right Column: Historical Actions & Provenance Context */}
        <aside className="panel">
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={20} color="#8b5cf6" />
              Historical Actions
            </h3>
          </div>
          
          <div className="timeline">
            <div className="timeline-event">
              <div>
                <span className="timeline-time">2026-07-09T12:49:23.000Z</span>
                <div className="timeline-action">System Initialized</div>
                <div className="timeline-context">Awaiting secure payload ingestion.</div>
              </div>
            </div>
            
            <div className="timeline-event" style={{ opacity: 0.5, borderLeftColor: 'var(--border-color)' }}>
              <div>
                <span className="timeline-time">Pending...</span>
                <div className="timeline-action">Provenance Graph Creation</div>
                <div className="timeline-context">Will generate upon successful SHA-256 validation.</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;