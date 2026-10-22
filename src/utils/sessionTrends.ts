import type { EndpointProfile } from '../types/endpoint';
import type {
  HealthCheckOutcome,
  HealthCheckSnapshot,
} from '../types/healthCheck';
import { isRealFailure, parseBlockHeight } from './snapshotComparer';

/**
 * Session trends & verdict (Phase 2.5).
 *
 * Design rules (blueprint: agent_notes/phase-2.5-blueprint.md):
 * - Pure and deterministic: inputs are never mutated, ordering is stable, and the
 *   result depends only on the snapshots passed in — never on their array order.
 * - Trends are only computed over snapshots from ONE endpoint (origin + profile):
 *   the group containing the newest snapshot. Mixing endpoints would fabricate a
 *   trend line, so other snapshots are counted as excluded, never merged in.
 * - Missing data (`null`) is never equated with `0`. Heights are handled as
 *   BigInt and reported as decimal strings, exactly like the snapshot comparer.
 * - `unsupported_method` is never a failure (see `isRealFailure`).
 * - The verdict is three words plus its reasons: every rule is listed with the
 *   actual values that did or did not fire it. There is no score.
 */

export type VerdictLevel = 'healthy' | 'degraded' | 'unstable' | 'insufficient_data';

export type SessionTrendsStatus = 'available' | 'insufficient_data';

/** A stall only degrades the verdict at or beyond this gap (seconds). */
export const STALL_RULE_MIN_GAP_SECONDS = 30;
/** A method needs at least this many latency samples before drift is evaluated. */
export const DRIFT_MIN_SAMPLES = 4;
/** Drift fires only when the second-half median exceeds the first-half median by this factor… */
export const DRIFT_RATIO = 1.5;
/** …and by at least this many milliseconds, so small-scale jitter cannot fire it. */
export const DRIFT_MIN_RISE_MS = 100;

export const BLOCK_INTERVAL_NOTE =
  'The block interval is estimated from the wall-clock gap between your health checks, not from chain data. It assumes blocks were produced steadily between checks.';

export interface MethodLatencyTrend {
  method: string;
  /** Snapshots in the session where a finite latency was recorded for this method. */
  samples: number;
  minMs: number | null;
  medianMs: number | null;
  maxMs: number | null;
  /** Latency in the oldest snapshot that recorded one (chronological, not min/max). */
  firstMs: number | null;
  /** Latency in the newest snapshot that recorded one. */
  lastMs: number | null;
  medianFirstHalfMs: number | null;
  medianSecondHalfMs: number | null;
}

export interface BlockInterval {
  fromSnapshotId: string;
  toSnapshotId: string;
  fromTimestamp: number;
  toTimestamp: number;
  /** Decimal string of `to - from` (BigInt). May be "0" (stall) or negative (regression). */
  blockDelta: string;
  gapSeconds: number;
  /** Seconds per block. Non-null only when the height advanced and time passed. */
  secondsPerBlock: number | null;
}

export interface BlockStall {
  earlierSnapshotId: string;
  laterSnapshotId: string;
  /** Decimal string of the unchanged height. */
  height: string;
  gapSeconds: number;
}

export interface BlockRegression {
  earlierSnapshotId: string;
  laterSnapshotId: string;
  fromHeight: string;
  toHeight: string;
  gapSeconds: number;
}

export interface BlockProgression {
  /** Block-height method for the session's profile. Null when there is no session. */
  method: string | null;
  points: { snapshotId: string; timestamp: number; height: string }[];
  /** Decimal string of last − first height. Null with fewer than 2 usable points. */
  totalDelta: string | null;
  intervals: BlockInterval[];
  medianSecondsPerBlock: number | null;
  stalls: BlockStall[];
  regressions: BlockRegression[];
}

export interface VerdictRuleResult {
  ruleId: string;
  /** The rule, printed verbatim next to the verdict. */
  description: string;
  /** What firing this rule does to the verdict. */
  effect: 'unstable' | 'degraded';
  /** False when the session does not contain enough data to judge this rule. */
  evaluated: boolean;
  fired: boolean;
  /** The actual session values behind the outcome. */
  evidence: string;
}

export interface SessionVerdict {
  level: VerdictLevel;
  /** Why no verdict exists. Non-null only when `level === 'insufficient_data'`. */
  reason: string | null;
  /** Every rule, in fixed evaluation order. Empty when no verdict exists. */
  rules: VerdictRuleResult[];
}

export interface SessionTrends {
  status: SessionTrendsStatus;
  /** Why trends are unavailable. Non-null only when `status === 'insufficient_data'`. */
  reason: string | null;
  /** Snapshots in the analyzed (single-endpoint) group. */
  snapshotCount: number;
  totalSnapshotCount: number;
  /** Snapshots from other endpoints/profiles, deliberately not merged into the trend. */
  excludedSnapshotCount: number;
  endpointOrigin: string | null;
  endpointProfile: EndpointProfile | null;
  /** Ids of the analyzed snapshots, chronological — the verdict's paper trail. */
  snapshotIds: string[];
  firstTimestamp: number | null;
  lastTimestamp: number | null;
  methods: MethodLatencyTrend[];
  blockProgression: BlockProgression;
  passRate: { passed: number; total: number; ratio: number | null };
  /** Real-failure outcomes only (never `unsupported_method`), fixed outcome order. */
  failureCounts: { outcome: HealthCheckOutcome; count: number }[];
  verdict: SessionVerdict;
}

/** Block-height method by profile, matching `methodsForProfile` in healthCheckRunner. */
const BLOCK_HEIGHT_METHOD: Record<EndpointProfile, string> = {
  portaldot_v3_evm: 'eth_blockNumber',
  generic_http: 'chain_getHeader',
};

const REAL_FAILURE_ORDER: HealthCheckOutcome[] = [
  'rpc_error',
  'network_error',
  'http_error',
  'invalid_response',
];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Display formatting for evidence strings: integers stay integers, halves keep one decimal. */
function formatMs(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatClock(timestamp: number): string {
  return `${new Date(timestamp).toISOString().slice(11, 19)} UTC`;
}

function emptyProgression(method: string | null): BlockProgression {
  return {
    method,
    points: [],
    totalDelta: null,
    intervals: [],
    medianSecondsPerBlock: null,
    stalls: [],
    regressions: [],
  };
}

function insufficient(reason: string, totals: {
  totalSnapshotCount: number;
  snapshotCount: number;
  excludedSnapshotCount: number;
  endpointOrigin: string | null;
  endpointProfile: EndpointProfile | null;
  snapshotIds: string[];
  firstTimestamp: number | null;
  lastTimestamp: number | null;
}): SessionTrends {
  return {
    status: 'insufficient_data',
    reason,
    snapshotCount: totals.snapshotCount,
    totalSnapshotCount: totals.totalSnapshotCount,
    excludedSnapshotCount: totals.excludedSnapshotCount,
    endpointOrigin: totals.endpointOrigin,
    endpointProfile: totals.endpointProfile,
    snapshotIds: totals.snapshotIds,
    firstTimestamp: totals.firstTimestamp,
    lastTimestamp: totals.lastTimestamp,
    methods: [],
    blockProgression: emptyProgression(
      totals.endpointProfile ? BLOCK_HEIGHT_METHOD[totals.endpointProfile] : null
    ),
    passRate: { passed: 0, total: 0, ratio: null },
    failureCounts: [],
    verdict: { level: 'insufficient_data', reason, rules: [] },
  };
}

function computeLatencyTrends(ordered: HealthCheckSnapshot[]): MethodLatencyTrend[] {
  const methods = Array.from(
    new Set(ordered.flatMap((s) => s.checks.map((c) => c.method)))
  ).sort();

  return methods.map((method) => {
    const latencies: number[] = [];
    for (const snapshot of ordered) {
      const check = snapshot.checks.find((c) => c.method === method);
      if (check && check.latencyMs !== null && Number.isFinite(check.latencyMs)) {
        latencies.push(check.latencyMs);
      }
    }

    const half = Math.floor(latencies.length / 2);
    return {
      method,
      samples: latencies.length,
      minMs: latencies.length ? Math.min(...latencies) : null,
      medianMs: median(latencies),
      maxMs: latencies.length ? Math.max(...latencies) : null,
      firstMs: latencies.length ? latencies[0] : null,
      lastMs: latencies.length ? latencies[latencies.length - 1] : null,
      medianFirstHalfMs: latencies.length >= 2 ? median(latencies.slice(0, half)) : null,
      medianSecondHalfMs: latencies.length >= 2 ? median(latencies.slice(half)) : null,
    };
  });
}

function computeBlockProgression(
  ordered: HealthCheckSnapshot[],
  profile: EndpointProfile
): BlockProgression {
  const method = BLOCK_HEIGHT_METHOD[profile];
  const points: BlockProgression['points'] = [];

  for (const snapshot of ordered) {
    const check = snapshot.checks.find((c) => c.method === method);
    if (!check) continue;
    const height = parseBlockHeight(check.observedValue);
    if (height === null) continue;
    points.push({ snapshotId: snapshot.id, timestamp: snapshot.timestamp, height: height.toString() });
  }

  const intervals: BlockInterval[] = [];
  const stalls: BlockStall[] = [];
  const regressions: BlockRegression[] = [];

  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    const delta = BigInt(to.height) - BigInt(from.height);
    const gapSeconds = (to.timestamp - from.timestamp) / 1000;

    let secondsPerBlock: number | null = null;
    if (delta > 0n && gapSeconds > 0 && delta <= BigInt(Number.MAX_SAFE_INTEGER)) {
      secondsPerBlock = gapSeconds / Number(delta);
    }

    intervals.push({
      fromSnapshotId: from.snapshotId,
      toSnapshotId: to.snapshotId,
      fromTimestamp: from.timestamp,
      toTimestamp: to.timestamp,
      blockDelta: delta.toString(),
      gapSeconds,
      secondsPerBlock,
    });

    if (delta === 0n) {
      stalls.push({
        earlierSnapshotId: from.snapshotId,
        laterSnapshotId: to.snapshotId,
        height: from.height,
        gapSeconds,
      });
    } else if (delta < 0n) {
      regressions.push({
        earlierSnapshotId: from.snapshotId,
        laterSnapshotId: to.snapshotId,
        fromHeight: from.height,
        toHeight: to.height,
        gapSeconds,
      });
    }
  }

  const estimates = intervals
    .map((interval) => interval.secondsPerBlock)
    .filter((v): v is number => v !== null);

  return {
    method,
    points,
    totalDelta:
      points.length >= 2
        ? (BigInt(points[points.length - 1].height) - BigInt(points[0].height)).toString()
        : null,
    intervals,
    medianSecondsPerBlock: median(estimates),
    stalls,
    regressions,
  };
}

function evaluateVerdict(args: {
  totalChecks: number;
  failureCounts: { outcome: HealthCheckOutcome; count: number }[];
  progression: BlockProgression;
  methodTrends: MethodLatencyTrend[];
  pointTimes: Map<string, number>;
}): SessionVerdict {
  const { totalChecks, failureCounts, progression, methodTrends, pointTimes } = args;
  const failedTotal = failureCounts.reduce((sum, f) => sum + f.count, 0);
  const hasBlockPoints = progression.points.length >= 2;

  const rules: VerdictRuleResult[] = [];

  // Rule 1 — real failures.
  rules.push({
    ruleId: 'verdict.no-real-failures',
    description:
      'Unstable if any check in the session ended in a real failure (RPC, network, HTTP, or invalid response). Unsupported methods (-32601) do not count as failures.',
    effect: 'unstable',
    evaluated: true,
    fired: failedTotal > 0,
    evidence:
      failedTotal > 0
        ? `${failedTotal} of ${totalChecks} checks failed (${failureCounts
            .map((f) => `${f.outcome} ×${f.count}`)
            .join(', ')})`
        : `0 real failures across ${totalChecks} checks`,
  });

  // Rule 2 — block stall at or beyond the gap threshold.
  const firingStalls = progression.stalls.filter((s) => s.gapSeconds >= STALL_RULE_MIN_GAP_SECONDS);
  const quietStalls = progression.stalls.filter((s) => s.gapSeconds < STALL_RULE_MIN_GAP_SECONDS);
  rules.push({
    ruleId: 'verdict.no-block-stall',
    description: `Degraded if the block height stays identical across a gap of ${STALL_RULE_MIN_GAP_SECONDS} s or more between consecutive checks (≈5 blocks at the observed ~6 s cadence). Shorter stalls are recorded as findings but do not fire this rule.`,
    effect: 'degraded',
    evaluated: hasBlockPoints,
    fired: firingStalls.length > 0,
    evidence: !hasBlockPoints
      ? 'Not evaluated — fewer than 2 usable block heights in this session'
      : firingStalls.length > 0
        ? firingStalls
            .map(
              (s) =>
                `Block height unchanged at ${s.height} across a ${formatMs(s.gapSeconds)} s gap (${formatClock(
                  pointTimes.get(s.earlierSnapshotId) ?? 0
                )} → ${formatClock(pointTimes.get(s.laterSnapshotId) ?? 0)})`
            )
            .join('; ')
        : quietStalls.length > 0
          ? `${quietStalls.length} stall(s) below the firing threshold (longest gap ${formatMs(
              Math.max(...quietStalls.map((s) => s.gapSeconds))
            )} s)`
          : `Block height advanced in all ${progression.intervals.length} interval(s)`,
  });

  // Rule 3 — block regression.
  rules.push({
    ruleId: 'verdict.no-block-regression',
    description:
      'Degraded if the block height ever decreases between consecutive checks on the same endpoint.',
    effect: 'degraded',
    evaluated: hasBlockPoints,
    fired: progression.regressions.length > 0,
    evidence: !hasBlockPoints
      ? 'Not evaluated — fewer than 2 usable block heights in this session'
      : progression.regressions.length > 0
        ? progression.regressions
            .map(
              (r) =>
                `Block height decreased ${r.fromHeight} → ${r.toHeight} between consecutive checks (${formatClock(
                  pointTimes.get(r.earlierSnapshotId) ?? 0
                )} → ${formatClock(pointTimes.get(r.laterSnapshotId) ?? 0)})`
            )
            .join('; ')
        : 'Block height never decreased between consecutive checks',
  });

  // Rule 4 — latency drift (medians of halves; both thresholds must be met).
  const drifting = methodTrends.filter(
    (t) =>
      t.samples >= DRIFT_MIN_SAMPLES &&
      t.medianFirstHalfMs !== null &&
      t.medianSecondHalfMs !== null &&
      t.medianSecondHalfMs > t.medianFirstHalfMs * DRIFT_RATIO &&
      t.medianSecondHalfMs - t.medianFirstHalfMs >= DRIFT_MIN_RISE_MS
  );
  const anyEvaluated = methodTrends.some((t) => t.samples >= DRIFT_MIN_SAMPLES);
  const maxSamples = methodTrends.reduce((max, t) => Math.max(max, t.samples), 0);
  rules.push({
    ruleId: 'verdict.no-latency-drift',
    description: `Degraded if any method's median latency in the second half of the session is more than ${DRIFT_RATIO}× its first-half median and at least ${DRIFT_MIN_RISE_MS} ms higher. Needs at least ${DRIFT_MIN_SAMPLES} samples per method.`,
    effect: 'degraded',
    evaluated: anyEvaluated,
    fired: drifting.length > 0,
    evidence: drifting.length > 0
      ? drifting
          .map(
            (t) =>
              `median ${t.method} latency rose ${formatMs(t.medianFirstHalfMs ?? 0)} ms → ${formatMs(
                t.medianSecondHalfMs ?? 0
              )} ms across ${t.samples} checks`
          )
          .join('; ')
      : anyEvaluated
        ? "No method's median latency rose beyond both thresholds"
        : `Not evaluated — methods have at most ${maxSamples} latency sample(s) (needs ${DRIFT_MIN_SAMPLES})`,
  });

  const level: VerdictLevel = rules.some((r) => r.fired && r.effect === 'unstable')
    ? 'unstable'
    : rules.some((r) => r.fired && r.effect === 'degraded')
      ? 'degraded'
      : 'healthy';

  return { level, reason: null, rules };
}

/**
 * Compute deterministic trends and a verdict over a session of health snapshots.
 *
 * Only snapshots sharing the newest snapshot's endpoint origin + profile are
 * analyzed; the rest are reported as excluded. See the module header for the
 * full design rules.
 */
export function computeSessionTrends(snapshots: HealthCheckSnapshot[]): SessionTrends {
  // Chronological copy — timestamp asc, id asc as a stable tiebreak. Input untouched.
  const chronological = [...snapshots].sort((a, b) =>
    a.timestamp !== b.timestamp ? a.timestamp - b.timestamp : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );

  if (chronological.length === 0) {
    return insufficient('No health checks recorded in this session yet.', {
      totalSnapshotCount: 0,
      snapshotCount: 0,
      excludedSnapshotCount: 0,
      endpointOrigin: null,
      endpointProfile: null,
      snapshotIds: [],
      firstTimestamp: null,
      lastTimestamp: null,
    });
  }

  const newest = chronological[chronological.length - 1];
  const group = chronological.filter(
    (s) => s.endpointOrigin === newest.endpointOrigin && s.endpointProfile === newest.endpointProfile
  );
  const scope = {
    totalSnapshotCount: chronological.length,
    snapshotCount: group.length,
    excludedSnapshotCount: chronological.length - group.length,
    endpointOrigin: newest.endpointOrigin,
    endpointProfile: newest.endpointProfile,
    snapshotIds: group.map((s) => s.id),
    firstTimestamp: group[0].timestamp,
    lastTimestamp: group[group.length - 1].timestamp,
  };

  if (group.length < 2) {
    return insufficient(
      'Only 1 health check recorded for this endpoint — run at least 2 health checks to compute trends and a verdict.',
      scope
    );
  }

  const totalChecks = group.reduce((sum, s) => sum + s.checks.length, 0);
  if (totalChecks === 0) {
    return insufficient('The recorded snapshots contain no checks — nothing to trend.', scope);
  }

  const methodTrends = computeLatencyTrends(group);
  const progression = computeBlockProgression(group, newest.endpointProfile);

  const passed = group.reduce((sum, s) => sum + s.checks.filter((c) => c.success).length, 0);
  const failureCounts = REAL_FAILURE_ORDER.map((outcome) => ({
    outcome,
    count: group.reduce(
      (sum, s) => sum + s.checks.filter((c) => c.outcome === outcome && isRealFailure(c.outcome)).length,
      0
    ),
  })).filter((f) => f.count > 0);

  const pointTimes = new Map(progression.points.map((p) => [p.snapshotId, p.timestamp]));
  const verdict = evaluateVerdict({
    totalChecks,
    failureCounts,
    progression,
    methodTrends,
    pointTimes,
  });

  return {
    status: 'available',
    reason: null,
    ...scope,
    methods: methodTrends,
    blockProgression: progression,
    passRate: { passed, total: totalChecks, ratio: totalChecks > 0 ? passed / totalChecks : null },
    failureCounts,
    verdict,
  };
}
