// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { WatchAlertsPanel, type WatchCycleResult } from './WatchAlertsPanel';

const DISCORD = 'https://discord.com/api/webhooks/123/SECRETTOKEN';

const base: WatchCycleResult = {
  verdict: 'healthy',
  endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
  blockHeight: '216346',
  score: 100,
  coverage: 100,
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('WatchAlertsPanel', () => {
  it('rejects a non-webhook URL and saves a Discord one masked', () => {
    render(<WatchAlertsPanel runCycle={vi.fn()} current={base} />);
    const input = screen.getByLabelText(/Discord or Slack webhook/i);
    fireEvent.change(input, { target: { value: 'https://example.com/x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Discord/);
    fireEvent.change(input, { target: { value: DISCORD } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(localStorage.getItem('nodescope-alert-webhook')).toBe(DISCORD);
    expect(screen.queryByText(/SECRETTOKEN/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Send test' })).toBeInTheDocument();
  });

  it('sends a test message with the current state', async () => {
    localStorage.setItem('nodescope-alert-webhook', DISCORD);
    const f = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', f);
    render(<WatchAlertsPanel runCycle={vi.fn()} current={base} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }));
    await waitFor(() => expect(screen.getByText(/test · webhook delivered/)).toBeInTheDocument());
    expect(JSON.parse(f.mock.calls[0][1].body).content).toContain('test alert');
  });

  it('posts once on degrade and once on recover while watching, never on steady state', async () => {
    localStorage.setItem('nodescope-alert-webhook', DISCORD);
    const f = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', f);
    const sequence: WatchCycleResult['verdict'][] = ['healthy', 'healthy', 'degraded', 'degraded', 'healthy'];
    let i = 0;
    const runCycle = vi.fn(async () => ({ ...base, verdict: sequence[Math.min(i++, sequence.length - 1)] }));
    render(<WatchAlertsPanel runCycle={runCycle} current={base} tickMsOverride={5} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start watch' }));
    await waitFor(() => expect(runCycle.mock.calls.length).toBeGreaterThanOrEqual(6), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Stop watch' }));
    const bodies = f.mock.calls.map((c) => JSON.parse(c[1].body).content as string);
    expect(bodies.filter((b) => b.includes('DEGRADED'))).toHaveLength(1);
    expect(bodies.filter((b) => b.includes('RECOVERED'))).toHaveLength(1);
    expect(bodies).toHaveLength(2);
  });

  it('watches without a webhook and logs the cycle', async () => {
    const runCycle = vi.fn(async () => base);
    render(<WatchAlertsPanel runCycle={runCycle} current={base} tickMsOverride={10000} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start watch' }));
    await waitFor(() => expect(screen.getByText(/healthy · block 216346 · score 100/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Stop watch' }));
    expect(runCycle).toHaveBeenCalledTimes(1);
  });
});
