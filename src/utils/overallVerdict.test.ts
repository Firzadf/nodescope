import { describe, it, expect } from 'vitest';
import { overallVerdictFrom } from './overallVerdict';
import type { HealthCheckSnapshot, HealthCheckCheck } from '../types/healthCheck';
import type { SubstrateWsProbeResult } from '../services/substrateWsProbe';

function snapshot(passed: number, total: number): HealthCheckSnapshot {
  const checks: HealthCheckCheck[] = Array.from({ length: total }, (_, i) => ({
    method: i === 0 ? 'eth_chainId' : i === 1 ? 'eth_blockNumber' : `m${i}`,
    outcome: i < passed ? 'success' : 'rpc_error',
    success: i < passed,
    latencyMs: 100,
    observedValue: i === 0 ? '0x190f1ca9' : i === 1 ? '0x2ef00' : null,
    error: i < passed ? null : 'fail',
  }));
  return {
    schemaVersion: 'nodescope.health-snapshot.v1',
    id: 'snap-1',
    timestamp: Date.now(),
    exportedAt: new Date().toISOString(),
    endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
    endpointProfile: 'portaldot_v3_evm',
    checks,
    findings: [],
  };
}

function probe(ok: boolean): SubstrateWsProbeResult {
  return {
    url: 'wss://test-node-v3.portaldot.dev',
    status: ok ? 'ok' : 'error',
    handshakeMs: 100,
    totalMs: 200,
    chain: 'PortaldotV3 Test',
    version: '3.0.0',
    peers: 1,
    isSyncing: false,
    shouldHavePeers: true,
    headerNumberHex: '0x2ef03',
    headerNumberDecimal: '192259',
    error: ok ? null : 'boom',
  };
}

describe('overallVerdictFrom', () => {
  it('is not_checked with no snapshot and no probe', () => {
    expect(overallVerdictFrom(null, null)).toBe('not_checked');
  });

  it('is healthy when every EVM check passed and the probe answered', () => {
    expect(overallVerdictFrom(snapshot(4, 4), probe(true))).toBe('healthy');
  });

  it('is degraded with one transport only', () => {
    expect(overallVerdictFrom(snapshot(4, 4), null)).toBe('degraded');
    expect(overallVerdictFrom(null, probe(true))).toBe('degraded');
  });

  it('is degraded when some EVM checks failed', () => {
    expect(overallVerdictFrom(snapshot(3, 4), probe(true))).toBe('degraded');
  });

  it('is down when nothing succeeded on either transport', () => {
    expect(overallVerdictFrom(snapshot(0, 4), probe(false))).toBe('down');
    expect(overallVerdictFrom(snapshot(0, 4), null)).toBe('down');
  });

  it('lets a below-healthy Health Score pull HEALTHY down to DEGRADED, never to DOWN', () => {
    expect(overallVerdictFrom(snapshot(4, 4), probe(true), 'degraded')).toBe('degraded');
    expect(overallVerdictFrom(snapshot(4, 4), probe(true), 'critical')).toBe('degraded');
    expect(overallVerdictFrom(snapshot(4, 4), probe(true), 'healthy')).toBe('healthy');
    expect(overallVerdictFrom(snapshot(4, 4), probe(true), null)).toBe('healthy');
    expect(overallVerdictFrom(snapshot(0, 4), probe(false), 'critical')).toBe('down');
  });

  it('says STALLED when the RPC answered and the head is paused, and never calls that DOWN', () => {
    expect(overallVerdictFrom(snapshot(4, 4), probe(true), 'healthy', 'stalled')).toBe('stalled');
    expect(overallVerdictFrom(snapshot(4, 4), probe(true), 'critical', 'stalled')).toBe('stalled');
    expect(overallVerdictFrom(snapshot(0, 4), probe(false), 'critical', 'stalled')).toBe('down');
    expect(overallVerdictFrom(snapshot(4, 4), probe(true), 'degraded', 'live')).toBe('degraded');
  });
});
