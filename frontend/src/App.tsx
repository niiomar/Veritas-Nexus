// src/App.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, Network, Plus, Globe, FileText, ChevronRight, AlertCircle } from 'lucide-react';

import './index.css';
import type { Case, Evidence, EngineStatus } from './types';
import { EvidenceAPI } from './services/api';
import { AssessmentEngine } from './services/assessment';

import { GlobalCommandBar } from './components/GlobalCommandBar';
import { Sidebar } from './components/Sidebar';
import { TelemetrySidebar } from './components/TelemetrySidebar';
import { IngestionPipeline } from './components/IngestionPipeline';
import { DecisionWorkspace } from './components/DecisionWorkspace';

const INITIAL_CASES: Case[] = [
  { id: "ced83594-cd59-4ca9-8a0c-6733fd93dc4c", name: "Operation Blackwood", alias: "CASE-104", analyst: "Analyst_01", priority: "Critical", created: "2026-07-01", count: 14 },
  { id: "00000000-0000-0000-0000-000000000211", name: "Intercept Beta-9", alias: "CASE-211", analyst: "Analyst_04", priority: "High", created: "2026-07-08", count: 3 },
  { id: "00000000-0000-0000-0000-000000000300", name: "Routine Sweep 44", alias: "CASE-300", analyst: "Analyst_02", priority: "Routine", created: "2026-07-10", count: 42 }
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [evidenceLibrary, setEvidenceLibrary] = useState<Evidence[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [activeCase, setActiveCase] = useState<Case>(INITIAL_CASES[0]);
  
  // Dynamic Engine Telemetry State
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({ vit: 'ONLINE', c2pa: 'ONLINE' });

  // Poll Database Library
  const fetchLibrary = useCallback(async () => {
    try {
      const evidence = await EvidenceAPI.fetchLibrary();
      setEvidenceLibrary(evidence);
      setSelectedEvidence((prev) => prev ? evidence.find((e) => e.id === prev.id) || prev : null);
    } catch (err) {
      console.error("Failed to sync database:", err);
    }
  }, []);

  // Poll Engine Cluster Health
  const fetchTelemetry = useCallback(async () => {
    const status = await EvidenceAPI.checkHealth();
    setEngineStatus(status);
  }, []);

  useEffect(() => {
    fetchLibrary();
    fetchTelemetry();
    
    // Check DB every 3 seconds, Check Engines every 10 seconds
    const dbInterval = setInterval(fetchLibrary, 3000);
    const telemetryInterval = setInterval(fetchTelemetry, 10000);
    
    return () => { clearInterval(dbInterval); clearInterval(telemetryInterval); };
  }, [fetchLibrary, fetchTelemetry]);

  const handleUploadComplete = useCallback(() => {
    setIsUploading(false);
    setFile(null);
    fetchLibrary();
  }, [fetchLibrary]);

  const handleUploadError = useCallback((msg: string) => {
    setIsUploading(false);
    setFile(null);
    setUploadError(msg);
    setTimeout(() => setUploadError(null), 5000);
  }, []);

  const filteredEvidence = evidenceLibrary.filter(item => item.case_id === activeCase.id);
  const metrics = useMemo(() => filteredEvidence.reduce((acc, curr) => {
    const ast = AssessmentEngine.evaluate(curr);
    if (ast.type === 'crit') acc.critical++;
    if (ast.type === 'review') acc.conflicts++;
    return acc;
  }, { critical: 0, conflicts: 0 }), [filteredEvidence]);

  return (
    <>
      {uploadError && <div className="toast"><AlertCircle size={16} /> {uploadError}</div>}

      {isUploading && file && (
        <IngestionPipeline file={file} activeCase={activeCase} onComplete={handleUploadComplete} onError={handleUploadError} />
      )}

      {selectedEvidence && (
        <DecisionWorkspace evidence={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
      )}

      <div className="app-container">
        <GlobalCommandBar />

        <div className="main-layout">
          <Sidebar cases={INITIAL_CASES} activeCase={activeCase} onSelectCase={(c) => { setActiveCase(c); setSelectedEvidence(null); }} />

          <main className="workspace-core">
            <div className="investigation-arena">
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <span className="badge b-crit">THREAT LEVEL: {activeCase.priority.toUpperCase()}</span>
                    <span className="badge b-neutral"><User size={10} style={{display:'inline', marginRight:'4px'}}/> LEAD: {activeCase.analyst.toUpperCase()}</span>
                  </div>
                  <div className="case-id-large" style={{ fontSize: '2.5rem' }}>{activeCase.alias}</div>
                  <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{activeCase.name}</div>
                </div>
                <div>
                  <input type="file" id="file-upload" style={{ display: 'none' }} onChange={(e) => { if(e.target.files?.[0]) { setFile(e.target.files[0]); setIsUploading(true); } }} />
                  <button className="btn-sys" onClick={() => document.getElementById('file-upload')?.click()}><Plus size={16} /> INGEST PAYLOAD</button>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header"><Network size={14}/> EVIDENCE RELATIONSHIP GRAPH</div>
                <div className="panel-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', backgroundImage: 'radial-gradient(circle at 50% 50%, var(--border-color) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                   <div style={{ color: 'var(--text-faint)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Globe size={16}/> Graph visualization mapping initialized for {filteredEvidence.length} assets.</div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header"><FileText size={14}/> EVIDENCE INTELLIGENCE LEDGER</div>
                <div>
                  {filteredEvidence.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-faint)', fontSize: '0.85rem' }}>Awaiting payload ingestion.</div>
                  ) : (
                    filteredEvidence.map((item) => {
                      const ast = AssessmentEngine.evaluate(item);
                      const isEval = item.status !== 'COMPLETED' || !item.ai_report;
                      return (
                        <div key={item.id} className="ledger-commit" role="button" tabIndex={0} onClick={() => setSelectedEvidence(item)} onKeyDown={(e) => { if (e.key === 'Enter') setSelectedEvidence(item); }}>
                          <div className="commit-icon" style={{ color: isEval ? 'var(--text-muted)' : `var(--c-${ast.type})`, background: isEval ? 'var(--text-muted)' : `var(--c-${ast.type})` }}></div>
                          <div style={{ flex: '2', minWidth: 0 }}><div className="truncate" style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.filename.split('_').slice(1).join('_') || item.filename}</div><div className="mono truncate" style={{ fontSize: '0.65rem', color: 'var(--text-faint)', marginTop: '0.2rem' }}>{item.sha256}</div></div>
                          <div style={{ flex: '1', display: 'flex', gap: '0.5rem' }}>
                            {!isEval && item.ai_report?.deepfake_probability !== null && <span className="badge b-neural" title="ViT-CORE Processed">ViT</span>}
                            {!isEval && item.ai_report?.c2pa_data?.is_signed && <span className="badge b-crypto" title="C2PA Validated">C2PA</span>}
                          </div>
                          <div style={{ flex: '1.5', textAlign: 'right' }}>
                            {isEval ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} className="animate-pulse">EVALUATING...</span> : <div><div style={{ fontWeight: 700, fontSize: '0.85rem', color: `var(--c-${ast.type})` }}>{ast.verdict}</div><div className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-faint)' }}>CONF: {ast.conf}%</div></div>}
                          </div>
                          <div><ChevronRight size={16} color="var(--text-faint)" /></div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </main>

          <TelemetrySidebar metrics={metrics} engineStatus={engineStatus} />
        </div>
      </div>
    </>
  );
}
