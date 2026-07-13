import React, { useMemo, useState } from 'react';
import type { Evidence } from '../types';
import { AssessmentEngine } from '../services/assessment';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const DecisionWorkspace: React.FC<{ evidence: Evidence, onClose: () => void }> = ({ evidence, onClose }) => {
  const assessment = useMemo(() => AssessmentEngine.evaluate(evidence), [evidence]);
  const isEval = evidence.status !== 'COMPLETED' || !evidence.ai_report;
  const c2pa = evidence.ai_report?.c2pa_data;
  const vitProb = evidence.ai_report?.deepfake_probability;
  
  const history = c2pa?.manifest_history?.length 
    ? c2pa.manifest_history 
    : [{ action: 'Origin', agent: 'Unknown Sensor/Software', timestamp: evidence.created_at || 'Unknown' }];

  const [activeTab, setActiveTab] = useState<'SOURCE' | 'HEATMAP' | 'OVERLAY'>('SOURCE');
  const [imageFailed, setImageFailed] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // CACHE BUSTER ADDED: Forces the browser to actually hit the backend instead of using old 404s
  const getImageUrl = (tab: string) => {
    const cacheBuster = `?t=${new Date().getTime()}`;
    if (tab === 'HEATMAP') return `${API_BASE_URL}/api/v1/evidence/${evidence.id}/heatmap${cacheBuster}`;
    if (tab === 'OVERLAY') return `${API_BASE_URL}/api/v1/evidence/${evidence.id}/overlay${cacheBuster}`;
    return `${API_BASE_URL}/api/v1/evidence/${evidence.id}/download${cacheBuster}`;
  };

  return (
    <div className="decision-workspace" style={{ 
      display: 'flex', flexDirection: 'column', height: '100%', width: '100%', 
      backgroundColor: '#050505', overflowY: 'auto', overflowX: 'hidden' 
    }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px', position: 'sticky', top: 0, backgroundColor: 'rgba(5, 5, 5, 0.95)', zIndex: 10, borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
        <div className="mono" style={{ fontSize: '11px', letterSpacing: '0.15em', fontWeight: 500, color: 'var(--text-faint)' }}>
          VERITAS NEXUS / DOSSIER
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.1em' }} className="mono hover-bright">
          CLOSE ✕
        </button>
      </div>

      {isEval ? (
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'flex-start', padding: '120px 48px', color: 'var(--text-muted)' }}>
          <div className="mono animate-pulse" style={{ letterSpacing: '0.1em', fontSize: '14px' }}>EXECUTING FUSION PROTOCOLS...</div>
        </div>
      ) : (
        <div style={{ maxWidth: '1200px', margin: '0', padding: '64px 48px 160px', display: 'flex', flexDirection: 'column', width: '100%' }}>
          
          {/* LAYER 1: VERDICT & ViT-CORE INTERACTIVE PREVIEW */}
          <div style={{ paddingBottom: '120px', display: 'grid', gridTemplateColumns: '1fr 420px', gap: '64px', alignItems: 'start' }}>
            
            {/* Left: The Verdict & Reasoning */}
            <div>
              <div className="mono" style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
                {evidence.filename}
              </div>
              
              <div className="mono" style={{ color: 'var(--text-faint)', fontSize: '12px', letterSpacing: '0.15em', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: `var(--c-${assessment.type})` }}>████</span>
                FINAL ASSESSMENT
              </div>

              <h1 style={{ fontSize: '72px', fontWeight: 800, letterSpacing: '-0.04em', margin: '0 0 16px 0', lineHeight: 1, color: `var(--c-${assessment.type})` }}>
                {assessment.verdict.toUpperCase()}
              </h1>
              
              <div style={{ fontSize: '24px', fontWeight: 500, color: `var(--c-${assessment.type})`, marginBottom: '48px' }}>
                {assessment.conf}% <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>System Confidence</span>
              </div>

              {/* Assessment Rationale Chain */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '32px' }}>
                <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em', marginBottom: '24px' }}>
                  ASSESSMENT RATIONALE
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '16px', color: 'var(--text-muted)' }}>
                  <div>{c2pa?.is_signed ? '✓ Cryptographic signature verified' : '⚠ Missing C2PA provenance manifest'}</div>
                  {c2pa?.is_signed && <div>✓ Issuer matches trusted authority ({c2pa.issuer})</div>}
                  <div>{vitProb !== null && vitProb > 0.15 ? '⚠ Neural artifacts inconsistent with authentic sensor noise' : '✓ No visual anomalies detected by AI Engine'}</div>
                  {vitProb !== null && <div>{vitProb > 0.15 ? '⚠' : '✓'} ViT-CORE Synthetic Probability: {(vitProb * 100).toFixed(1)}%</div>}
                </div>
              </div>
            </div>

            {/* Right: ViT-CORE Interactive Tool */}
            <div style={{ width: '100%', backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden', marginTop: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['SOURCE', 'HEATMAP', 'OVERLAY'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => { 
                      setActiveTab(tab as any); 
                      setImageFailed(false); 
                    }}
                    className="mono hover-bright"
                    style={{ 
                      padding: '12px 0', background: 'transparent', border: 'none', 
                      borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                      color: activeTab === tab ? '#3b82f6' : 'var(--text-muted)',
                      fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div style={{ width: '100%', aspectRatio: '1 / 1', backgroundColor: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {imageFailed ? (
                   <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                     <div className="mono" style={{ fontSize: '11px', letterSpacing: '0.1em', marginBottom: '8px' }}>ARTIFACT UNAVAILABLE</div>
                     <div style={{ fontSize: '12px' }}>{activeTab} endpoint error</div>
                   </div>
                ) : (
                  <img 
                    key={activeTab} // Force re-render when tab changes
                    src={getImageUrl(activeTab)} 
                    alt={`Forensic ${activeTab}`} 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={() => setImageFailed(true)}
                    onLoad={() => setImageFailed(false)}
                  />
                )}
              </div>
              <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', background: 'rgba(255,255,255,0.02)' }}>
                <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', padding: '2px 6px', borderRadius: '2px' }}>ViT-CORE INFERENCE</span>
                <span>{evidence.filename.split('.').pop()?.toUpperCase()}</span>
              </div>
            </div>

          </div>

          {/* LAYER 2: PROVENANCE */}
          <div style={{ paddingBottom: '120px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '32px' }}>
              <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em', paddingTop: '4px' }}>
                PROVENANCE GRAPH
              </div>
              
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', width: '100%', paddingTop: '8px' }}>
                <div style={{ position: 'absolute', top: '32px', left: '24px', right: '24px', height: '2px', backgroundColor: 'rgba(255,255,255,0.1)', zIndex: 0 }}></div>

                {history.map((node, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', zIndex: 1, width: '120px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#050505', border: `2px solid #3b82f6`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div className="mono" style={{ fontSize: '10px', color: 'var(--text-main)', fontWeight: 600, letterSpacing: '0.05em', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '4px', marginBottom: '8px', display: 'inline-block', backgroundColor: '#050505' }}>
                        {node.action.toUpperCase()}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px' }}>
                        {node.agent}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* LAYER 3: CRYPTOGRAPHIC IDENTITY */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '32px' }}>
              <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em', paddingTop: '4px' }}>
                CRYPTOGRAPHIC IDENTITY
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div>
                  <button 
                    onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
                    className="mono hover-bright"
                  >
                    <span style={{ fontSize: '11px', letterSpacing: '0.15em', fontWeight: 500 }}>
                      {isDetailsOpen ? '− HIDE EVIDENCE DETAILS' : '+ SHOW EVIDENCE DETAILS'}
                    </span>
                  </button>
                </div>

                {isDetailsOpen && (
                  c2pa?.is_signed ? (
                    <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '40px', color: '#0f172a', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#10b981', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                          {c2pa.issuer.charAt(0)}
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.02em' }}>{c2pa.issuer}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '20px', fontWeight: 500, marginBottom: '8px' }}>This asset is cryptographically signed by {c2pa.issuer}</div>
                        <div style={{ fontSize: '15px', color: '#475569' }}>This manifest attests that {c2pa.issuer} has cryptographically signed the SHA-256 hash of this image.</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginTop: '16px' }}>
                        <div>
                           <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Image SHA-256 Hash</div>
                           <div className="mono" style={{ fontSize: '11px', wordBreak: 'break-all', color: '#0f172a' }}>{evidence.sha256}</div>
                           
                           <div style={{ fontSize: '12px', color: '#64748b', marginTop: '24px', marginBottom: '4px' }}>Signed At</div>
                           <div className="mono" style={{ fontSize: '12px', color: '#0f172a' }}>{c2pa.timestamp}</div>
                        </div>
                        <div>
                           <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Algorithm</div>
                           <div className="mono" style={{ fontSize: '12px', color: '#0f172a' }}>{c2pa.algorithm}</div>

                           <div style={{ fontSize: '12px', color: '#64748b', marginTop: '24px', marginBottom: '4px' }}>Digital Signature</div>
                           <div className="mono" style={{ fontSize: '11px', wordBreak: 'break-all', color: '#0f172a' }}>
                             {c2pa.signature || 'Signature data unavailable'}
                           </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginTop: '16px', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '24px' }}>
                        {['Download Manifest', 'Copy SHA256', 'Export Report', 'View Raw Claim', 'Verify Signature'].map(action => (
                           <button key={action} style={{ background: 'transparent', border: 'none', padding: 0, color: '#3b82f6', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
                             {action}
                           </button>
                        ))}
                      </div>

                    </div>
                  ) : (
                    <div style={{ fontSize: '16px', color: 'var(--text-muted)' }}>No cryptographic signature available to render credential card.</div>
                  )
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};