import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecentlyDeletedModal } from './RecentlyDeletedModal';
import { EvidenceAPI } from '../services/api';

vi.mock('../services/api', () => ({
  EvidenceAPI: {
    fetchDeletedCases: vi.fn(),
    fetchDeletedEvidence: vi.fn(),
    restoreCase: vi.fn(),
    restoreEvidence: vi.fn(),
  },
}));

const CURRENT_USER = 'me@example.com';
const OTHER_USER = 'someone-else@example.com';

const purgeAtIn = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();

describe('RecentlyDeletedModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an empty state when nothing is deleted', async () => {
    vi.mocked(EvidenceAPI.fetchDeletedCases).mockResolvedValue([]);
    vi.mocked(EvidenceAPI.fetchDeletedEvidence).mockResolvedValue([]);

    render(<RecentlyDeletedModal currentUserEmail={CURRENT_USER} onClose={vi.fn()} onRestored={vi.fn()} />);

    expect(await screen.findByText(/Nothing here/i)).toBeInTheDocument();
  });

  it('lets the owner restore their own deleted case, and calls onRestored', async () => {
    vi.mocked(EvidenceAPI.fetchDeletedCases).mockResolvedValue([
      { id: 'case-1', name: 'My Case', created_by: CURRENT_USER, purge_at: purgeAtIn(20) },
    ]);
    vi.mocked(EvidenceAPI.fetchDeletedEvidence).mockResolvedValue([]);
    vi.mocked(EvidenceAPI.restoreCase).mockResolvedValue(true);
    const onRestored = vi.fn();

    render(<RecentlyDeletedModal currentUserEmail={CURRENT_USER} onClose={vi.fn()} onRestored={onRestored} />);

    expect(await screen.findByText('My Case')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/RESTORE/i));

    await waitFor(() => expect(EvidenceAPI.restoreCase).toHaveBeenCalledWith('case-1'));
    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
    // Restored items disappear from the list immediately rather than waiting for a refetch.
    await waitFor(() => expect(screen.queryByText('My Case')).not.toBeInTheDocument());
  });

  it("does not offer a restore button for another analyst's deleted case", async () => {
    vi.mocked(EvidenceAPI.fetchDeletedCases).mockResolvedValue([
      { id: 'case-2', name: "Someone Else's Case", created_by: OTHER_USER, purge_at: purgeAtIn(20) },
    ]);
    vi.mocked(EvidenceAPI.fetchDeletedEvidence).mockResolvedValue([]);

    render(<RecentlyDeletedModal currentUserEmail={CURRENT_USER} onClose={vi.fn()} onRestored={vi.fn()} />);

    expect(await screen.findByText("Someone Else's Case")).toBeInTheDocument();
    expect(screen.queryByText(/^RESTORE$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/NOT YOURS/i)).toBeInTheDocument();
  });

  it('lets the uploader restore their own deleted evidence', async () => {
    vi.mocked(EvidenceAPI.fetchDeletedCases).mockResolvedValue([]);
    vi.mocked(EvidenceAPI.fetchDeletedEvidence).mockResolvedValue([
      { id: 'ev-1', filename: 'abc123_photo.png', uploaded_by: CURRENT_USER, purge_at: purgeAtIn(5) },
    ]);
    vi.mocked(EvidenceAPI.restoreEvidence).mockResolvedValue(true);

    render(<RecentlyDeletedModal currentUserEmail={CURRENT_USER} onClose={vi.fn()} onRestored={vi.fn()} />);

    // The stored filename is prefixed with the evidence UUID - the modal should strip it for display.
    expect(await screen.findByText('photo.png')).toBeInTheDocument();
    fireEvent.click(screen.getByText(/RESTORE/i));

    await waitFor(() => expect(EvidenceAPI.restoreEvidence).toHaveBeenCalledWith('ev-1'));
  });

  it('shows an error if loading fails, without crashing', async () => {
    vi.mocked(EvidenceAPI.fetchDeletedCases).mockRejectedValue(new Error('network down'));
    vi.mocked(EvidenceAPI.fetchDeletedEvidence).mockResolvedValue([]);

    render(<RecentlyDeletedModal currentUserEmail={CURRENT_USER} onClose={vi.fn()} onRestored={vi.fn()} />);

    expect(await screen.findByText('network down')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    vi.mocked(EvidenceAPI.fetchDeletedCases).mockResolvedValue([]);
    vi.mocked(EvidenceAPI.fetchDeletedEvidence).mockResolvedValue([]);
    const onClose = vi.fn();

    render(<RecentlyDeletedModal currentUserEmail={CURRENT_USER} onClose={onClose} onRestored={vi.fn()} />);
    await screen.findByText(/Nothing here/i);

    fireEvent.click(screen.getByText(/^CLOSE$/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
