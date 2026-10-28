import type { HealthCheckSnapshot } from '../types/healthCheck';
import type { SubstrateWsProbeResult } from '../services/substrateWsProbe';
import { isRealFailure, parseBlockHeight } from './snapshotComparer';
import { PORTALDOT_CHAIN_ID } from './siteConstants';

/**
 * Health Score 0–100 — a PUBLISHED formula, not a black box.
 *
 * The score is a weighted sum of five components, every one of them read
 * from data NodeScope already measures (no new probes, no polling):
 *
 *   id                 weight  input                                   points
 *   availability         30    latest EVM snapshot, checks that ran    30 × passed ÷ eligible
 *                              (unsupported_method / -32601 is NOT a
 *                              failure and is left out of "eligible")
 *   chain_identity       15    eth_chainId in the latest snapshot      15 if 420420777, else 0
 *   head_progression     20    eth_blockNumber in the two newest       20 advanced · 10 same height
 *                              snapshots of the SAME endpoint +           < 30 s apart (inconclusive)
 *                              profile                                  · 0 stalled ≥ 30 s or regressed
 *   latency              20    median latency of the successful        20 at ≤ 300 ms, 0 at ≥ 2000 ms,
 *                              checks in the latest snapshot              linear in between
 *   transport_parity     15    latest Substrate WSS probe              10 answered + 5 when not syncing
 *                                                                         and peers > 0 (or none expected)
 *
 * A component with no data is `measured: false` and contributes nothing
 * to EITHER side: the score is renormalized over the measured weight,
 *   score = round(100 × Σ points ÷ Σ measured weight),
 * and `coverage` (= Σ measured weight, 0–100) is always printed next to
 * it. Missing data is never scored as 0 and never as full marks. Below
 * 50% coverage the score is `null` ("not scored"): a number built from
 * less than half the formula would overstate what was measured.
 *
 * Bands: 90–100 healthy · 70–89 degraded · 0–69 critical.
 *
 * This is additive to the deterministic rule-based verdict (Trends &
 * Verdict), which stays rule-based and unscored. The score summarizes;
 * the verdict explains.
 */

export const HEALTH_SCORE_FORMULA = 'nodescope.health-score.v1';

export type HealthScoreComponentId =
  | 'availability'
  | 'chain_identity'
  | 'head_progression'
  | 'latency'
  | 'transport_parity';

export const HEALTH_SCORE_WEIGHTS: Record<HealthScoreComponentId, number> = {
  availability: 30,
  chain_identity: 15,
  head_progression: 20,
  latency: 20,
  transport_parity: 15,
};

export const LATENCY_FULL_MARKS_MS = 300;
export const LATENCY_ZERO_MS = 2000;
export const HEAD_STALL_MIN_GAP_SECONDS = 30;
export const MIN_COVERAGE_TO_SCORE = 50;

export const HEALTH_SCORE_LABELS: Record<HealthScoreComponentId, string> = {
  availability: 'RPC availability',
  chain_identity: 'Chain identity',
  head_progression: 'Head progression',
  latency: 'Latency',
  transport_parity: 'Transport parity (WSS)',
};

export type HealthScoreBand = 'healthy' | 'degraded' | 'critical';

export interface HealthScoreComponent {
  id: HealthScoreComponentId;
  label: string;
  weight: number;
  measured: boolean;
  /** null when not measured. Always 0 ≤ points ≤ weight. */
  points: number | null;
  /** Plain-language reason with the actual input values. */
  detail: string;
}

export interface HealthScore {
  formula: typeof HEALTH_SCORE_FORMULA;
  /** 0–100, or null when coverage is below MIN_COVERAGE_TO_SCORE. */
  score: number | null;
  band: HealthScoreBand | null;
  /** Σ measured weight, 0–100. */
  coverage: number;
  components: HealthScoreComponent[];
}

export interface HealthScoreInput {
  /** All session snapshots, any order. The newest one is "latest". */
  snapshots: HealthCheckSnapshot[];
  wsProbe: SubstrateWsProbeResult | null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function bandFor(score: number): HealthScoreBand {
  if (score >= 90) return 'healthy';
  if (score >= 70) return 'degraded';
  return 'critical';
}

export function latencyPoints(medianMs: number, weight = HEALTH_SCORE_WEIGHTS.latency): number {
  if (medianMs <= LATENCY_FULL_MARKS_MS) return weight;
  if (medianMs >= LATENCY_ZERO_MS) return 0;
  const frac = (LATENCY_ZERO_MS - medianMs) / (LATENCY_ZERO_MS - LATENCY_FULL_MARKS_MS);
  return round1(weight * frac);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function newestFirst(snapshots: HealthCheckSnapshot[]): HealthCheckSnapshot[] {
  return [...snapshots].sort((a, b) => b.timestamp - a.timestamp);
}

function availability(latest: HealthCheckSnapshot | null): HealthScoreComponent {
  const weight = HEALTH_SCORE_WEIGHTS.availability;
  const base = { id: 'availability' as const, label: HEALTH_SCORE_LABELS.availability, weight };
  if (!latest) return { ...base, measured: false, points: null, detail: 'No health snapshot yet.' };
  const eligible = latest.checks.filter((c) => c.success || isRealFailure(c.outcome));
  if (eligible.length === 0) {
    return { ...base, measured: false, points: null, detail: 'Latest snapshot has no eligible check (all unsupported).' };
  }
  const passed = eligible.filter((c) => c.success).length;
  return {
    ...base,
    measured: true,
    points: round1((weight * passed) / eligible.length),
    detail: `${passed}/${eligible.length} checks answered in the latest snapshot.`,
  };
}

function chainIdentity(latest: HealthCheckSnapshot | null): HealthScoreComponent {
  const weight = HEALTH_SCORE_WEIGHTS.chain_identity;
  const base = { id: 'chain_identity' as const, label: HEALTH_SCORE_LABELS.chain_identity, weight };
  const check = latest?.checks.find((c) => c.method === 'eth_chainId');
  if (!latest || !check) return { ...base, measured: false, points: null, detail: 'eth_chainId not checked yet.' };
  if (!check.success) {
    return { ...base, measured: true, points: 0, detail: `eth_chainId failed (${check.outcome}).` };
  }
  const id = parseBlockHeight(check.observedValue);
  const ok = id !== null && id === BigInt(PORTALDOT_CHAIN_ID);
  return {
    ...base,
    measured: true,
    points: ok ? weight : 0,
    detail: ok
      ? `eth_chainId = ${PORTALDOT_CHAIN_ID}, as documented.`
      : `eth_chainId = ${id !== null ? id.toString() : String(check.observedValue)}, expected ${PORTALDOT_CHAIN_ID}.`,
  };
}

function headProgression(snapshots: HealthCheckSnapshot[]): HealthScoreComponent {
  const weight = HEALTH_SCORE_WEIGHTS.head_progression;
  const base = { id: 'head_progression' as const, label: HEALTH_SCORE_LABELS.head_progression, weight };
  const sorted = newestFirst(snapshots);
  const latest = sorted[0];
  if (!latest) return { ...base, measured: false, points: null, detail: 'Needs two health snapshots.' };
  const sameEndpoint = sorted.filter(
    (s) => s.endpointOrigin === latest.endpointOrigin && s.endpointProfile === latest.endpointProfile,
  );
  const withHeight = sameEndpoint
    .map((s) => {
      const c = s.checks.find((k) => k.method === 'eth_blockNumber' && k.success);
      return { s, h: c ? parseBlockHeight(c.observedValue) : null };
    })
    .filter((x): x is { s: HealthCheckSnapshot; h: bigint } => x.h !== null);
  if (withHeight.length < 2) {
    return { ...base, measured: false, points: null, detail: 'Needs two snapshots with a block height on the same endpoint.' };
  }
  const [newer, older] = withHeight;
  const delta = newer.h - older.h;
  const gapSeconds = Math.round((newer.s.timestamp - older.s.timestamp) / 1000);
  if (delta > 0n) {
    return { ...base, measured: true, points: weight, detail: `Head advanced +${delta.toString()} blocks in ${gapSeconds} s.` };
  }
  if (delta < 0n) {
    return { ...base, measured: true, points: 0, detail: `Head regressed ${delta.toString()} blocks in ${gapSeconds} s.` };
  }
  if (gapSeconds >= HEAD_STALL_MIN_GAP_SECONDS) {
    return { ...base, measured: true, points: 0, detail: `Head stalled at ${newer.h.toString()} for ${gapSeconds} s.` };
  }
  return {
    ...base,
    measured: true,
    points: weight / 2,
    detail: `Same height ${newer.h.toString()} but only ${gapSeconds} s apart (inconclusive).`,
  };
}

function latency(latest: HealthCheckSnapshot | null): HealthScoreComponent {
  const weight = HEALTH_SCORE_WEIGHTS.latency;
  const base = { id: 'latency' as const, label: HEALTH_SCORE_LABELS.latency, weight };
  const samples = (latest?.checks ?? [])
    .filter((c) => c.success && typeof c.latencyMs === 'number' && Number.isFinite(c.latencyMs))
    .map((c) => c.latencyMs as number);
  const med = median(samples);
  if (med === null) return { ...base, measured: false, points: null, detail: 'No successful check with a latency yet.' };
  return {
    ...base,
    measured: true,
    points: latencyPoints(med, weight),
    detail: `Median ${Math.round(med)} ms over ${samples.length} checks (full marks ≤ ${LATENCY_FULL_MARKS_MS} ms, zero ≥ ${LATENCY_ZERO_MS} ms).`,
  };
}

function transportParity(ws: SubstrateWsProbeResult | null): HealthScoreComponent {
  const weight = HEALTH_SCORE_WEIGHTS.transport_parity;
  const base = { id: 'transport_parity' as const, label: HEALTH_SCORE_LABELS.transport_parity, weight };
  if (!ws) return { ...base, measured: false, points: null, detail: 'Substrate WSS not probed yet.' };
  if (ws.status !== 'ok') {
    return { ...base, measured: true, points: 0, detail: `WSS probe failed (${ws.error ?? 'unknown error'}).` };
  }
  const peersOk = (ws.peers !== null && ws.peers > 0) || ws.shouldHavePeers === false;
  const syncOk = ws.isSyncing === false;
  const bonus = peersOk && syncOk ? 5 : 0;
  return {
    ...base,
    measured: true,
    points: 10 + bonus,
    detail: `WSS answered${ws.chain ? ` (${ws.chain})` : ''}; syncing ${ws.isSyncing === null ? 'unknown' : ws.isSyncing ? 'yes' : 'no'}, peers ${ws.peers ?? 'unknown'}.`,
  };
}

/** Pure, deterministic: depends only on its inputs, never on array order. */
export function computeHealthScore(input: HealthScoreInput): HealthScore {
  const latest = newestFirst(input.snapshots)[0] ?? null;
  const components = [
    availability(latest),
    chainIdentity(latest),
    headProgression(input.snapshots),
    latency(latest),
    transportParity(input.wsProbe),
  ];
  const coverage = components.filter((c) => c.measured).reduce((a, c) => a + c.weight, 0);
  const earned = components.reduce((a, c) => a + (c.points ?? 0), 0);
  const score = coverage >= MIN_COVERAGE_TO_SCORE ? Math.round((100 * earned) / coverage) : null;
  return {
    formula: HEALTH_SCORE_FORMULA,
    score,
    band: score === null ? null : bandFor(score),
    coverage,
    components,
  };
}

/** Short "where the points went" note, e.g. "−20 head progression, −5 latency". */
export function lostPointsNote(score: HealthScore): string {
  return score.components
    .filter((c) => c.measured && c.points !== null && c.points < c.weight)
    .map((c) => `−${c.weight - (c.points ?? 0)} ${c.label.toLowerCase()}`)
    .join(', ');
}
