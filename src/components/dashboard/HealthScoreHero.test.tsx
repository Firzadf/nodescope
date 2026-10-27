// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { HealthScoreHero } from './HealthScoreHero';
import type { HealthCheckSnapshot } from '../../types/healthCheck';

afterEach(() => cleanup());

function snap(id: string, t: number, h: string): HealthCheckSnapshot {
  const c = (method: string, v: string) => ({ method, outcome: 'success' as const, success: true, latencyMs: 250, observedValue: v, error: null });
  return {
    schemaVersion: 'nodescope.health-snapshot.v1',
    id,
    timestamp: t,
    exportedAt: new Date(t).toISOString(),
    endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
    endpointProfile: 'portaldot_v3_evm',
    checks: [c('eth_chainId', '0x190f1ca9'), c('eth_blockNumber', h), c('web3_clientVersion', 'x'), c('net_version', '420420777')],
    findings: [],
  };
}

describe('HealthScoreHero', () => {
  it('shows an honest empty state with one action, not a fake number', () => {
    const run = vi.fn();
    render(<HealthScoreHero snapshots={[]} wsProbe={null} onRunHealthCheck={run} />);
    expect(screen.getByText('Not scored')).toBeInTheDocument();
    expect(screen.getByText(/No measurement yet/)).toBeInTheDocument();
    expect(screen.getAllByText('not measured')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Run first health check' }));
    expect(run).toHaveBeenCalled();
  });

  it('shows the score, coverage, per-component points and the formula link', () => {
    render(<HealthScoreHero snapshots={[snap('a', 1_000_000, '0x100'), snap('b', 1_076_000, '0x10c')]} wsProbe={null} />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getAllByText(/Head advanced \+12 blocks in 76 s/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: /Formula/ })).toHaveAttribute('href', '/docs#health-score');
    expect(screen.getByRole('img', { name: /Block height: 2 samples/ })).toBeInTheDocument();
  });
});
