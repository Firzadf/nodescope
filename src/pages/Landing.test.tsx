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

  it('shows the console-vs-NodeScope flow visual with the real demo pair', () => {
    render(<Landing />);
    expect(screen.getByText(/asks once/i)).toBeInTheDocument();
    expect(screen.getByText(/proves over time/i)).toBeInTheDocument();
    expect(screen.getByText(/report exported/i)).toBeInTheDocument();
    expect(screen.getByText(/Δ \+12 · 76 s/)).toBeInTheDocument();
  });

  it('renders the evidence grid with one cell per observed block', () => {
    render(<Landing />);
    const grid = screen.getByRole('img', { name: /48 consecutive blocks/i });
    expect(grid.children).toHaveLength(48);
  });

  it('labels the roadmap honestly', () => {
    render(<Landing />);
    // Shipped work stays labeled shipped, and the new planned list is labeled
    // planned — the honest-labeling rule, now with planned items present again.
    expect(screen.getByText(/Planned — not shipped yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Scheduled watch mode/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Shipped — live in the app/i).length).toBe(3);
    expect(screen.getByText(/does not claim a mainnet EVM check/i)).toBeInTheDocument();
    // The footer live line no longer claims a check-in status (removed as
    // stale page furniture); it still names the live chain.
    expect(screen.getByText(/Live · Chain 420420777 · Portaldot V3 EVM Testnet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Check-in submitted/i)).not.toBeInTheDocument();
  });

  it('shows a judge quickstart that points at real actions, not claims', () => {
    render(<Landing />);
    expect(screen.getByText(/60 seconds to verify/i)).toBeInTheDocument();
    expect(screen.getByText(/Probe WSS Node/i)).toBeInTheDocument();
    expect(screen.getByText(/drop the same file at \/verify/i)).toBeInTheDocument();
  });

  it('lists Trends & Verdict as a shipped capability, not a promise', () => {
    render(<Landing />);
    expect(screen.getByText('Trends & Verdict')).toBeInTheDocument();
    // The capabilities table renders twice in the DOM: once as a table
    // (desktop) and once as stacked cards (mobile), with CSS choosing which
    // is visible. Both copies carry the same text.
    expect(screen.getAllByText('Trends & verdict').length).toBe(2);
    // Same table/card duplication as above: the proof pill renders twice.
    expect(screen.getAllByText(/rules shown, no score/i).length).toBe(2);
  });
});
