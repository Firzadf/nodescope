// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StatusPage } from './StatusPage';

const body = {
  verdict: 'stalled',
  score: 81,
  coverage: 90,
  formula: 'nodescope.health-score.v2',
  checkedAt: '2026-10-28T20:43:00.000Z',
  bestHeight: '232115',
  finalizedHeight: '232113',
  finalityLag: 2,
  peers: 0,
  latencyMs: 180,
  chain: 'PortaldotV3 Test',
  explanation: 'Chain paused but RPC answers.',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('StatusPage', () => {
  it('shows the check it was given and does not poll', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
    vi.stubGlobal('fetch', fetchMock);
    render(<StatusPage />);
    expect(await screen.findByText('STALLED')).toBeTruthy();
    expect(screen.getByText('81/100')).toBeTruthy();
    expect(screen.getByText('232115')).toBeTruthy();
    expect(screen.getByText('232113')).toBeTruthy();
    expect(screen.getAllByText(/2 blocks/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Wait for the Portaldot team/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/community status/i).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await screen.findByText('STALLED');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('fresh=1');
    expect(screen.getByText(/api\/badge\?target=portaldot-v3-testnet/)).toBeTruthy();
  });
});
