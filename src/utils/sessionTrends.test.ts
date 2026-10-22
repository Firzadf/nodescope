import { describe, expect, it } from 'vitest';
import { computeSessionTrends } from './sessionTrends';
import {
  HEALTH_SNAPSHOT_SCHEMA_VERSION,
  type HealthCheckCheck,
  type HealthCheckSnapshot,
} from '../types/healthCheck';

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

function healthyChecks(blockHex: string, latencyMs = 40, blockLatencyMs?: number): HealthCheckCheck[] {
  return [
    createCheck({ method: 'eth_chainId', latencyMs, observedValue: '0x190f1ca9' }),
    createCheck({ method: 'eth_blockNumber', latencyMs: blockLatencyMs ?? latencyMs, observedValue: blockHex }),
    createCheck({ method: 'web3_clientVersion', latencyMs, observedValue: 'eth-rpc/test' }),
    createCheck({ method: 'net_version', latencyMs, observedValue: '420420777' }),
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

describe('computeSessionTrends — honesty minimums', () => {
  it('reports insufficient data for an empty session', () => {
    const trends = computeSessionTrends([]);
    expect(trends.status).toBe('insufficient_data');
    expect(trends.reason).toMatch(/No health checks/);
    expect(trends.verdict.level).toBe('insufficient_data');
    expect(trends.verdict.rules).toEqual([]);
    expect(trends.methods).toEqual([]);
    expect(trends.passRate).toEqual({ passed: 0, total: 0, ratio: null });
  });

  it('reports insufficient data for a single snapshot — no fake trend from one point', () => {
    const trends = computeSessionTrends([createSnapshot()]);
    expect(trends.status).toBe('insufficient_data');
    expect(trends.reason).toMatch(/at least 2 health checks/);
    expect(trends.verdict.level).toBe('insufficient_data');
    expect(trends.snapshotCount).toBe(1);
  });

  it('reports insufficient data when snapshots contain no checks at all', () => {
    const trends = computeSessionTrends([
      createSnapshot({ id: 'a', timestamp: T0, checks: [] }),
      createSnapshot({ id: 'b', timestamp: T0 + 60_000, checks: [] }),
    ]);
    expect(trends.status).toBe('insufficient_data');
    expect(trends.verdict.level).toBe('insufficient_data');
  });
});

describe('computeSessionTrends — healthy session', () => {
  const session = [
    createSnapshot({ id: 's1', timestamp: T0, checks: healthyChecks('0x100') }),
    createSnapshot({ id: 's2', timestamp: T0 + 76_000, checks: healthyChecks('0x10c') }),
    createSnapshot({ id: 's3', timestamp: T0 + 152_000, checks: healthyChecks('0x118') }),
  ];

  it('computes a healthy verdict with every rule listed and none fired', () => {
    const trends = computeSessionTrends(session);
    expect(trends.status).toBe('available');
    expect(trends.verdict.level).toBe('healthy');
    expect(trends.verdict.rules.map((r) => r.ruleId)).toEqual([
      'verdict.no-real-failures',
      'verdict.no-block-stall',
      'verdict.no-block-regression',
      'verdict.no-latency-drift',
    ]);
    expect(trends.verdict.rules.every((r) => !r.fired)).toBe(true);
    expect(trends.verdict.rules[0].evidence).toBe('0 real failures across 12 checks');
    // Drift rule is honestly unevaluated with only 3 samples per method.
    expect(trends.verdict.rules[3].evaluated).toBe(false);
    expect(trends.verdict.rules[3].evidence).toMatch(/at most 3 latency sample/);
  });

  it('reports pass rate and session scope', () => {
    const trends = computeSessionTrends(session);
    expect(trends.passRate).toEqual({ passed: 12, total: 12, ratio: 1 });
    expect(trends.snapshotCount).toBe(3);
    expect(trends.excludedSnapshotCount).toBe(0);
    expect(trends.endpointOrigin).toBe(ORIGIN);
    expect(trends.snapshotIds).toEqual(['s1', 's2', 's3']);
    expect(trends.firstTimestamp).toBe(T0);
    expect(trends.lastTimestamp).toBe(T0 + 152_000);
  });

  it('is independent of input order and never mutates its input', () => {
    const input = [session[2], session[0], session[1]];
    const before = JSON.stringify(input);
    const a = computeSessionTrends(input);
    const b = computeSessionTrends(session);
    expect(a).toEqual(b);
    expect(JSON.stringify(input)).toBe(before);
    expect(input.map((s) => s.id)).toEqual(['s3', 's1', 's2']);
  });
});

describe('computeSessionTrends — latency trends', () => {
  it('computes min/median/max/first/last per method, excluding missing latencies', () => {
    const trends = computeSessionTrends([
      createSnapshot({ id: 's1', timestamp: T0, checks: healthyChecks('0x100', 30) }),
      createSnapshot({
        id: 's2',
        timestamp: T0 + 60_000,
        checks: healthyChecks('0x110', 10).map((c) =>
          c.method === 'eth_chainId' ? { ...c, latencyMs: null } : c
        ),
      }),
      createSnapshot({ id: 's3', timestamp: T0 + 120_000, checks: healthyChecks('0x120', 20) }),
    ]);

    const chainId = trends.methods.find((m) => m.method === 'eth_chainId');
    // eth_chainId latencies recorded: 30 (s1), null (s2, excluded), 20 (s3)
    expect(chainId?.samples).toBe(2);
    expect(chainId?.minMs).toBe(20);
    expect(chainId?.maxMs).toBe(30);
    expect(chainId?.medianMs).toBe(25);
    expect(chainId?.firstMs).toBe(30);
    expect(chainId?.lastMs).toBe(20);
    expect(trends.methods.map((m) => m.method)).toEqual([
      'eth_blockNumber',
      'eth_chainId',
      'net_version',
      'web3_clientVersion',
    ]);
  });
});

describe('computeSessionTrends — block progression', () => {
  it('computes total delta and per-interval block-time estimates', () => {
    const trends = computeSessionTrends([
      createSnapshot({ id: 's1', timestamp: T0, checks: healthyChecks('0x100') }),
      createSnapshot({ id: 's2', timestamp: T0 + 76_000, checks: healthyChecks('0x10c') }), // +12 blocks
      createSnapshot({ id: 's3', timestamp: T0 + 136_000, checks: healthyChecks('0x116') }), // +10 blocks in 60 s
    ]);

    const prog = trends.blockProgression;
    expect(prog.method).toBe('eth_blockNumber');
    expect(prog.points.map((p) => p.height)).toEqual(['256', '268', '278']);
    expect(prog.totalDelta).toBe('22');
    expect(prog.intervals).toHaveLength(2);
    expect(prog.intervals[0].blockDelta).toBe('12');
    expect(prog.intervals[0].secondsPerBlock).toBeCloseTo(76 / 12, 6);
    expect(prog.intervals[1].secondsPerBlock).toBeCloseTo(6, 6);
    expect(prog.medianSecondsPerBlock).toBeCloseTo((76 / 12 + 6) / 2, 6);
    expect(prog.stalls).toEqual([]);
    expect(prog.regressions).toEqual([]);
  });

  it('keeps heights exact beyond the safe-integer range (BigInt path)', () => {
    // 0x20000000000064 = 2^53 + 100 — beyond Number.MAX_SAFE_INTEGER precision games.
    const trends = computeSessionTrends([
      createSnapshot({ id: 's1', timestamp: T0, checks: healthyChecks('0x20000000000064') }),
      createSnapshot({ id: 's2', timestamp: T0 + 60_000, checks: healthyChecks('0x2000000000006e') }),
    ]);
    expect(trends.blockProgression.points.map((p) => p.height)).toEqual([
      '9007199254741092',
      '9007199254741102',
    ]);
    expect(trends.blockProgression.totalDelta).toBe('10');
  });

  it('records a stall finding but does not degrade the verdict under the 30 s threshold', () => {
    const trends = computeSessionTrends([
      createSnapshot({ id: 's1', timestamp: T0, checks: healthyChecks('0x100') }),
      createSnapshot({ id: 's2', timestamp: T0 + 5_000, checks: healthyChecks('0x100') }),
    ]);
    expect(trends.blockProgression.stalls).toEqual([
      { earlierSnapshotId: 's1', laterSnapshotId: 's2', height: '256', gapSeconds: 5 },
    ]);
    expect(trends.blockProgression.intervals[0].secondsPerBlock).toBeNull();
    const stallRule = trends.verdict.rules.find((r) => r.ruleId === 'verdict.no-block-stall');
    expect(stallRule?.fired).toBe(false);
    expect(stallRule?.evidence).toMatch(/below the firing threshold/);
    expect(trends.verdict.level).toBe('healthy');
  });

  it('degrades the verdict when a stall spans 30 s or more', () => {
    const trends = computeSessionTrends([
      createSnapshot({ id: 's1', timestamp: T0, checks: healthyChecks('0x100') }),
      createSnapshot({ id: 's2', timestamp: T0 + 76_000, checks: healthyChecks('0x100') }),
    ]);
    const stallRule = trends.verdict.rules.find((r) => r.ruleId === 'verdict.no-block-stall');
    expect(stallRule?.fired).toBe(true);
    expect(stallRule?.evidence).toContain('Block height unchanged at 256 across a 76 s gap');
    expect(trends.verdict.level).toBe('degraded');
  });

  it('degrades the verdict on a block-height regression', () => {
    const trends = computeSessionTrends([
      createSnapshot({ id: 's1', timestamp: T0, checks: healthyChecks('0x120') }),
      createSnapshot({ id: 's2', timestamp: T0 + 60_000, checks: healthyChecks('0x100') }),
    ]);
    expect(trends.blockProgression.regressions).toEqual([
      {
        earlierSnapshotId: 's1',
        laterSnapshotId: 's2',
        fromHeight: '288',
        toHeight: '256',
        gapSeconds: 60,
      },
    ]);
    const rule = trends.verdict.rules.find((r) => r.ruleId === 'verdict.no-block-regression');
    expect(rule?.fired).toBe(true);
    expect(rule?.evidence).toContain('Block height decreased 288 → 256');
    expect(trends.verdict.level).toBe('degraded');
  });
});

describe('computeSessionTrends — verdict rules', () => {
  it('marks the session unstable when any check is a real failure', () => {
    const failing = healthyChecks('0x110').map((c) =>
      c.method === 'net_version'
        ? { ...c, outcome: 'network_error' as const, success: false, latencyMs: null, observedValue: null, error: 'Failed to fetch' }
        : c
    );
    const trends = computeSessionTrends([
      createSnapshot({ id: 's1', timestamp: T0, checks: healthyChecks('0x100') }),
      createSnapshot({ id: 's2', timestamp: T0 + 60_000, checks: failing }),
    ]);
    expect(trends.verdict.level).toBe('unstable');
    const rule = trends.verdict.rules.find((r) => r.ruleId === 'verdict.no-real-failures');
    expect(rule?.fired).toBe(true);
    expect(rule?.evidence).toBe('1 of 8 checks failed (network_error ×1)');
    expect(trends.failureCounts).toEqual([{ outcome: 'network_error', count: 1 }]);
    expect(trends.passRate).toEqual({ passed: 7, total: 8, ratio: 0.875 });
  });

  it('does not treat unsupported methods as failures — verdict stays healthy', () => {
    const unsupported = (checks: HealthCheckCheck[]) =>
      checks.map((c) =>
        c.method === 'web3_clientVersion'
          ? { ...c, outcome: 'unsupported_method' as const, success: false, latencyMs: null, observedValue: null, error: 'JSON-RPC Error [-32601]: Method not found' }
          : c
      );
    const trends = computeSessionTrends([
      createSnapshot({ id: 's1', timestamp: T0, checks: unsupported(healthyChecks('0x100')) }),
      createSnapshot({ id: 's2', timestamp: T0 + 60_000, checks: unsupported(healthyChecks('0x110')) }),
    ]);
    expect(trends.passRate.ratio).toBe(0.75);
    expect(trends.failureCounts).toEqual([]);
    expect(trends.verdict.level).toBe('healthy');
  });

  it('degrades on latency drift when both the ratio and absolute thresholds are met', () => {
    const blockLatencies = [200, 220, 600, 640, 680];
    const snapshots = blockLatencies.map((latency, i) =>
      createSnapshot({
        id: `s${i + 1}`,
        timestamp: T0 + i * 60_000,
        checks: healthyChecks(`0x${(256 + i * 16).toString(16)}`, 40, latency),
      })
    );
    const trends = computeSessionTrends(snapshots);
    const block = trends.methods.find((m) => m.method === 'eth_blockNumber');
    expect(block?.medianFirstHalfMs).toBe(210);
    expect(block?.medianSecondHalfMs).toBe(640);
    const rule = trends.verdict.rules.find((r) => r.ruleId === 'verdict.no-latency-drift');
    expect(rule?.evaluated).toBe(true);
    expect(rule?.fired).toBe(true);
    expect(rule?.evidence).toBe('median eth_blockNumber latency rose 210 ms → 640 ms across 5 checks');
    expect(trends.verdict.level).toBe('degraded');
  });

  it('does not fire drift when the rise is large in ratio but tiny in absolute terms', () => {
    const blockLatencies = [40, 40, 70, 70];
    const snapshots = blockLatencies.map((latency, i) =>
      createSnapshot({
        id: `s${i + 1}`,
        timestamp: T0 + i * 60_000,
        checks: healthyChecks(`0x${(256 + i * 16).toString(16)}`, 40, latency),
      })
    );
    const trends = computeSessionTrends(snapshots);
    const rule = trends.verdict.rules.find((r) => r.ruleId === 'verdict.no-latency-drift');
    expect(rule?.evaluated).toBe(true);
    expect(rule?.fired).toBe(false);
    expect(trends.verdict.level).toBe('healthy');
  });

  it('does not fire drift when the absolute rise is large but the ratio threshold is not met', () => {
    const blockLatencies = [400, 400, 590, 590];
    const snapshots = blockLatencies.map((latency, i) =>
      createSnapshot({
        id: `s${i + 1}`,
        timestamp: T0 + i * 60_000,
        checks: healthyChecks(`0x${(256 + i * 16).toString(16)}`, 40, latency),
      })
    );
    const trends = computeSessionTrends(snapshots);
    const rule = trends.verdict.rules.find((r) => r.ruleId === 'verdict.no-latency-drift');
    expect(rule?.fired).toBe(false);
    expect(trends.verdict.level).toBe('healthy');
  });

  it('prioritizes unstable over degraded when both kinds of rules fire', () => {
    const failing = healthyChecks('0x100').map((c) =>
      c.method === 'net_version'
        ? { ...c, outcome: 'rpc_error' as const, success: false, latencyMs: null, observedValue: null, error: 'boom' }
        : c
    );
    const trends = computeSessionTrends([
      createSnapshot({ id: 's1', timestamp: T0, checks: healthyChecks('0x100') }),
      // Same height 76 s later (stall → degraded) AND a real failure (→ unstable).
      createSnapshot({ id: 's2', timestamp: T0 + 76_000, checks: failing }),
    ]);
    expect(trends.verdict.level).toBe('unstable');
    expect(trends.verdict.rules.filter((r) => r.fired).map((r) => r.ruleId)).toEqual([
      'verdict.no-real-failures',
      'verdict.no-block-stall',
    ]);
  });
});

describe('computeSessionTrends — endpoint grouping', () => {
  it('analyzes only the newest snapshot’s endpoint group and counts the rest as excluded', () => {
    const other = 'https://other.example.test';
    const trends = computeSessionTrends([
      createSnapshot({ id: 'a1', timestamp: T0, endpointOrigin: ORIGIN }),
      createSnapshot({ id: 'b1', timestamp: T0 + 10_000, endpointOrigin: other }),
      createSnapshot({ id: 'a2', timestamp: T0 + 20_000, endpointOrigin: ORIGIN }),
      createSnapshot({ id: 'b2', timestamp: T0 + 30_000, endpointOrigin: other, checks: healthyChecks('0x200') }),
    ]);
    expect(trends.status).toBe('available');
    expect(trends.endpointOrigin).toBe(other);
    expect(trends.snapshotCount).toBe(2);
    expect(trends.totalSnapshotCount).toBe(4);
    expect(trends.excludedSnapshotCount).toBe(2);
    expect(trends.snapshotIds).toEqual(['b1', 'b2']);
  });

  it('is insufficient when the newest endpoint has only one snapshot, even if another has many', () => {
    const other = 'https://other.example.test';
    const trends = computeSessionTrends([
      createSnapshot({ id: 'a1', timestamp: T0 }),
      createSnapshot({ id: 'a2', timestamp: T0 + 10_000, checks: healthyChecks('0x110') }),
      createSnapshot({ id: 'a3', timestamp: T0 + 20_000, checks: healthyChecks('0x120') }),
      createSnapshot({ id: 'b1', timestamp: T0 + 30_000, endpointOrigin: other }),
    ]);
    expect(trends.status).toBe('insufficient_data');
    expect(trends.snapshotCount).toBe(1);
    expect(trends.excludedSnapshotCount).toBe(3);
    expect(trends.endpointOrigin).toBe(other);
  });
});
