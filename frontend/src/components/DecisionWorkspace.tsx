import { useMemo, useState, useEffect, useCallback } from 'react';
import { Share2, Disc, Edit2, Lock, ShieldCheck, Circle, Check, Copy, Link as LinkIcon, AlertTriangle, ChevronDown, ChevronRight, Maximize, ZoomIn, ZoomOut, Info } from 'lucide-react';
import type { Evidence } from '../types';
import { AssessmentEngine } from '../services/assessment';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const dossierStyles = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  
  .json-key { color: #94a3b8; }
  .json-string { color: #a3e635; }
  .json-number { color: #38bdf8; }
  .json-boolean { color: #f472b6; }
`;

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
  const isC2paBroken = c2pa?.status === "BROKEN_SIGNATURE";
  
  let finalColorType = assessment.type;
  if (assessment.type === 'crit' || platformStatus === 'CRITICAL THREAT' || isC2paBroken) {
    finalColorType = 'crit';
  } else if (platformStatus === 'UNVERIFIED' || assessment.type === 'review' || assessment.type === 'neutral' || assessment.verdict === 'UNKNOWN') {
    finalColorType = 'review';
  } else {
    finalColorType = 'trust';
  }

  const history = c2pa?.manifest_history?.length 
    ? c2pa.manifest_history 
    : [{ action: 'Origin', agent: 'Unknown Sensor/Software', timestamp: evidence.created_at || 'Unknown', description: 'Initial file creation' }];

  const [mainTab, setMainTab] = useState<'MEDIA' | 'PROVENANCE' | 'CREDENTIAL' | 'CORRELATION' | 'RAW'>('MEDIA');
  const [imageTab, setImageTab] = useState<'SOURCE' | 'HEATMAP' | 'PATCHES' | 'ATTENTION'>('SOURCE');
  
  const [imageFailed, setImageFailed] = useState(false);
  const [copiedRaw, setCopiedRaw] = useState<'C2PA' | 'VIT' | null>(null);
  const [copiedInline, setCopiedInline] = useState<'HASH' | 'MANIFEST' | null>(null);
  
  const [c2paExpanded, setC2paExpanded] = useState(true);
  const [vitExpanded, setVitExpanded] = useState(true);

  const [zoom, setZoom] = useState(1);
  const [expandedCorrelation, setExpandedCorrelation] = useState<'ISSUER' | 'DAY' | null>(null);

  const [viewSession] = useState(Date.now());
  const [imageTokens, setImageTokens] = useState<Record<string, number>>({});

  useEffect(() => {
    setZoom(1);
  }, [evidence.id, imageTab]);

  const getImageUrl = useCallback((tab: string) => {
    const token = imageTokens[tab] || viewSession;
    const qs = `?v=${token}`;
    if (tab === 'HEATMAP') return `${API_BASE_URL}/api/v1/evidence/${evidence.id}/heatmap${qs}`;
    if (tab === 'PATCHES') return `${API_BASE_URL}/api/v1/evidence/${evidence.id}/patches${qs}`;
    if (tab === 'ATTENTION') return `${API_BASE_URL}/api/v1/evidence/${evidence.id}/attention${qs}`;
    return `${API_BASE_URL}/api/v1/evidence/${evidence.id}/download${qs}`; 
  }, [evidence.id, viewSession, imageTokens]);

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

  const anomalyCount = typeof vitProb === 'number' ? Math.min(Math.floor(vitProb * 6), 5) : 0;
  const anomalyText = anomalyCount > 0 ? `${anomalyCount} SUSPICIOUS AREA${anomalyCount > 1 ? 'S' : ''}` : 'NONE DETECTED';
  const anomalyColor = anomalyCount > 0 ? 'var(--c-crit)' : 'var(--text-main)';

  const sameIssuer = caseEvidence.filter(e => e.id !== evidence.id && e.ai_report?.c2pa_data?.issuer === c2pa?.issuer && c2pa?.issuer && e.ai_report?.c2pa_data?.is_signed);
  const sameDay = caseEvidence.filter(e => e.id !== evidence.id && e.uploaded_at.split('T')[0] === evidence.uploaded_at.split('T')[0]);

  return (
    <div className="decision-workspace" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: '#050505', position: 'relative' }}>
      <style>{dossierStyles}</style>
      
      {/* GLOBAL HEADER */}
      <div style={{ flexShrink: 0, padding: '24px 48px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="mono" style={{ fontSize: '11px', letterSpacing: '0.15em', fontWeight: 500, color: 'var(--text-faint)' }}>VERITAS NEXUS / DOSSIER</div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.1em' }} className="mono hover-bright">CLOSE ✕</button>
      </div>

      {isEval ? (
        <div style={{ padding: '120px 48px', color: 'var(--text-muted)' }}><div className="mono animate-pulse" style={{ letterSpacing: '0.1em', fontSize: '14px' }}>EXECUTING FUSION PROTOCOLS...</div></div>
      ) : (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          
          {/* STABLE INVESTIGATION CONTEXT */}
          <div style={{ flexShrink: 0, padding: '32px 48px', backgroundColor: 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexWrap: 'wrap', gap: '32px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', letterSpacing: '0.1em', color: 'var(--text-faint)', marginBottom: '8px' }}>
                <span style={{ color: `var(--c-${finalColorType})` }}>████</span> EVIDENCE ASSESSMENT
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: `var(--c-${finalColorType})`, letterSpacing: '-0.02em', marginBottom: '16px' }}>
                {platformStatus === 'UNVERIFIED' ? 'UNVERIFIED' : assessment.verdict.toUpperCase()}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-main)', lineHeight: 1.5 }}>
                {evidence.ai_report?.disposition || 'Analysis complete. Refer to raw JSON for detailed execution trace.'}
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '200px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <div style={{ position: 'relative', width: '32px', height: '32px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: assessment.conf !== 'N/A' ? `var(--c-${finalColorType})` : 'rgba(255,255,255,0.1)' }}></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em' }}>SYSTEM CONFIDENCE</span>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>{assessment.conf !== 'N/A' ? `${assessment.conf}%` : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* TAB NAVIGATION */}
          <div className="no-scrollbar mono" style={{ flexShrink: 0, display: 'flex', gap: '32px', padding: '0 48px', borderBottom: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' }}>
            {[
              { id: 'MEDIA', label: 'MEDIA VIEW' },
              { id: 'PROVENANCE', label: 'PROVENANCE GRAPH' },
              { id: 'CREDENTIAL', label: 'IDENTITY CREDENTIAL' },
              { id: 'CORRELATION', label: 'CORRELATIONS' },
              { id: 'RAW', label: 'RAW DATA' }
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setMainTab(tab.id as any)} 
                className="hover-bright" 
                style={{ 
                  background: 'transparent', border: 'none', padding: '16px 0', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '11px', letterSpacing: '0.1em',
                  color: mainTab === tab.id ? 'var(--text-main)' : 'var(--text-muted)',
                  borderBottom: mainTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB CONTENT AREA */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px' }}>
            
            {mainTab === 'MEDIA' && (
              <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '1000px', margin: '0 auto', gap: '24px' }}>
                {isVitBypassed ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <span className="mono">⚠ NEURAL INFERENCE ENGINE BYPASSED.</span>
                  </div>
                ) : (
                  <div style={{ width: '100%', backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden' }}>
                    
                    <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', backgroundColor: '#111', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-main)', paddingRight: '8px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }} className="hover-bright"><ZoomOut size={12} /> OUT</button>
                        <button onClick={() => setZoom(z => Math.min(z + 0.25, 4))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }} className="hover-bright"><ZoomIn size={12} /> IN</button>
                        <button onClick={() => setZoom(1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }} className="hover-bright"><Maximize size={12} /> FIT</button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => setMainTab('RAW')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }} className="hover-bright"><Info size={12} /> METADATA</button>
                      </div>
                    </div>

                    <div className="no-scrollbar" style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      {['SOURCE', 'HEATMAP', 'PATCHES', 'ATTENTION'].map((tab) => (
                        <button 
                          key={tab} 
                          onClick={() => { 
                            setImageTab(tab as any); 
                            if (imageFailed) setImageFailed(false);
                          }}
                          className="mono hover-bright"
                          style={{ flex: '1 0 auto', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: imageTab === tab ? '2px solid #3b82f6' : '2px solid transparent', color: imageTab === tab ? 'var(--text-main)' : 'var(--text-muted)', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.2s' }}
                        >{tab}</button>
                      ))}
                    </div>

                    {/* THE GOLDILOCKS FIX: Responsive height with a strict minimum of 450px */}
                    <div style={{ width: '100%', height: '55vh', minHeight: '450px', backgroundColor: '#000', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {imageFailed ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', zIndex: 10 }}>
                          <div className="mono" style={{ color: 'var(--c-crit)', fontSize: '11px', letterSpacing: '0.15em' }}>⚠ RENDER FAILED</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', maxWidth: '300px' }}>
                            The neural engine timed out or the browser cached a broken connection state.
                          </div>
                          <button 
                            onClick={() => {
                              setImageFailed(false);
                              setImageTokens(prev => ({ ...prev, [imageTab]: Date.now() }));
                            }}
                            className="mono hover-bright"
                            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-main)', padding: '6px 16px', fontSize: '10px', letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '4px' }}
                          >
                            FORCE RETRY
                          </button>
                        </div>
                      ) : (
                        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={getImageUrl(imageTab)} alt={`Forensic ${imageTab}`} className="animate-fade-in" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={() => setImageFailed(true)} onLoad={() => setImageFailed(false)} />
                        </div>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em' }}>
                          DETECTED ANOMALIES
                        </div>
                        <div className="mono" style={{ fontSize: '13px', color: anomalyColor, fontWeight: 600 }}>
                          {anomalyText}
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'none' }}>
                          {anomalyCount > 0 ? 'Review heatmap for localization' : 'No localized threats found'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mainTab === 'PROVENANCE' && (
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '32px' }}>
                  {isC2paBypassed ? (
                    <div style={{ padding: '48px 32px', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px', textAlign: 'center' }}>
                      <span className="mono" style={{ fontSize: '12px' }}>⚠ CRYPTOGRAPHIC VERIFICATION BYPASSED BY USER.</span>
                    </div>
                  ) : isC2paBroken ? (
                    <div style={{ padding: '48px 32px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', textAlign: 'center', backgroundColor: 'rgba(239,68,68,0.05)' }}>
                      <AlertTriangle size={32} style={{ margin: '0 auto 16px', opacity: 0.8 }} />
                      <div className="mono" style={{ fontSize: '14px', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '8px' }}>CRITICAL: TAMPERED PROVENANCE DETECTED</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>The cryptographic signature attached to this asset is invalid. The file has likely been maliciously altered since it was originally signed.</div>
                    </div>
                  ) : !c2pa?.is_signed ? (
                    <div style={{ padding: '48px 32px', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px', textAlign: 'center' }}>
                      <span className="mono" style={{ fontSize: '12px' }}>⚠ NO PROVENANCE GRAPH AVAILABLE (UNSIGNED ASSET).</span>
                    </div>
                  ) : (
                    <div className="no-scrollbar" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '0 48px', overflowX: 'auto' }}>
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
            )}

            {mainTab === 'CREDENTIAL' && (
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {isC2paBypassed ? (
                  <div style={{ padding: '48px 32px', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px', textAlign: 'center' }}>
                    <span className="mono">⚠ CRYPTOGRAPHIC VERIFICATION BYPASSED.</span>
                  </div>
                ) : isC2paBroken ? (
                  <div style={{ padding: '48px 32px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', textAlign: 'center', backgroundColor: 'rgba(239,68,68,0.05)' }}>
                    <AlertTriangle size={32} style={{ margin: '0 auto 16px', opacity: 0.8 }} />
                    <div className="mono" style={{ fontSize: '14px', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '8px' }}>IDENTITY VERIFICATION FAILED</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>Issuer credentials cannot be trusted. The signature hash does not match the asset's current state.</div>
                  </div>
                ) : c2pa?.is_signed ? (
                   <div style={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '32px', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                     <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '180px', opacity: 0.02, color: 'white', pointerEvents: 'none', userSelect: 'none' }}>⌘</div>
                     
                     <div style={{ borderBottom: '2px dashed rgba(255,255,255,0.1)', paddingBottom: '24px', marginBottom: '24px', textAlign: 'center' }}>
                       <div className="mono" style={{ color: '#10b981', fontSize: '10px', letterSpacing: '0.2em', fontWeight: 600, marginBottom: '12px' }}>
                         ✓ VERIFIED CLAIM GENERATOR
                       </div>
                       <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', wordBreak: 'break-word' }}>{c2pa.issuer}</div>
                     </div>
                     
                     <div className="mono" style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '16px', fontSize: '11px', color: 'var(--text-muted)', alignItems: 'center' }}>
                       <div>Status</div><div style={{ color: '#10b981', fontWeight: 600 }}>VALID MANIFEST</div>
                       <div>Algorithm</div><div style={{ color: 'var(--text-main)' }}>{c2pa.algorithm}</div>
                       <div>Timestamp</div><div style={{ color: 'var(--text-main)' }}>{c2pa.timestamp}</div>
                       
                       <div>Asset Hash</div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                         <span style={{ color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evidence.sha256.substring(0, 32)}...</span>
                         <button onClick={() => handleInlineCopy('HASH', evidence.sha256)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', flexShrink: 0 }} className="hover-bright">
                           {copiedInline === 'HASH' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                         </button>
                       </div>

                       <div>Manifest ID</div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                         <span style={{ color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>urn:uuid:{evidence.id.split('-')[0]}...</span>
                         <button onClick={() => handleInlineCopy('MANIFEST', `urn:uuid:${evidence.id}`)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', flexShrink: 0 }} className="hover-bright">
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
                   <div className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '48px 32px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', textAlign: 'center' }}>
                     ⚠ No valid cryptographic signature detected on asset.
                   </div>
                 )}
              </div>
            )}

            {mainTab === 'CORRELATION' && (
              <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <div style={{ backgroundColor: '#050505', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                         <LinkIcon size={16} color={sameIssuer.length > 0 ? '#3b82f6' : 'var(--text-faint)'} style={{ marginTop: '2px', flexShrink: 0 }} />
                         <div style={{ flex: 1, minWidth: 0 }}>
                           <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', marginBottom: '4px' }}>SHARED ISSUER</div>
                           {sameIssuer.length > 0 ? (
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                 <span style={{ fontSize: '13px', color: 'var(--text-main)', wordBreak: 'break-word' }}>{c2pa?.issuer} ({sameIssuer.length} other assets)</span>
                                 <button onClick={() => setExpandedCorrelation(prev => prev === 'ISSUER' ? null : 'ISSUER')} style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '11px', cursor: 'pointer', padding: 0 }} className="hover-bright mono">
                                   {expandedCorrelation === 'ISSUER' ? 'Hide assets ↘' : 'View assets ↗'}
                                 </button>
                               </div>
                               {expandedCorrelation === 'ISSUER' && (
                                 <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                   {sameIssuer.map(e => (
                                     <div key={e.id} className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                       <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '12px' }}>{e.filename}</span>
                                       <span style={{ color: `var(--c-${AssessmentEngine.evaluate(e).type})` }}>{AssessmentEngine.evaluate(e).conf}%</span>
                                     </div>
                                   ))}
                                 </div>
                               )}
                             </div>
                           ) : (
                             <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No localized correlations found.</div>
                           )}
                         </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                         <LinkIcon size={16} color={sameDay.length > 0 ? '#3b82f6' : 'var(--text-faint)'} style={{ marginTop: '2px', flexShrink: 0 }} />
                         <div style={{ flex: 1, minWidth: 0 }}>
                           <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', marginBottom: '4px' }}>SHARED CAPTURE DAY</div>
                           {sameDay.length > 0 ? (
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                 <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{evidence.uploaded_at.split('T')[0]} ({sameDay.length} other assets)</span>
                                 <button onClick={() => setExpandedCorrelation(prev => prev === 'DAY' ? null : 'DAY')} style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontSize: '11px', cursor: 'pointer', padding: 0 }} className="hover-bright mono">
                                   {expandedCorrelation === 'DAY' ? 'Hide assets ↘' : 'View assets ↗'}
                                 </button>
                               </div>
                               {expandedCorrelation === 'DAY' && (
                                 <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                   {sameDay.map(e => (
                                     <div key={e.id} className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                       <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '12px' }}>{e.filename}</span>
                                       <span style={{ color: `var(--c-${AssessmentEngine.evaluate(e).type})` }}>{AssessmentEngine.evaluate(e).conf}%</span>
                                     </div>
                                   ))}
                                 </div>
                               )}
                             </div>
                           ) : (
                             <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No localized correlations found.</div>
                           )}
                         </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                         <AlertTriangle size={16} color={sameIssuer.length > 0 || sameDay.length > 0 ? '#f59e0b' : '#10b981'} style={{ marginTop: '2px', flexShrink: 0 }} />
                         <div style={{ minWidth: 0 }}>
                           <div className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em', marginBottom: '4px' }}>CAMPAIGN RISK PATTERN</div>
                           <div style={{ fontSize: '13px', color: sameIssuer.length > 0 || sameDay.length > 0 ? '#f59e0b' : '#10b981' }}>
                             {sameIssuer.length > 0 || sameDay.length > 0 ? 'Elevated (Related evidence chains detected)' : 'Low (Isolated asset)'}
                           </div>
                         </div>
                      </div>
                    </div>
                </div>
              </div>
            )}

            {mainTab === 'RAW' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: c2paExpanded ? '1px solid rgba(255,255,255,0.05)' : 'none', backgroundColor: '#111' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button onClick={() => setC2paExpanded(!c2paExpanded)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                        {c2paExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <span style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em' }}>C2PA_MANIFEST.JSON</span>
                    </div>
                    <button onClick={() => handleCopy('C2PA', evidence.ai_report?.c2pa_data)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }} className="hover-bright">
                      {copiedRaw === 'C2PA' ? <><Check size={12} color="#10b981" /> COPIED</> : <><Copy size={12} /> COPY</>}
                    </button>
                  </div>
                  {c2paExpanded && (
                    <div style={{ padding: '16px', overflowY: 'auto', maxHeight: '400px' }}>
                      <pre className="mono" style={{ fontSize: '11px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} dangerouslySetInnerHTML={{ __html: syntaxHighlight(evidence.ai_report?.c2pa_data || { status: 'No C2PA metadata available' }) }} />
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: '#0a0a0c', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: vitExpanded ? '1px solid rgba(255,255,255,0.05)' : 'none', backgroundColor: '#111' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button onClick={() => setVitExpanded(!vitExpanded)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                        {vitExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <span style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '0.1em' }}>VIT_INFERENCE.JSON</span>
                    </div>
                    <button onClick={() => handleCopy('VIT', { deepfake_probability: evidence.ai_report?.deepfake_probability ?? null, platform_status: evidence.ai_report?.platform_status || 'UNKNOWN', disposition: evidence.ai_report?.disposition || 'No disposition available' })} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }} className="hover-bright">
                      {copiedRaw === 'VIT' ? <><Check size={12} color="#10b981" /> COPIED</> : <><Copy size={12} /> COPY</>}
                    </button>
                  </div>
                  {vitExpanded && (
                    <div style={{ padding: '16px', overflowY: 'auto', maxHeight: '400px' }}>
                      <pre className="mono" style={{ fontSize: '11px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} dangerouslySetInnerHTML={{ __html: syntaxHighlight({ deepfake_probability: evidence.ai_report?.deepfake_probability ?? null, platform_status: evidence.ai_report?.platform_status || 'UNKNOWN', disposition: evidence.ai_report?.disposition || 'No disposition available' }) }} />
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
