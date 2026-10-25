// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveWsProbe,
  loadWsProbe,
  saveCapability,
  loadCapability,
} from './sessionRestore';
import type { SubstrateWsProbeResult } from './substrateWsProbe';
import type { CapabilitySnapshot } from '../types/capability';

const ENDPOINT = 'https://test-evm-rpc-v3.portaldot.dev';

const probe: SubstrateWsProbeResult = {
  url: 'wss://test-node-v3.portaldot.dev',
  status: 'ok',
  handshakeMs: 120,
  totalMs: 300,
  chain: 'PortaldotV3 Test',
  version: '3.0.0-dev',
  peers: 1,
  isSyncing: false,
  shouldHavePeers: true,
  headerNumberHex: '0x2eccc',
  headerNumberDecimal: '191692',
  error: null,
};

const capability: CapabilitySnapshot = {
  endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
  discoveredAt: '2026-10-26T00:00:00.000Z',
  discoveryStatus: 'success',
  safeAdvertisedMethods: [{ method: 'eth_blockNumber', evidence: 'advertised' }],
  rawMethodCount: 38,
  latencyMs: 210,
  error: null,
};

describe('sessionRestore', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('round-trips a probe result for the same endpoint', () => {
    saveWsProbe(ENDPOINT, probe);
    const loaded = loadWsProbe(ENDPOINT);
    expect(loaded?.result).toEqual(probe);
    expect(typeof loaded?.storedAt).toBe('number');
  });

  it('refuses a probe stored for a different endpoint', () => {
    saveWsProbe(ENDPOINT, probe);
    expect(loadWsProbe('https://other.example')).toBeNull();
  });

  it('refuses a capability stored for a different endpoint origin', () => {
    saveCapability(capability);
    expect(loadCapability('https://other.example')).toBeNull();
    expect(loadCapability(ENDPOINT)?.snapshot).toEqual(capability);
  });

  it('rejects corrupt stored data', () => {
    sessionStorage.setItem('nodescope_ws_probe_v1', '{not json');
    expect(loadWsProbe(ENDPOINT)).toBeNull();
    sessionStorage.setItem('nodescope_ws_probe_v1', JSON.stringify({ endpoint: ENDPOINT, result: { status: 'ok' }, storedAt: 1 }));
    expect(loadWsProbe(ENDPOINT)).toBeNull();
  });
});
