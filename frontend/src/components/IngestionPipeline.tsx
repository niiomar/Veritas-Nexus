import React, { useState, useEffect, useRef } from 'react';
import { Fingerprint, CheckCircle, Hash, Link2, Network, UploadCloud } from 'lucide-react';
import type { Case } from '../types';
import { EvidenceAPI } from '../services/api';

// useVit and useC2pa parameters to the component props
export const IngestionPipeline: React.FC<{ 
  file: File, 
  activeCase: Case, 
  useVit: boolean, 
  useC2pa: boolean, 
  onComplete: () => void, 
  onError: (msg: string) => void 
}> = ({ file, activeCase, useVit, useC2pa, onComplete, onError }) => {
  const [step, setStep] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => { onCompleteRef.current = onComplete; onErrorRef.current = onError; }, [onComplete, onError]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const executePipeline = async () => {
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      const advance = (s: number) => { if (isMounted) setStep(s); };

      try {
        await sleep(500); advance(1);
        await sleep(700); advance(2);
        await sleep(600); advance(3);
        await sleep(700); advance(4);
        
        await sleep(500);
        if (!isMounted) return;
        
        // Passing the boolean toggles down to the API function
        await EvidenceAPI.uploadPayload(file, activeCase.id, activeCase.analyst, useVit, useC2pa);
        
        advance(5);
        await sleep(800);
        if (isMounted) onCompleteRef.current();

      } catch (err: any) {
        if (isMounted && err.name !== 'AbortError') {
          onErrorRef.current(err.message || "Upload Failed: Unable to contact Evidence API.");
        }
      }
    };

    executePipeline();
    return () => { isMounted = false; controller.abort(); };
  }, [activeCase.id, activeCase.analyst, file, useVit, useC2pa]); 

  const steps = [
    { label: "INITIATING INGESTION PAYLOAD", icon: <UploadCloud size={16}/> },
    { label: "EXTRACTING DIGITAL FINGERPRINT", icon: <Fingerprint size={16}/> },
    { label: "CALCULATING SHA-256 HASH", icon: <Hash size={16}/> },
    { label: `BINDING TO LEDGER: ${activeCase.alias}`, icon: <Link2 size={16}/> },
    { label: "ROUTING TO NEURAL & CRYPTO ENGINES", icon: <Network size={16}/> },
    { label: "ASSET SECURED", icon: <CheckCircle size={16}/> }
  ];

  return (
    <div className="pipeline-modal">
      <div className="pipeline-box">
        <div className="mono" style={{ color: 'var(--c-system)', fontSize: '0.75rem', marginBottom: '2rem' }}>VERITAS INGESTION PROTOCOL</div>
        {steps.map((s, i) => (
          <div key={i} className={`step-row ${step === i ? 'active animate-pulse' : ''} ${step > i ? 'done' : ''}`}>
            {s.icon} <span>{s.label}</span>
            {step > i && <span style={{marginLeft: 'auto'}}>[ OK ]</span>}
            {step === i && <span style={{marginLeft: 'auto'}}>...</span>}
          </div>
        ))}
      </div>
    </div>
  );
};
