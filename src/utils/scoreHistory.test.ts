import { describe, expect, it } from 'vitest';
import { buildScoreHistory } from './scoreHistory';
import type { HealthCheckSnapshot } from '../types/healthCheck';
import type { SubstrateWsProbeResult } from '../services/substrateWsProbe';

function snap(id: string, timestamp: number, height: string): HealthCheckSnapshot {
  const check = (method: string, observedValue: string) => ({
    method,
    outcome: 'success' as const,
    success: true,
    latencyMs: 120,
    observedValue,
    error: null,
  });
  return {
    schemaVersion: 'nodescope.health-snapshot.v1',
    id,
    timestamp,
    exportedAt: new Date(timestamp).toISOString(),
    endpointOrigin: 'https://rpc.example.test',
    endpointProfile: 'portaldot_v3_evm',
    checks: [check('eth_chainId', '0x190f1ca9'), check('eth_blockNumber', height)],
    findings: [],
  };
}

const probe: SubstrateWsProbeResult = {
  url: 'wss://node.example.test',
  status: 'ok',
  handshakeMs: 10,
  totalMs: 20,
  chain: 'Example',
  version: '1',
  peers: 2,
  isSyncing: false,
  shouldHavePeers: true,
  headerNumberHex: '0x20',
  headerNumberDecimal: '32',
  finalizedNumberDecimal: '30',
  finalityLagBlocks: 2,
  error: null,
};

describe('buildScoreHistory', () => {
  it('needs nothing from an empty session', () => {
    expect(buildScoreHistory([])).toEqual([]);
  });

  it('marks a stalled head and a stall transition, and puts lag only on the newest point', () => {
    const points = buildScoreHistory(
      [snap('a', 1_000, '0x10'), snap('b', 41_000, '0x10'), snap('c', 80_000, '0x12')],
      probe,
      null,
    );
    expect(points).toHaveLength(3);
    expect(points[0].transition).toBeNull();
    expect(points[0].finalityLag).toBeNull();
    expect(points[1].stall).toBe(true);
    expect(points[1].verdict).toBe('stalled');
    expect(points[1].transition).toBe('stall');
    expect(points[2].stall).toBe(false);
    expect(points[2].transition).toBe('resume');
    expect(points[2].finalityLag).toBe(2);
    expect(points[2].bestHeight).toBe('18');
  });
});
