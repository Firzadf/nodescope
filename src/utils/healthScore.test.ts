import { describe, it, expect } from 'vitest';
import {
  computeHealthScore,
  latencyPoints,
  bandFor,
  HEALTH_SCORE_WEIGHTS,
  HEALTH_SCORE_FORMULA,
  lostPointsNote,
  formatPoints,
} from './healthScore';
import { attachHealthScore, buildDiagnosticReport } from './reportBuilder';
import { stampReportIntegrity, verifyReport } from './reportIntegrity';
import type { HealthCheckCheck, HealthCheckSnapshot } from '../types/healthCheck';
import type { SubstrateWsProbeResult } from '../services/substrateWsProbe';

function check(method: string, observedValue: string | null, latencyMs: number | null, success = true, outcome: HealthCheckCheck['outcome'] = success ? 'success' : 'network_error'): HealthCheckCheck {
  return { method, outcome, success, latencyMs, observedValue, error: success ? null : 'x' };
}

function snap(id: string, timestamp: number, height: string, latency = 250, chain = '0x190f1ca9', origin = 'https://test-evm-rpc-v3.portaldot.dev'): HealthCheckSnapshot {
  return {
    schemaVersion: 'nodescope.health-snapshot.v1',
    id,
    timestamp,
    exportedAt: new Date(timestamp).toISOString(),
    endpointOrigin: origin,
    endpointProfile: 'portaldot_v3_evm',
    checks: [
      check('eth_chainId', chain, latency),
      check('eth_blockNumber', height, latency),
      check('web3_clientVersion', 'eth-rpc/main', latency),
      check('net_version', '420420777', latency),
    ],
    findings: [],
  };
}

const wsOk: SubstrateWsProbeResult = {
  url: 'wss://test-node-v3.portaldot.dev',
  status: 'ok',
  handshakeMs: 120,
  totalMs: 300,
  chain: 'PortaldotV3 Test',
  version: '1',
  peers: 1,
  isSyncing: false,
  shouldHavePeers: true,
  headerNumberHex: '0x2b644',
  headerNumberDecimal: '177732',
  error: null,
};

describe('health score formula', () => {
  it('publishes weights that sum to exactly 100', () => {
    const total = Object.values(HEALTH_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it('scores a fully healthy session 100 with full coverage', () => {
    const s = computeHealthScore({
      snapshots: [snap('a', 1_000_000, '0x231a0'), snap('b', 1_076_000, '0x231ac')],
      wsProbe: wsOk,
    });
    expect(s.formula).toBe(HEALTH_SCORE_FORMULA);
    expect(s.coverage).toBe(100);
    expect(s.score).toBe(100);
    expect(s.band).toBe('healthy');
    expect(s.components.every((c) => c.measured)).toBe(true);
  });

  it('is independent of snapshot array order', () => {
    const a = snap('a', 1_000_000, '0x231a0');
    const b = snap('b', 1_076_000, '0x231ac');
    expect(computeHealthScore({ snapshots: [a, b], wsProbe: wsOk })).toEqual(
      computeHealthScore({ snapshots: [b, a], wsProbe: wsOk }),
    );
  });

  it('never scores missing data: renormalizes and reports coverage', () => {
    // One snapshot, no probe: head progression and WSS are not measured.
    const s = computeHealthScore({ snapshots: [snap('a', 1_000_000, '0x231a0')], wsProbe: null });
    expect(s.coverage).toBe(65);
    expect(s.score).toBe(100);
    const head = s.components.find((c) => c.id === 'head_progression');
    expect(head?.measured).toBe(false);
    expect(head?.points).toBeNull();
  });

  it('returns null below 50% coverage instead of inventing a number', () => {
    const s = computeHealthScore({ snapshots: [], wsProbe: wsOk });
    expect(s.coverage).toBe(15);
    expect(s.score).toBeNull();
    expect(s.band).toBeNull();
  });

  it('penalizes a stalled head, a wrong chain, and failed checks', () => {
    const a = snap('a', 1_000_000, '0x100');
    const b = snap('b', 1_060_000, '0x100', 250, '0x1');
    b.checks[2] = check('web3_clientVersion', null, null, false);
    const s = computeHealthScore({ snapshots: [a, b], wsProbe: { ...wsOk, status: 'error', error: 'timeout' } });
    const byId = Object.fromEntries(s.components.map((c) => [c.id, c.points]));
    expect(byId.head_progression).toBe(0);
    expect(byId.chain_identity).toBe(0);
    expect(byId.availability).toBe(22.5);
    expect(byId.transport_parity).toBe(0);
    expect(s.score).toBe(Math.round(22.5 + 20));
    expect(s.band).toBe('critical');
  });

  it('treats unsupported_method (-32601) as not eligible, never as a failure', () => {
    const a = snap('a', 1_000_000, '0x100');
    a.checks.push(check('system_health', null, 10, false, 'unsupported_method'));
    const s = computeHealthScore({ snapshots: [a], wsProbe: null });
    expect(s.components.find((c) => c.id === 'availability')?.points).toBe(30);
  });

  it('gives half marks for the same height less than 30 s apart', () => {
    const s = computeHealthScore({
      snapshots: [snap('a', 1_000_000, '0x100'), snap('b', 1_010_000, '0x100')],
      wsProbe: wsOk,
    });
    expect(s.components.find((c) => c.id === 'head_progression')?.points).toBe(10);
  });

  it('only compares head progression on the same endpoint', () => {
    const s = computeHealthScore({
      snapshots: [snap('a', 1_000_000, '0x100', 250, '0x190f1ca9', 'https://other.example'), snap('b', 1_076_000, '0x200')],
      wsProbe: null,
    });
    expect(s.components.find((c) => c.id === 'head_progression')?.measured).toBe(false);
  });

  it('maps latency linearly between 300 ms and 2000 ms', () => {
    expect(latencyPoints(120)).toBe(20);
    expect(latencyPoints(300)).toBe(20);
    expect(latencyPoints(1150)).toBe(10);
    expect(latencyPoints(2000)).toBe(0);
    expect(latencyPoints(5000)).toBe(0);
  });

  it('uses fixed bands', () => {
    expect(bandFor(100)).toBe('healthy');
    expect(bandFor(90)).toBe('healthy');
    expect(bandFor(89)).toBe('degraded');
    expect(bandFor(70)).toBe('degraded');
    expect(bandFor(69)).toBe('critical');
  });
});

describe('health score in NEW reports', () => {
  it('attaches additively, inside the SHA-256 stamp, and still verifies', async () => {
    const base = buildDiagnosticReport([], new Date('2026-10-27T10:00:00Z'));
    const withScore = attachHealthScore(base, [snap('a', 1_000_000, '0x231a0'), snap('b', 1_076_000, '0x231ac')], wsOk);
    expect(base).not.toHaveProperty('healthScore');
    expect(withScore.healthScore?.score).toBe(100);
    expect(withScore.healthScore?.methodology).toBe('/docs#health-score');
    const stamped = await stampReportIntegrity(withScore);
    const verdict = await verifyReport(stamped);
    expect(verdict.status).toBe('verified');
    const tampered = { ...stamped, healthScore: { ...stamped.healthScore!, score: 42 } };
    expect((await verifyReport(tampered)).status).not.toBe('verified');
  });

  it('leaves a report with no measurements unchanged', () => {
    const base = buildDiagnosticReport([], new Date('2026-10-27T10:00:00Z'));
    expect(attachHealthScore(base, [], null)).toBe(base);
  });
});

describe('lostPointsNote', () => {
  it('names where the missing points went, from the same score object as the gauge', () => {
    // All RPCs answer and WSS answers, but the head is stalled for 899 s.
    const a = snap('a', 1_000_000, '0x38ab3');
    const b = snap('b', 1_899_000, '0x38ab3');
    const s = computeHealthScore({ snapshots: [a, b], wsProbe: wsOk });
    expect(s.band).not.toBe('healthy');
    expect(lostPointsNote(s)).toMatch(/−20 head progression/);
  });

  it('is empty when nothing was lost', () => {
    const a = snap('a', 1_000_000, '0x100');
    const b = snap('b', 1_060_000, '0x105');
    expect(lostPointsNote(computeHealthScore({ snapshots: [a, b], wsProbe: wsOk }))).toBe('');
  });
});

describe('formatPoints', () => {
  it('rounds to one decimal without float noise', () => {
    expect(formatPoints(20 - 19.7)).toBe('0.3');
    expect(formatPoints(1.1000000000000014)).toBe('1.1');
    expect(formatPoints(20)).toBe('20');
  });
});
