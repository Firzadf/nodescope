// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FullDiagnosticRunner } from './FullDiagnosticRunner';
import {
  HEALTH_SNAPSHOT_SCHEMA_VERSION,
  type HealthCheckSnapshot,
} from '../../types/healthCheck';
import type { CapabilitySnapshot } from '../../types/capability';
import type { SubstrateWsProbeResult } from '../../services/substrateWsProbe';

vi.mock('../../services/capabilityDiscovery', () => ({
  discoverCapabilities: vi.fn().mockResolvedValue({
    endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
    discoveredAt: '2026-10-26T00:00:00.000Z',
    discoveryStatus: 'success',
    safeAdvertisedMethods: [{ method: 'eth_chainId', evidence: 'advertised' }],
    rawMethodCount: 38,
    latencyMs: 40,
    error: null,
  } satisfies CapabilitySnapshot),
}));

vi.mock('../../services/substrateWsProbe', () => ({
  DEFAULT_SUBSTRATE_WS_URL: 'wss://test-node-v3.portaldot.dev',
  probeSubstrateWs: vi.fn().mockResolvedValue({
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
  } satisfies SubstrateWsProbeResult),
}));

afterEach(() => cleanup());

const SNAPSHOT: HealthCheckSnapshot = {
  schemaVersion: HEALTH_SNAPSHOT_SCHEMA_VERSION,
  id: 'snap-test-1',
  timestamp: 5000,
  exportedAt: new Date(5000).toISOString(),
  endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
  endpointProfile: 'portaldot_v3_evm',
  checks: [
    { method: 'eth_chainId', outcome: 'success', success: true, latencyMs: 10, observedValue: '0x190f1ca9', error: null },
    { method: 'eth_blockNumber', outcome: 'success', success: true, latencyMs: 12, observedValue: '0x2ef01', error: null },
    { method: 'web3_clientVersion', outcome: 'success', success: true, latencyMs: 9, observedValue: 'Portaldot/v0.1.0', error: null },
    { method: 'net_version', outcome: 'success', success: true, latencyMs: 8, observedValue: '420420777', error: null },
  ],
  findings: [],
};

describe('FullDiagnosticRunner block ticker', () => {
  it('lists only blocks actually read during the run, with their real timestamps', async () => {
    render(
      <FullDiagnosticRunner
        endpoint="https://test-evm-rpc-v3.portaldot.dev"
        endpointProfile="portaldot_v3_evm"
        onConnect={async () => ({ status: 'connected', blockHex: '0x2ef00', blockAt: 1000 })}
        onRunHealthCheck={async () => SNAPSHOT}
        onProbeResult={() => {}}
        onCapabilitySnapshot={() => {}}
        onGoHistory={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run full diagnostic' }));

    // 0x2ef00 = 192256 (connect read at t=1000), 0x2ef01 = 192257
    // (health snapshot at t=5000), 4s apart.
    expect(await screen.findByText(/Block #192256/)).toBeInTheDocument();
    expect(screen.getByText(/Block #192257/)).toBeInTheDocument();
    expect(screen.getByText(/4s after the previous read/)).toBeInTheDocument();
    expect(screen.getByText(/not a live feed, no polling/)).toBeInTheDocument();
    expect(screen.getByText('Export report')).toBeInTheDocument();
    expect(screen.getByText('Verify report')).toBeInTheDocument();
  });
});
