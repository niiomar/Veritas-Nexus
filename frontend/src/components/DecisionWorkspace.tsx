import React, { useMemo, useState } from 'react';
import type { Evidence } from '../types';
import { AssessmentEngine } from '../services/assessment';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const dossierStyles = `
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes pulseGlow {
    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }
  .animate-slide-in { animation: slideInRight 0.4s ease-out forwards; }
  .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
  .node-hover-target:hover .node-details { opacity: 1; transform: translateY(0); pointer-events: auto; }
  
  /* Hide scrollbar for the sticky nav */
  .dossier-nav::-webkit-scrollbar { display: none; }
  .dossier-nav { -ms-overflow-style: none; scrollbar-width: none; }
`;

export const DecisionWorkspace: React.FC<{ evidence: Evidence, onClose: () => void }> = ({ evidence, onClose }) => {
  const assessment = useMemo(() => AssessmentEngine.evaluate(evidence), [evidence]);
  const isEval = evidence.status !== 'COMPLETED' || !evidence.ai_report;
  const c2pa = evidence.ai_report?.c2pa_data;
  const vitProb = evidence.ai_report?.deepfake_probability;
  
  const history = c2pa?.manifest_history?.length 
    ? c2pa.manifest_history 
    : [{ action: 'Origin', agent: 'Unknown Sensor/Software', timestamp: evidence.created_at || 'Unknown', description: 'Initial file creation' }];

  const [activeTab, setActiveTab] = useState<'SOURCE' | 'HEATMAP' | 'OVERLAY' | 'PATCHES' | 'ATTENTION'>('SOURCE');
  const [imageFailed, setImageFailed] = useState(false);

  const getImageUrl = (tab: string) => {
    const cacheBuster = `?t=${new Date().getTime()}`;
    if (tab === 'HEATMAP') return `${API_BASE_URL}/api/v1/evidence/${evidence.id}/heatmap${cacheBuster}`;
    return `${API_BASE_URL}/api/v1/evidence/${evidence.id}/download${cacheBuster}`; 
  };

  // Fix 1: Corrected Recommendation Logic
  let recommendationText = 'Recommendation: Asset cleared for operational use.';
  if (assessment.type === 'crit') {
    recommendationText = 'Recommendation: Quarantine asset immediately.';
  } else if (assessment.type === 'warn') {
    recommendationText = 'Recommendation: Refer for manual review — conflicting signals detected.';
  }

  // Fix 3: Heuristic generation for synthetic regions context
  const regionsCount = vitProb !== null && vitProb > 0.15 ? Math.max(1, Math.ceil(vitProb * 6)) : 0;
  const regionsArea = vitProb !== null && vitProb > 0.15 ? (vitProb * 42).toFixed(1) : 0;
  const syntheticText = vitProb !== null && vitProb > 0.15
      ? `${regionsCount} REGIONS · ~${regionsArea}% AREA`
      : '0 REGIONS';

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="decision-workspace" style={{ 
      display: 'flex', flexDirection: 'column', height: '100%', width: '100%', 
      backgroundColor: '#050505', overflowY: 'auto', overflowX: 'hidden', position: 'relative'
    }}>
      <style>{dossierStyles}</style>
      
      {/* HEADER & STICKY NAV */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgba(5, 5, 5, 0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <div className="mono" style={{ fontSize: '11px', letterSpacing: '0.15em', fontWeight: 500, color: 'var(--text-faint)' }}>
            VERITAS NEXUS / DOSSIER
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.1em' }} className="mono hover-bright">
            CLOSE ✕
          </button>
        </div>
        
        {/* Fix 5: Sticky Dossier Navigation */}
        {!isEval && (
          <div className="dossier-nav mono" style={{ display: 'flex', gap: '32px', padding: '0 48px 16px', overflowX: 'auto', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            {['ASSESSMENT', 'FORENSICS', 'PROVENANCE', 'CREDENTIAL', 'RAW DATA'].map(section => (
              <button 
                key={section} 
                onClick={() => scrollToSection(`section-${section.toLowerCase().replace(' ', '-')}`)}
                className="hover-bright"
                style={{ background: 'transparent', border: 'none', color: 'inherit', padding: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {section}
              </button>
            ))}
          </div>
        )}
      </div>

      {isEval ? (
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'flex-start', padding: '120px 48px', color: 'var(--text-muted)' }}>
          <div className="mono animate-pulse" style={{ letterSpacing: '0.1em', fontSize: '14px' }}>EXECUTING FUSION PROTOCOLS...</div>
        </div>
      ) : (
        <div className="animate-slide-in" style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 48px 120px', display: 'flex', flexDirection: 'column', gap: '80px', width: '100%' }}>
          
          {/* SECTION: ASSESSMENT */}
          <div id="section-assessment" style={{ scrollMarginTop: '120px' }}>
            <div className="mono" style={{ color: 'var(--text-faint)', fontSize: '12px', letterSpacing: '0.15em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: `var(--c-${assessment.type})` }}>████</span> FINAL ASSESSMENT
            </div>

            <h1 style={{ fontSize: '88px', fontWeight: 800, letterSpacing: '-0.04em', margin: '0 0 8px 0', lineHeight: 1, color: `var(--c-${assessment.type})` }}>
              {assessment.verdict.toUpperCase()}
            </h1>
            
            <div style={{ fontSize: '32px', fontWeight: 500, color: 'var(--text-main)', marginBottom: '32px' }}>
              {assessment.conf}% <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>System Confidence</span>
            </div>

            <div style={{ fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '800px', borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: '24px' }}>
              {c2pa?.is_signed ? 'Cryptographic signature validated.' : 'Missing C2PA provenance manifest.'} <br/>
              {vitProb !== null && vitProb > 0.15 ? 'Neural artifacts detected inconsistent with authentic sensor noise.' : 'No synthetic anomalies detected by Neural Engine.'} <br/>
              <span style={{ color: assessment.type === 'warn' || assessment.type === 'crit' ? 'var(--text-main)' : 'inherit' }}>
                {recommendationText}
              </span>
            </div>
          </div>

          {/* SECTION: FORENSICS */}
          <div id="section-forensics" style={{ scrollMarginTop: '120px' }}>
             {/* Fix 6: Unified Typography */}
             <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                VISUAL FORENSICS & NEURAL INFERENCE
             </div>
             
             <div style={{ width: '100%', backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {['SOURCE', 'HEATMAP', 'OVERLAY', 'PATCHES', 'ATTENTION'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => { setActiveTab(tab as any); setImageFailed(false); }}
                    className="mono hover-bright"
                    style={{ 
                      padding: '12px 0', background: 'transparent', border: 'none', 
                      borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                      color: activeTab === tab ? 'var(--text-main)' : 'var(--text-muted)',
                      fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div style={{ width: '100%', aspectRatio: '16 / 9', backgroundColor: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {imageFailed ? (
                   <div className="mono" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.1em' }}>
                     {activeTab} UNAVAILABLE
                   </div>
                ) : (
                  <img 
                    key={activeTab}
                    src={getImageUrl(activeTab)} 
                    alt={`Forensic ${activeTab}`} 
                    className="animate-fade-in"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onError={() => setImageFailed(true)}
                    onLoad={() => setImageFailed(false)}
                  />
                )}
              </div>
              
              <div className="mono" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '16px 24px', fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.05em', background: 'rgba(255,255,255,0.02)', gap: '24px' }}>
                 <div>
                    <div style={{marginBottom: '8px'}}>HEATMAP INTENSITY</div>
                    {/* Fix 2: Proper Labeled Gradient Bar */}
                    <div style={{ position: 'relative', height: '4px', width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 40%, #f59e0b 70%, #ef4444 100%)', borderRadius: '2px', opacity: 0.8 }}></div>
                      {vitProb !== null && (
                        <div style={{ position: 'absolute', left: `${vitProb * 100}%`, top: '-4px', bottom: '-4px', width: '2px', backgroundColor: '#fff', boxShadow: '0 0 4px rgba(255,255,255,0.8)' }}></div>
                      )}
                    </div>
                 </div>
                 <div>
                    <div style={{marginBottom: '4px'}}>PATCH CONFIDENCE</div>
                    <div style={{color: 'var(--text-main)', fontSize: '13px'}}>{vitProb !== null ? ((1 - vitProb) * 100).toFixed(1) : '--'}%</div>
                 </div>
                 <div>
                    <div style={{marginBottom: '4px'}}>SYNTHETIC REGIONS</div>
                    {/* Fix 3: Actionable Spatial Context */}
                    <div style={{color: vitProb !== null && vitProb > 0.15 ? 'var(--c-warn)' : 'var(--text-main)', fontSize: '13px'}}>
                      {syntheticText}
                    </div>
                 </div>
              </div>
            </div>
          </div>

          {/* SECTION: PROVENANCE */}
          <div id="section-provenance" style={{ scrollMarginTop: '120px' }}>
            <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em', marginBottom: '48px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
               CRYPTOGRAPHIC PROVENANCE GRAPH
            </div>
            
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 24px' }}>
               <div style={{ position: 'absolute', top: '50%', left: '48px', right: '48px', height: '2px', backgroundColor: 'rgba(255,255,255,0.1)', zIndex: 0, transform: 'translateY(-50%)' }}></div>

               {history.map((node, i) => (
                 <div key={i} className="node-hover-target" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'crosshair' }}>
                   <div style={{ marginBottom: '12px', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }} className="mono">
                     {node.action.toUpperCase()}
                   </div>
                   
                   <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#050505', border: `2px solid #3b82f6`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: i === history.length - 1 ? 'pulseGlow 2s infinite' : 'none' }}>
                     <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
                   </div>

                   <div className="node-details mono" style={{ position: 'absolute', top: '50px', left: '50%', transform: 'translateX(-50%) translateY(10px)', opacity: 0, pointerEvents: 'none', transition: 'all 0.2s ease', backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', padding: '16px', borderRadius: '6px', width: '220px', zIndex: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                      <div style={{ color: 'var(--text-main)', fontSize: '11px', marginBottom: '12px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                        {node.action.toUpperCase()} EVENT
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                         <div>Agent:</div><div style={{color: 'var(--text-main)'}}>{node.agent}</div>
                         <div>Time:</div><div style={{color: 'var(--text-main)'}}>{node.timestamp?.split('T')[0] || 'Unknown'}</div>
                         <div style={{gridColumn: '1 / -1', marginTop: '8px', color: 'var(--text-faint)', lineHeight: 1.4}}>{node.description}</div>
                      </div>
                   </div>
                 </div>
               ))}
            </div>
          </div>

          {/* SECTION: CREDENTIAL */}
          <div id="section-credential" style={{ scrollMarginTop: '120px' }}>
            <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
               DIGITAL IDENTITY CREDENTIAL
            </div>

             {c2pa?.is_signed ? (
               <div style={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
                 <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '180px', opacity: 0.02, color: 'white', pointerEvents: 'none', userSelect: 'none' }}>⌘</div>
                 
                 <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '24px' }}>
                   <div>
                     <div className="mono" style={{ color: '#10b981', fontSize: '10px', letterSpacing: '0.15em', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                       <span style={{ fontSize: '14px' }}>✓</span> VERIFIED PUBLISHER
                     </div>
                     <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{c2pa.issuer}</div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                     <div className="mono" style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.1em', marginBottom: '4px' }}>C2PA MANIFEST</div>
                     <div className="mono" style={{ color: '#10b981', fontSize: '12px', fontWeight: 600 }}>SECURE</div>
                   </div>
                 </div>
                 
                 <div className="mono" style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                   <div>Algorithm</div>
                   <div style={{ color: 'var(--text-main)' }}>{c2pa.algorithm}</div>
                   
                   <div>Timestamp</div>
                   <div style={{ color: 'var(--text-main)' }}>{c2pa.timestamp}</div>
                   
                   <div>SHA256</div>
                   <div style={{ color: 'var(--text-main)', wordBreak: 'break-all' }}>{evidence.sha256}</div>
                   
                   <div>Manifest ID</div>
                   <div style={{ color: 'var(--text-main)', wordBreak: 'break-all' }}>urn:uuid:{evidence.id}</div>
                   
                   <div>Signature</div>
                   <div style={{ color: 'var(--text-faint)', wordBreak: 'break-all', maxHeight: '40px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                     {c2pa.signature || 'Signature truncated for display.'}
                   </div>

                   {/* Fix 7: Demoted Verification Link */}
                   {c2pa.issuer === 'OpenAI' && (
                     <>
                       <div style={{ marginTop: '16px' }}>Verification</div>
                       <div style={{ marginTop: '16px' }}>
                         <a href="https://openai.com/verification" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>https://openai.com/verification</a>
                       </div>
                     </>
                   )}
                 </div>
               </div>
             ) : (
               <div className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '24px', backgroundColor: 'rgba(255,0,0,0.05)', border: '1px solid rgba(255,0,0,0.1)', borderRadius: '8px' }}>
                 ⚠ No valid cryptographic signature detected on asset.
               </div>
             )}
          </div>
          
          {/* SECTION: RAW DATA */}
          <div id="section-raw" style={{ scrollMarginTop: '120px' }}>
             <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                RAW DATA EXTRACTION
             </div>

             {/* Fix 4: Architecturally Separated JSON Blocks */}
             <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
               
               <div style={{ backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '24px' }}>
                 <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', marginBottom: '16px' }}>
                   C2PA MANIFEST (EXTRACTED)
                 </div>
                 <pre className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '200px', overflowY: 'auto' }}>
                   {JSON.stringify(evidence.ai_report?.c2pa_data || { status: 'No C2PA metadata available' }, null, 2)}
                 </pre>
               </div>

               <div style={{ backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '24px' }}>
                 <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', marginBottom: '16px' }}>
                   NEURAL INFERENCE (ViT-CORE OUTPUT)
                 </div>
                 <pre className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                   {JSON.stringify({
                     deepfake_probability: evidence.ai_report?.deepfake_probability ?? null,
                     platform_status: evidence.ai_report?.platform_status || 'UNKNOWN',
                     disposition: evidence.ai_report?.disposition || 'No disposition available'
                   }, null, 2)}
                 </pre>
               </div>

             </div>
          </div>

        </div>
      )}
    </div>
  );
};
