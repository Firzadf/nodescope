// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Overview } from './Overview';
import type { NodeMetricsDetailed } from '../../types/node';
import {
  HEALTH_SNAPSHOT_SCHEMA_VERSION,
  type HealthCheckSnapshot,
} from '../../types/healthCheck';
import type { SubstrateWsProbeResult } from '../../services/substrateWsProbe';

afterEach(() => cleanup());

const EMPTY_METRICS: NodeMetricsDetailed = {
  latency: { status: 'not_tested', value: null },
  clientVersion: { status: 'not_tested', value: null },
  peerCount: { status: 'not_tested', value: null },
  blockHeight: { status: 'not_tested', value: null },
};

function snapshot(id: string, timestamp: number, blockHex: string): HealthCheckSnapshot {
  return {
    schemaVersion: HEALTH_SNAPSHOT_SCHEMA_VERSION,
    id,
    timestamp,
    exportedAt: new Date(timestamp).toISOString(),
    endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
    endpointProfile: 'portaldot_v3_evm',
    checks: [
      { method: 'eth_chainId', outcome: 'success', success: true, latencyMs: 10, observedValue: '0x190f1ca9', error: null },
      { method: 'eth_blockNumber', outcome: 'success', success: true, latencyMs: 12, observedValue: blockHex, error: null },
      { method: 'web3_clientVersion', outcome: 'success', success: true, latencyMs: 9, observedValue: 'Portaldot/v0.1.0', error: null },
      { method: 'net_version', outcome: 'success', success: true, latencyMs: 8, observedValue: '420420777', error: null },
    ],
    findings: [],
  };
}

const PROBE: SubstrateWsProbeResult = {
  url: 'wss://test-node-v3.portaldot.dev',
  status: 'ok',
  handshakeMs: 100,
  totalMs: 200,
  chain: 'Portaldot Testnet',
  version: '0.1.0',
  peers: 1,
  isSyncing: false,
  shouldHavePeers: true,
  headerNumberHex: '0x2ef00',
  headerNumberDecimal: '192256',
  error: null,
};

function renderOverview(overrides: {
  healthSnapshots?: HealthCheckSnapshot[];
  latestHealthSnapshot?: HealthCheckSnapshot | null;
  wsProbeResult?: SubstrateWsProbeResult | null;
}) {
  render(
    <Overview
      endpoint="https://test-evm-rpc-v3.portaldot.dev"
      connectionStatus="connected"
      metricsDetailed={EMPTY_METRICS}
      onUpdateMetricsDetailed={() => {}}
      onExecuteRpc={async () => null}
      endpointProfile="portaldot_v3_evm"
      capabilitySnapshot={null}
      history={[]}
      onCapabilitySnapshotChange={() => {}}
      healthSnapshots={overrides.healthSnapshots ?? []}
      latestHealthSnapshot={overrides.latestHealthSnapshot ?? null}
      onRunHealthCheck={async () => {}}
      isHealthChecking={false}
      wsProbeResult={overrides.wsProbeResult ?? null}
      onWsProbeResultChange={() => {}}
      probeRestoredAt={null}
      capabilityRestoredAt={null}
    />,
  );
}

describe('Overview empty panels collapse to one row', () => {
  it('shows collapsed rows naming exactly what is missing when there is no data', () => {
    renderOverview({});
    expect(screen.getByText(/Needs 2 health checks to compare/)).toBeInTheDocument();
    expect(screen.getByText(/Needs 1 health check to show trends/)).toBeInTheDocument();
    expect(screen.getByText(/Needs a health snapshot and a Substrate probe result/)).toBeInTheDocument();
    expect(screen.getAllByText('Run health check').length).toBe(3);
  });

  it('renders the full panels once their data exists', () => {
    const s1 = snapshot('s1', 1000, '0x2ef00');
    const s2 = snapshot('s2', 2000, '0x2ef01');
    renderOverview({ healthSnapshots: [s1, s2], latestHealthSnapshot: s2, wsProbeResult: PROBE });
    expect(screen.queryByText(/Needs 2 health checks to compare/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Needs 1 health check to show trends/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Needs a health snapshot and a Substrate probe result/)).not.toBeInTheDocument();
  });
});
