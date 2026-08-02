import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlobalCommandBar } from './GlobalCommandBar';

describe('GlobalCommandBar', () => {
  it('shows only the platform title when no user is logged in', () => {
    render(<GlobalCommandBar />);

    expect(screen.getByText('VERITAS NEXUS')).toBeInTheDocument();
    expect(screen.queryByText(/LOG OUT/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/RECENTLY DELETED/i)).not.toBeInTheDocument();
  });

  it('shows the user email and logout control once logged in', () => {
    render(<GlobalCommandBar userEmail="analyst@example.com" onLogout={vi.fn()} />);

    expect(screen.getByText('ANALYST@EXAMPLE.COM')).toBeInTheDocument();
    expect(screen.getByText(/LOG OUT/i)).toBeInTheDocument();
  });

  it('calls onLogout when the logout control is clicked', () => {
    const onLogout = vi.fn();
    render(<GlobalCommandBar userEmail="analyst@example.com" onLogout={onLogout} />);

    fireEvent.click(screen.getByText(/LOG OUT/i));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('only shows Recently Deleted when the callback is provided', () => {
    const { rerender } = render(<GlobalCommandBar userEmail="analyst@example.com" onLogout={vi.fn()} />);
    expect(screen.queryByText(/RECENTLY DELETED/i)).not.toBeInTheDocument();

    rerender(<GlobalCommandBar userEmail="analyst@example.com" onLogout={vi.fn()} onOpenRecentlyDeleted={vi.fn()} />);
    expect(screen.getByText(/RECENTLY DELETED/i)).toBeInTheDocument();
  });

  it('calls onOpenRecentlyDeleted when clicked', () => {
    const onOpenRecentlyDeleted = vi.fn();
    render(<GlobalCommandBar userEmail="analyst@example.com" onLogout={vi.fn()} onOpenRecentlyDeleted={onOpenRecentlyDeleted} />);

    fireEvent.click(screen.getByText(/RECENTLY DELETED/i));
    expect(onOpenRecentlyDeleted).toHaveBeenCalledTimes(1);
  });
});
