// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SessionTrendsPanel } from './SessionTrendsPanel';
import {
  HEALTH_SNAPSHOT_SCHEMA_VERSION,
  type HealthCheckCheck,
  type HealthCheckSnapshot,
} from '../../types/healthCheck';

const T0 = 1700000000000;
const ORIGIN = 'https://rpc.example.test';

function createCheck(overrides: Partial<HealthCheckCheck> = {}): HealthCheckCheck {
  return {
    method: 'eth_chainId',
    outcome: 'success',
    success: true,
    latencyMs: 40,
    observedValue: '0x190f1ca9',
    error: null,
    ...overrides,
  };
}

function healthyChecks(blockHex: string): HealthCheckCheck[] {
  return [
    createCheck({ method: 'eth_chainId', observedValue: '0x190f1ca9' }),
    createCheck({ method: 'eth_blockNumber', observedValue: blockHex }),
    createCheck({ method: 'web3_clientVersion', observedValue: 'eth-rpc/test' }),
    createCheck({ method: 'net_version', observedValue: '420420777' }),
  ];
}

function createSnapshot(overrides: Partial<HealthCheckSnapshot> = {}): HealthCheckSnapshot {
  return {
    schemaVersion: HEALTH_SNAPSHOT_SCHEMA_VERSION,
    id: 'snap-1',
    timestamp: T0,
    exportedAt: '2026-10-21T00:00:00.000Z',
    endpointOrigin: ORIGIN,
    endpointProfile: 'portaldot_v3_evm',
    checks: healthyChecks('0x100'),
    findings: [],
    ...overrides,
  };
}

describe('SessionTrendsPanel UI', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows an honest empty state with no snapshots — no verdict is invented', () => {
    render(<SessionTrendsPanel snapshots={[]} />);
    expect(screen.getByText(/Insufficient data/i)).toBeInTheDocument();
    expect(screen.getByText(/No health checks recorded in this session yet/i)).toBeInTheDocument();
    expect(screen.queryByText('HEALTHY')).not.toBeInTheDocument();
  });

  it('shows the 1-snapshot honesty state — trends need at least 2 checks', () => {
    render(<SessionTrendsPanel snapshots={[createSnapshot()]} />);
    expect(screen.getByText(/at least 2 health checks/i)).toBeInTheDocument();
    expect(screen.queryByText('HEALTHY')).not.toBeInTheDocument();
    expect(screen.queryByText(/Latency Trends by Method/i)).not.toBeInTheDocument();
  });

  it('renders the verdict with every rule printed and its evidence', () => {
    render(
      <SessionTrendsPanel
        snapshots={[
          createSnapshot({ id: 's1', timestamp: T0, checks: healthyChecks('0x100') }),
          createSnapshot({ id: 's2', timestamp: T0 + 76_000, checks: healthyChecks('0x10c') }),
          createSnapshot({ id: 's3', timestamp: T0 + 152_000, checks: healthyChecks('0x118') }),
        ]}
      />
    );

    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
    expect(screen.getByText(/Session Trends & Verdict/i)).toBeInTheDocument();
    // Every rule is printed, fired or not.
    expect(screen.getByText('verdict.no-real-failures')).toBeInTheDocument();
    expect(screen.getByText('verdict.no-block-stall')).toBeInTheDocument();
    expect(screen.getByText('verdict.no-block-regression')).toBeInTheDocument();
    expect(screen.getByText('verdict.no-latency-drift')).toBeInTheDocument();
    expect(screen.getByText(/0 real failures across 12 checks/i)).toBeInTheDocument();
    expect(screen.getAllByText('CLEAR').length).toBe(3);
    expect(screen.getByText('NOT EVALUATED')).toBeInTheDocument();
    // Latency table + block progression with the real numbers.
    expect(screen.getByText(/Latency Trends by Method/i)).toBeInTheDocument();
    expect(screen.getByText('+24 blocks')).toBeInTheDocument();
    expect(screen.getByText(/estimated from the wall-clock gap/i)).toBeInTheDocument();
  });

  it('renders a stall finding and a DEGRADED verdict when the chain did not advance', () => {
    render(
      <SessionTrendsPanel
        snapshots={[
          createSnapshot({ id: 's1', timestamp: T0, checks: healthyChecks('0x100') }),
          createSnapshot({ id: 's2', timestamp: T0 + 76_000, checks: healthyChecks('0x100') }),
        ]}
      />
    );

    expect(screen.getByText('DEGRADED')).toBeInTheDocument();
    expect(screen.getByText(/Stall finding/i)).toBeInTheDocument();
    expect(screen.getByText(/Block height unchanged at 256 across a 76 s gap/i)).toBeInTheDocument();
    expect(screen.getByText('FIRED')).toBeInTheDocument();
  });

  it('notes excluded snapshots from other endpoints instead of mixing them in', () => {
    render(
      <SessionTrendsPanel
        snapshots={[
          createSnapshot({ id: 'a1', timestamp: T0 }),
          createSnapshot({
            id: 'b1',
            timestamp: T0 + 60_000,
            endpointOrigin: 'https://other.example.test',
            checks: healthyChecks('0x200'),
          }),
          createSnapshot({
            id: 'b2',
            timestamp: T0 + 120_000,
            endpointOrigin: 'https://other.example.test',
            checks: healthyChecks('0x210'),
          }),
        ]}
      />
    );

    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
    expect(screen.getByText(/excluded, never mixed into a trend line/i)).toBeInTheDocument();
  });
});
