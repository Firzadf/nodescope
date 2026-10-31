import { describe, expect, it } from 'vitest';
import { computeCombinedVerdict, extractEvmSide, CROSS_TRANSPORT_NOTE, type EvmSide } from './combinedVerdict';
import type { HealthCheckSnapshot } from '../types/healthCheck';
import type { SubstrateWsProbeResult } from '../services/substrateWsProbe';

const evm: EvmSide = {
  endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
  timestamp: '2026-10-25T00:00:00.000Z',
  era: 'Post-V3',
  blockHeightHex: '0x2b675',
  blockHeightDecimal: '177781',
  chainIdHex: '0x190f1ca9',
  chainIdDecimal: '420420777',
  checksPassed: 4,
  checksTotal: 4,
};

const wsOk: SubstrateWsProbeResult = {
  url: 'wss://test-node-v3.portaldot.dev',
  status: 'ok',
  handshakeMs: 100,
  totalMs: 200,
  chain: 'PortaldotV3 Test',
  version: '3.0.0-dev',
  peers: 1,
  isSyncing: false,
  shouldHavePeers: true,
  headerNumberHex: '0x2b644',
  headerNumberDecimal: '177732',
  error: null,
};

describe('computeCombinedVerdict', () => {
  it('is complete when both transports answered', () => {
    const v = computeCombinedVerdict(evm, wsOk);
    expect(v.status).toBe('complete');
    expect(v.warnings).toHaveLength(0);
  });

  it('is partial when only one transport answered, and never computes a cross-transport delta', () => {
    const v = computeCombinedVerdict(evm, null);
    expect(v.status).toBe('partial');
    expect(v.warnings.length).toBeGreaterThan(0);
    expect(CROSS_TRANSPORT_NOTE).toContain('2 blocks');
    expect(CROSS_TRANSPORT_NOTE).toContain('persists');
    expect('crossTransportDelta' in v).toBe(false);
  });

  it('is unavailable when neither transport answered', () => {
    expect(computeCombinedVerdict(null, null).status).toBe('unavailable');
  });

  it('warns on a wrong EVM chain ID', () => {
    const v = computeCombinedVerdict({ ...evm, chainIdDecimal: '1' }, wsOk);
    expect(v.warnings.some((w) => w.includes('420420777'))).toBe(true);
  });
});

describe('extractEvmSide', () => {
  it('reads block and chain from a snapshot and converts hex to decimal', () => {
    const snapshot: HealthCheckSnapshot = {
      schemaVersion: 'nodescope.health-snapshot.v1',
      id: 'health-1',
      timestamp: Date.UTC(2026, 9, 25),
      exportedAt: '2026-10-25T00:00:00.000Z',
      endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
      endpointProfile: 'portaldot_v3_evm',
      checks: [
        { method: 'eth_blockNumber', outcome: 'success', success: true, latencyMs: 10, observedValue: '0x2b675', error: null },
        { method: 'eth_chainId', outcome: 'success', success: true, latencyMs: 10, observedValue: '0x190f1ca9', error: null },
      ],
      findings: [],
    };
    const side = extractEvmSide(snapshot);
    expect(side?.blockHeightDecimal).toBe('177781');
    expect(side?.chainIdDecimal).toBe('420420777');
    expect(side?.era).toBe('Post-V3');
    expect(extractEvmSide(null)).toBeNull();
  });
});
