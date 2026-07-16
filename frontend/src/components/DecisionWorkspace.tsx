import { useMemo, useState } from 'react';
import { Share2, Disc, Edit2, Lock, ShieldCheck, Circle, Check, Copy, Link as LinkIcon, AlertTriangle } from 'lucide-react';
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
  .animate-slide-in { animation: slideInRight 0.4s ease-out forwards; }
  .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
  
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  
  .json-key { color: #94a3b8; }
  .json-string { color: #a3e635; }
  .json-number { color: #38bdf8; }
  .json-boolean { color: #f472b6; }
`;

// Helper: Syntax highlight JSON
const syntaxHighlight = (json: any) => {
  if (!json) return '';
  const str = JSON.stringify(json, null, 2);
  return str.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) { cls = 'json-key'; } 
      else { cls = 'json-string'; }
    } else if (/true|false/.test(match)) { cls = 'json-boolean'; }
    return `<span class="${cls}">${match}</span>`;
  });
};

const getNodeStyle = (action: string) => {
  const act = action.toLowerCase();
  if (act.includes('origin') || act.includes('created')) return { color: '#eab308', Icon: Disc, label: '📷 Created' }; 
  if (act.includes('convert') || act.includes('edit') || act.includes('unbound')) return { color: '#8b5cf6', Icon: Edit2, label: '✏️ Edited' }; 
  if (act.includes('sign')) return { color: '#38bdf8', Icon: Lock, label: '🔐 Signed' }; 
  if (act.includes('verif')) return { color: '#22c55e', Icon: ShieldCheck, label: '✓ Verified' }; 
  return { color: '#94a3b8', Icon: Circle, label: 'Event' }; 
};

const formatTimeNodes = (ts: string | undefined | null) => {
  if (!ts || ts === 'Unknown' || ts === '--') return <div style={{ color: 'var(--text-faint)' }}>--</div>;
  let d = ts === 'Present' ? new Date() : new Date(ts);
  if (isNaN(d.getTime())) return <div style={{ color: 'var(--text-faint)' }}>{ts}</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: 'var(--text-faint)' }}>
      <span>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  );
};

export const DecisionWorkspace: React.FC<{ evidence: Evidence, caseEvidence: Evidence[], onClose: () => void }> = ({ evidence, caseEvidence, onClose }) => {
  const assessment = useMemo(() => AssessmentEngine.evaluate(evidence), [evidence]);
  const isEval = evidence.status !== 'COMPLETED' || !evidence.ai_report;
  const c2pa = evidence.ai_report?.c2pa_data;
  const vitProb = evidence.ai_report?.deepfake_probability;
  const platformStatus = evidence.ai_report?.platform_status;
  
  const isVitBypassed = vitProb === null;
  const isC2paBypassed = c2pa?.raw_status === "Bypassed by User";
  
  const history = c2pa?.manifest_history?.length 
    ? c2pa.manifest_history 
    : [{ action: 'Origin', agent: 'Unknown Sensor/Software', timestamp: evidence.created_at || 'Unknown', description: 'Initial file creation' }];

  const [activeTab, setActiveTab] = useState<'SOURCE' | 'HEATMAP' | 'OVERLAY' | 'PATCHES' | 'ATTENTION'>('SOURCE');
  const [imageFailed, setImageFailed] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState<'C2PA' | 'VIT' | null>(null);
  const [copiedInline, setCopiedInline] = useState<'HASH' | 'MANIFEST' | null>(null);

  const getImageUrl = (tab: string) => {
    const cacheBuster = `?t=${new Date().getTime()}`;
    if (tab === 'HEATMAP') return `${API_BASE_URL}/api/v1/evidence/${evidence.id}/heatmap${cacheBuster}`;
    return `${API_BASE_URL}/api/v1/evidence/${evidence.id}/download${cacheBuster}`; 
  };

  const handleCopy = (type: 'C2PA' | 'VIT', data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedRaw(type);
    setTimeout(() => setCopiedRaw(null), 2000);
  };

  const handleInlineCopy = (type: 'HASH' | 'MANIFEST', text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedInline(type);
    setTimeout(() => setCopiedInline(null), 2000);
  };

  let recommendationText = 'Asset cleared for operational use.';
  if (assessment.type === 'crit' || platformStatus === 'CRITICAL THREAT') recommendationText = 'Quarantine asset immediately.';
  else if (assessment.type === 'review') recommendationText = 'Refer for manual review — conflicting signals detected.'
  else if (platformStatus === 'UNVERIFIED') recommendationText = 'Unverified asset. ML analysis is clean, but lacks cryptographic provenance. Proceed with caution.';
  else if (assessment.verdict === 'UNKNOWN' || assessment.type === 'neutral') recommendationText = 'Unable to establish trust. Proceed with caution or mandate manual review.';
  else if (isVitBypassed && isC2paBypassed) recommendationText = 'Awaiting manual evaluation (Automated analysis bypassed).';

  const regionsCount = typeof vitProb === 'number' && vitProb > 0.15 ? Math.max(1, Math.ceil(vitProb * 6)) : 0;
  const syntheticText = typeof vitProb === 'number' && vitProb > 0.15 ? `${regionsCount} REGIONS` : '0 REGIONS';

  const sameIssuer = caseEvidence.filter(e => e.id !== evidence.id && e.ai_report?.c2pa_data?.issuer === c2pa?.issuer && c2pa?.issuer && e.ai_report?.c2pa_data?.is_signed);
  const sameDay = caseEvidence.filter(e => e.id !== evidence.id && e.uploaded_at.split('T')[0] === evidence.uploaded_at.split('T')[0]);

  const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="decision-workspace" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: '#050505', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
      <style>{dossierStyles}</style>
      
      <div style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: 'rgba(5, 5, 5, 0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px' }}>
          <div className="mono" style={{ fontSize: '11px', letterSpacing: '0.15em', fontWeight: 500, color: 'var(--text-faint)' }}>VERITAS NEXUS / DOSSIER</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.1em' }} className="mono hover-bright">CLOSE ✕</button>
        </div>
        
        {!isEval && (
          <div className="dossier-nav no-scrollbar mono" style={{ display: 'flex', gap: '32px', padding: '0 48px 16px', overflowX: 'auto', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
            {['INTELLIGENCE', 'PROVENANCE', 'CREDENTIAL', 'CORRELATION', 'RAW DATA'].map(section => (
              <button key={section} onClick={() => scrollToSection(`section-${section.toLowerCase().replace(' ', '-')}`)} className="hover-bright" style={{ background: 'transparent', border: 'none', color: 'inherit', padding: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>{section}</button>
            ))}
          </div>
        )}
      </div>

      {isEval ? (
        <div style={{ padding: '120px 48px', color: 'var(--text-muted)' }}><div className="mono animate-pulse" style={{ letterSpacing: '0.1em', fontSize: '14px' }}>EXECUTING FUSION PROTOCOLS...</div></div>
      ) : (
        <div className="animate-slide-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px', display: 'flex', flexDirection: 'column', gap: '80px', width: '100%' }}>
          
          <div id="section-intelligence" style={{ scrollMarginTop: '120px', display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 1.5fr)', gap: '40px' }}>
            <div>
              <div className="mono" style={{ color: 'var(--text-faint)', fontSize: '12px', letterSpacing: '0.15em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: platformStatus === 'UNVERIFIED' ? 'var(--text-muted)' : `var(--c-${assessment.type})` }}>████</span> FINAL ASSESSMENT
              </div>

              <h1 style={{ fontSize: '72px', fontWeight: 800, letterSpacing: '-0.04em', margin: '0 0 8px 0', lineHeight: 1, color: platformStatus === 'UNVERIFIED' ? 'var(--text-muted)' : `var(--c-${assessment.type})` }}>
                {platformStatus === 'UNVERIFIED' ? 'UNVERIFIED' : assessment.verdict.toUpperCase()}
              </h1>
              
              <div style={{ fontSize: '24px', fontWeight: 500, color: 'var(--text-main)', marginBottom: '48px' }}>
                {assessment.conf === 'N/A' ? 'N/A' : `${assessment.conf}%`} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>System Confidence</span>
              </div>

              <div style={{ padding: '24px', backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', marginBottom: '16px' }}>ANALYST FINDINGS</div>
                <div style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.6, fontWeight: 500 }}>
                  {evidence.ai_report?.disposition || 'Analysis complete. Refer to raw JSON for detailed execution trace.'}
                </div>
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.1)', fontSize: '14px', color: assessment.type === 'review' || assessment.type === 'crit' || assessment.verdict === 'UNKNOWN' ? 'var(--text-main)' : 'var(--text-muted)' }}>
                   <strong>Recommendation:</strong> {recommendationText}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {isVitBypassed ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                  <span className="mono">⚠ NEURAL INFERENCE ENGINE BYPASSED.</span>
                </div>
              ) : (
                <div style={{ width: '100%', backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden' }}>
                  
                  <div className="no-scrollbar" style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {['SOURCE', 'HEATMAP', 'OVERLAY', 'PATCHES', 'ATTENTION'].map((tab) => (
                      <button 
                        key={tab} onClick={() => { setActiveTab(tab as any); setImageFailed(false); }}
                        className="mono hover-bright"
                        style={{ flex: '1 1 auto', minWidth: 'max-content', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent', color: activeTab === tab ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.2s' }}
                      >{tab}</button>
                    ))}
                  </div>

                  <div style={{ width: '100%', aspectRatio: '16 / 9', backgroundColor: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {imageFailed ? (
                      <div className="mono" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.1em' }}>{activeTab} UNAVAILABLE</div>
                    ) : (
                      <img src={getImageUrl(activeTab)} alt={`Forensic ${activeTab}`} className="animate-fade-in" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => setImageFailed(true)} onLoad={() => setImageFailed(false)} />
                    )}
                  </div>
                  
                  <div className="mono" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '16px', fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.05em', background: 'rgba(255,255,255,0.02)', gap: '16px' }}>
                    <div>
                      <div style={{marginBottom: '8px'}}>HEATMAP INTENSITY</div>
                      <div style={{ position: 'relative', height: '4px', width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 40%, #f59e0b 70%, #ef4444 100%)', borderRadius: '2px', opacity: 0.8 }}></div>
                        {typeof vitProb === 'number' && <div style={{ position: 'absolute', left: `${vitProb * 100}%`, top: '-4px', bottom: '-4px', width: '2px', backgroundColor: '#fff', boxShadow: '0 0 4px rgba(255,255,255,0.8)' }}></div>}
                      </div>
                    </div>
                    <div>
                      <div style={{marginBottom: '4px'}}>INFERENCE CONFIDENCE</div>
                      <div style={{color: 'var(--text-main)', fontSize: '13px'}}>{typeof vitProb === 'number' ? ((1 - vitProb) * 100).toFixed(1) : '--'}%</div>
                    </div>
                    <div>
                      <div style={{marginBottom: '4px'}}>SYNTHETIC REGIONS</div>
                      <div style={{color: typeof vitProb === 'number' && vitProb > 0.15 ? 'var(--c-warn)' : 'var(--text-main)', fontSize: '13px'}}>{syntheticText}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div id="section-provenance" style={{ scrollMarginTop: '120px' }}>
            <div style={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '24px' }}>
              <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', fontSize: '11px', letterSpacing: '0.1em', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                <Share2 size={14} /> PROVENANCE GRAPH
              </div>
              
              {isC2paBypassed ? (
                <div style={{ padding: '32px', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px', textAlign: 'center' }}>
                  <span className="mono" style={{ fontSize: '12px' }}>⚠ CRYPTOGRAPHIC VERIFICATION BYPASSED BY USER.</span>
                </div>
              ) : !c2pa?.is_signed ? (
                <div style={{ padding: '32px', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px', textAlign: 'center' }}>
                  <span className="mono" style={{ fontSize: '12px' }}>⚠ NO PROVENANCE GRAPH AVAILABLE (UNSIGNED ASSET).</span>
                </div>
              ) : (
                <div className="no-scrollbar" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '0 48px', marginTop: '24px', marginBottom: '16px', overflowX: 'auto' }}>
                  <div style={{ position: 'absolute', top: '24px', left: '48px', right: '48px', height: '2px', backgroundColor: 'rgba(255,255,255,0.1)', zIndex: 0 }}></div>
                  {history.map((node, i) => {
                    const { color, Icon, label } = getNodeStyle(node.action);
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, minWidth: '120px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#0a0a0c', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                           <Icon size={20} color={color} />
                        </div>
                        <div className="mono" style={{ padding: '4px 10px', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '10px', color: '#fff', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '8px' }}>
                          {label.toUpperCase()}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-main)', textAlign: 'center', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', minHeight: '16px' }}>
                          {node.agent && node.agent !== 'null' ? node.agent : 'Unknown System'}
                        </div>
                        <div className="mono" style={{ fontSize: '10px', textAlign: 'center' }}>
                          {formatTimeNodes(node.timestamp)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '48px' }}>
            <div id="section-credential" style={{ scrollMarginTop: '120px' }}>
              <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>DIGITAL IDENTITY CREDENTIAL</div>
              
              {isC2paBypassed ? (
                <div style={{ padding: '48px', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px', textAlign: 'center' }}>
                  <span className="mono">⚠ CRYPTOGRAPHIC VERIFICATION BYPASSED.</span>
                </div>
              ) : c2pa?.is_signed ? (
                 <div style={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '32px', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                   <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '180px', opacity: 0.02, color: 'white', pointerEvents: 'none', userSelect: 'none' }}>⌘</div>
                   
                   <div style={{ borderBottom: '2px dashed rgba(255,255,255,0.1)', paddingBottom: '24px', marginBottom: '24px', textAlign: 'center' }}>
                     <div className="mono" style={{ color: '#10b981', fontSize: '10px', letterSpacing: '0.2em', fontWeight: 600, marginBottom: '12px' }}>
                       ✓ VERIFIED CLAIM GENERATOR
                     </div>
                     <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{c2pa.issuer}</div>
                   </div>
                   
                   <div className="mono" style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '16px', fontSize: '11px', color: 'var(--text-muted)', alignItems: 'center' }}>
                     <div>Status</div><div style={{ color: '#10b981', fontWeight: 600 }}>VALID MANIFEST</div>
                     <div>Algorithm</div><div style={{ color: 'var(--text-main)' }}>{c2pa.algorithm}</div>
                     <div>Timestamp</div><div style={{ color: 'var(--text-main)' }}>{c2pa.timestamp}</div>
                     
                     <div>Asset Hash</div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <span style={{ color: 'var(--text-main)' }}>{evidence.sha256.substring(0, 32)}...</span>
                       <button onClick={() => handleInlineCopy('HASH', evidence.sha256)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }} className="hover-bright">
                         {copiedInline === 'HASH' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                       </button>
                     </div>

                     <div>Manifest ID</div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <span style={{ color: 'var(--text-main)' }}>urn:uuid:{evidence.id.split('-')[0]}...</span>
                       <button onClick={() => handleInlineCopy('MANIFEST', `urn:uuid:${evidence.id}`)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }} className="hover-bright">
                         {copiedInline === 'MANIFEST' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                       </button>
                     </div>
                     
                     {c2pa.issuer === 'OpenAI' && (
                       <>
                         <div style={{ marginTop: '8px' }}>Verification</div>
                         <div style={{ marginTop: '8px' }}><a href="https://openai.com/verification" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>Official Registry ↗</a></div>
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

            <div id="section-correlation" style={{ scrollMarginTop: '120px' }}>
               <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>EVIDENCE CORRELATION</div>
               
               <div style={{ backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <LinkIcon size={16} color={sameIssuer.length > 0 ? '#3b82f6' : 'var(--text-faint)'} style={{ marginTop: '2px' }} />
                       <div style={{ flex: 1 }}>
                         <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', marginBottom: '4px' }}>SHARED ISSUER</div>
                         {sameIssuer.length > 0 ? (
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{c2pa?.issuer} ({sameIssuer.length} other assets)</span>
                             <button style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '11px', cursor: 'pointer' }} className="hover-bright mono">View assets ↗</button>
                           </div>
                         ) : (
                           <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No localized correlations found.</div>
                         )}
                       </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <LinkIcon size={16} color={sameDay.length > 0 ? '#3b82f6' : 'var(--text-faint)'} style={{ marginTop: '2px' }} />
                       <div style={{ flex: 1 }}>
                         <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', marginBottom: '4px' }}>SHARED CAPTURE DAY</div>
                         {sameDay.length > 0 ? (
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{evidence.uploaded_at.split('T')[0]} ({sameDay.length} other assets)</span>
                             <button style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '11px', cursor: 'pointer' }} className="hover-bright mono">View assets ↗</button>
                           </div>
                         ) : (
                           <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No localized correlations found.</div>
                         )}
                       </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                       <AlertTriangle size={16} color={sameIssuer.length > 0 || sameDay.length > 0 ? '#f59e0b' : '#10b981'} style={{ marginTop: '2px' }} />
                       <div>
                         <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', marginBottom: '4px' }}>CAMPAIGN RISK PATTERN</div>
                         <div style={{ fontSize: '13px', color: sameIssuer.length > 0 || sameDay.length > 0 ? '#f59e0b' : '#10b981' }}>
                           {sameIssuer.length > 0 || sameDay.length > 0 ? 'Elevated (Related evidence chains detected)' : 'Low (Isolated asset)'}
                         </div>
                       </div>
                    </div>

                  </div>
               </div>
            </div>
          </div>
          
          <div id="section-raw" style={{ scrollMarginTop: '120px' }}>
             <div className="mono" style={{ fontSize: '11px', color: 'var(--text-faint)', letterSpacing: '0.15em', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                RAW DATA EXTRACTION
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
               
               <div style={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                 <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: '#111' }}>
                   <span style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em' }}>C2PA_MANIFEST.JSON</span>
                   <button onClick={() => handleCopy('C2PA', evidence.ai_report?.c2pa_data)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }} className="hover-bright">
                     {copiedRaw === 'C2PA' ? <><Check size={12} color="#10b981" /> COPIED</> : <><Copy size={12} /> COPY</>}
                   </button>
                 </div>
                 <div style={{ padding: '16px', overflowY: 'auto', maxHeight: '300px' }}>
                   <pre className="mono" style={{ fontSize: '11px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} dangerouslySetInnerHTML={{ __html: syntaxHighlight(evidence.ai_report?.c2pa_data || { status: 'No C2PA metadata available' }) }} />
                 </div>
               </div>

               <div style={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                 <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: '#111' }}>
                   <span style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em' }}>VIT_INFERENCE.JSON</span>
                   <button onClick={() => handleCopy('VIT', { deepfake_probability: evidence.ai_report?.deepfake_probability ?? null, platform_status: evidence.ai_report?.platform_status || 'UNKNOWN', disposition: evidence.ai_report?.disposition || 'No disposition available' })} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }} className="hover-bright">
                     {copiedRaw === 'VIT' ? <><Check size={12} color="#10b981" /> COPIED</> : <><Copy size={12} /> COPY</>}
                   </button>
                 </div>
                 <div style={{ padding: '16px', overflowY: 'auto', maxHeight: '300px' }}>
                   <pre className="mono" style={{ fontSize: '11px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} dangerouslySetInnerHTML={{ __html: syntaxHighlight({ deepfake_probability: evidence.ai_report?.deepfake_probability ?? null, platform_status: evidence.ai_report?.platform_status || 'UNKNOWN', disposition: evidence.ai_report?.disposition || 'No disposition available' }) }} />
                 </div>
               </div>

             </div>
          </div>

        </div>
      )}
    </div>
  );
};