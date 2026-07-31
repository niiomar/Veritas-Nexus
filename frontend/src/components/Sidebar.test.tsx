import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import type { Case, Evidence } from '../types';

// Smoke test for the evidence ledger: renders a case with a mix of verdicts
// and confirms the sidebar's per-case status counts reflect the server's
// stored assessment for each evidence item. This is the main place the
// AssessmentEngine's output actually reaches the screen.

const makeCase = (overrides: Partial<Case> = {}): Case => ({
  id: 'case-1',
  name: 'Operation Nightfall',
  alias: 'CASE-404',
  analyst: 'Analyst_01',
  priority: 'HIGH',
  created: '2026-07-30',
  count: 0,
  ...overrides,
});

const makeEvidence = (id: string, verdict: string): Evidence => ({
  id,
  case_id: 'case-1',
  filename: `${id}.png`,
  sha256: 'x'.repeat(64),
  status: 'COMPLETED',
  storage_uri: 'local://x',
  uploaded_by: 'Analyst_01',
  uploaded_at: '2026-07-30T00:00:00Z',
  ai_report: {
    deepfake_probability: 0.05,
    c2pa_data: null,
    platform_status: 'VERIFIED',
    disposition: 'Trusted',
    threat_summary: null,
    // @ts-expect-error - assessment isn't in the AIReport type; the server attaches it dynamically
    assessment: {
      verdict,
      conf: '80.0',
      type: 'trust',
      msg: 'Authenticity Established',
      policy: 'Weighted_XAI_v4.7',
      domains: [],
      totalScore: 80,
    },
  },
});

describe('Sidebar evidence ledger stats', () => {
  it('tallies each evidence item under the verdict the server assigned it', () => {
    const cases = [makeCase()];
    const evidenceLibrary = [makeEvidence('ev-1', 'VERIFIED'), makeEvidence('ev-2', 'CRITICAL')];

    render(
      <Sidebar
        cases={cases}
        activeCase={null}
        evidenceLibrary={evidenceLibrary}
        onSelectCase={vi.fn()}
        onCreateClick={vi.fn()}
        onEditClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />
    );

    expect(screen.getByText('CASE-404')).toBeInTheDocument();
    expect(screen.getByText('2 ASSETS')).toBeInTheDocument();
    // One evidence item landed in each bucket - both counts should read "1".
    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('renders nothing case-related when there are no cases yet', () => {
    render(
      <Sidebar
        cases={[]}
        activeCase={null}
        evidenceLibrary={[]}
        onSelectCase={vi.fn()}
        onCreateClick={vi.fn()}
        onEditClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />
    );

    expect(screen.getByText('ACTIVE INVESTIGATIONS')).toBeInTheDocument();
    expect(screen.queryByText('ASSETS', { exact: false })).not.toBeInTheDocument();
  });
});
