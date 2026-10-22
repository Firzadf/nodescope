// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Landing } from './Landing';

// The hero readout fetches the live endpoint once on load; keep tests offline
// and deterministic by making every fetch fail (the readout's honest
// "unreachable" state is part of the design).
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline in tests')));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Landing', () => {
  it('renders the hero claim and Launch App CTAs pointing at /app', () => {
    render(<Landing />);
    expect(screen.getByText(/Consoles interact\./i)).toBeInTheDocument();
    expect(screen.getAllByText(/proves\./i).length).toBeGreaterThanOrEqual(1);
    const ctas = screen.getAllByRole('link', { name: /Launch App/i });
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    ctas.forEach((cta) => expect(cta).toHaveAttribute('href', '/app'));
  });

  it('shows the live readout falling back honestly when the endpoint is unreachable', async () => {
    render(<Landing />);
    expect(await screen.findByText(/did not answer/i)).toBeInTheDocument();
    expect(screen.getByText(/Last documented observation/i)).toBeInTheDocument();
  });

  it('shows flat, sourced stats instead of count-ups', () => {
    render(<Landing />);
    expect(screen.getByText(/Tests passing/i)).toBeInTheDocument();
    expect(screen.getByText(/RPC methods probed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/76 seconds apart/i).length).toBeGreaterThanOrEqual(2);
  });

  it('shows the recorded health-check transcript and the real snapshot diff', () => {
    render(<Landing />);
    expect(screen.getByText('eth_chainId')).toBeInTheDocument();
    expect(screen.getAllByText(/143,776/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/0 new · 0 resolved · 0 regressions/i)).toBeInTheDocument();
  });

  it('labels the roadmap honestly', () => {
    render(<Landing />);
    expect(screen.getAllByText(/Planned — not shipped/i).length).toBe(3);
    expect(screen.getByText(/Check-in submitted/i)).toBeInTheDocument();
  });
});
