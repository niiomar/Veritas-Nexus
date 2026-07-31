import { describe, it, expect } from 'vitest';
import { AssessmentEngine } from './assessment';
import type { Evidence } from '../types';

// The scoring logic itself now lives server-side (api/services/assessment_engine.py)
// and is covered there. What's left here is worth testing on its own: this module
// must never silently recompute or guess a verdict client-side again - it should
// only ever render exactly what the server already decided, or a clearly-labeled
// placeholder while waiting for / missing that data.

const baseEvidence = (overrides: Partial<Evidence> = {}): Evidence => ({
  id: 'ev-1',
  case_id: 'case-1',
  filename: 'test.png',
  sha256: 'abc123',
  status: 'PENDING',
  storage_uri: 'local://x',
  uploaded_by: 'Analyst_01',
  uploaded_at: '2026-07-30T00:00:00Z',
  ai_report: null,
  ...overrides,
});

describe('AssessmentEngine.evaluate', () => {
  it('shows the evaluating placeholder when there is no ai_report yet', () => {
    const result = AssessmentEngine.evaluate(baseEvidence({ ai_report: null }));
    expect(result.verdict).toBe('EVALUATING');
    expect(result.domains).toEqual([]);
  });

  it('renders exactly what the server computed, without altering it', () => {
    const storedAssessment = {
      verdict: 'CRITICAL',
      conf: '12.0',
      type: 'crit' as const,
      msg: 'Likely Manipulated',
      policy: 'Weighted_XAI_v4.7',
      domains: [{ name: 'Cryptographic Provenance', score: 0, max: 30, weight: 30, evidence: [] }],
      totalScore: 12,
    };
    const evidence = baseEvidence({
      status: 'COMPLETED',
      ai_report: {
        deepfake_probability: 0.95,
        c2pa_data: null,
        platform_status: 'CRITICAL THREAT',
        disposition: 'Quarantine',
        threat_summary: null,
        // @ts-expect-error - assessment isn't in the AIReport type; the server attaches it dynamically
        assessment: storedAssessment,
      },
    });

    const result = AssessmentEngine.evaluate(evidence);
    expect(result).toEqual(storedAssessment);
  });

  it('falls back to a clearly-labeled state for pre-migration evidence with no stored assessment', () => {
    const evidence = baseEvidence({
      status: 'COMPLETED',
      ai_report: {
        deepfake_probability: 0.05,
        c2pa_data: null,
        platform_status: 'VERIFIED',
        disposition: 'Trusted',
        threat_summary: null,
        // no `assessment` field, simulating a row analyzed before the server-side port
      },
    });

    const result = AssessmentEngine.evaluate(evidence);
    expect(result.domains).toEqual([]);
    expect(result.msg).toMatch(/re-run analysis/i);
    // Must not silently fabricate a trust verdict from partial data.
    expect(result.verdict).not.toBe('VERIFIED');
  });
});
