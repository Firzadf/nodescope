import type { HealthCheckSnapshot } from '../types/healthCheck';
import type { SubstrateWsProbeResult } from '../services/substrateWsProbe';
import { computeHealthScoreV2 } from './healthScore';
import { alertKindForCycle, type TransitionKind } from './alertWebhook';
import type { ChainMotion } from './stall';
import { parseBlockHeight } from './snapshotComparer';
import { HEAD_SAMPLE_STALL_SECONDS } from '../../shared/liveStatus.mjs';
import type { OverallVerdict } from './overallVerdict';

/**
 * One point on the session score chart. Built only from health snapshots
 * the user already ran, plus the latest Substrate probe when one exists.
 * Finality lag is attached to the newest point only: older checks did not
 * record a finalized head, and inventing one would be a fake history.
 */
export interface ScoreHistoryPoint {
  at: number;
  score: number | null;
  coverage: number;
  verdict: OverallVerdict;
  bestHeight: string | null;
  finalityLag: number | null;
  stall: boolean;
  transition: TransitionKind | null;
}

function heightOf(snapshot: HealthCheckSnapshot): string | null {
  const check = snapshot.checks.find((c) => c.method === 'eth_blockNumber' && c.success);
  const h = check ? parseBlockHeight(check.observedValue) : null;
  return h === null ? null : h.toString();
}

function verdictFor(scoreBand: 'healthy' | 'degraded' | 'critical' | null, stall: boolean, anySuccess: boolean): OverallVerdict {
  if (!anySuccess) return 'down';
  if (stall) return 'stalled';
  if (scoreBand === 'healthy') return 'healthy';
  return 'degraded';
}

/** Chronological score, head, stall, and degrade/recover marks for one endpoint. */
export function buildScoreHistory(
  snapshots: HealthCheckSnapshot[],
  wsProbe: SubstrateWsProbeResult | null = null,
  motion: ChainMotion | null = null,
): ScoreHistoryPoint[] {
  if (snapshots.length === 0) return [];
  const newest = snapshots.reduce((a, b) => (a.timestamp >= b.timestamp ? a : b));
  const ordered = snapshots
    .filter((s) => s.endpointOrigin === newest.endpointOrigin && s.endpointProfile === newest.endpointProfile)
    .sort((a, b) => a.timestamp - b.timestamp);
  const points: ScoreHistoryPoint[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const slice = ordered.slice(0, i + 1);
    const last = i === ordered.length - 1;
    const score = computeHealthScoreV2({
      snapshots: slice,
      wsProbe: last ? wsProbe : null,
      motion: last ? motion : null,
    });
    const current = ordered[i];
    const prev = i > 0 ? ordered[i - 1] : null;
    const height = heightOf(current);
    const prevHeight = prev ? heightOf(prev) : null;
    const gapSeconds = prev ? Math.round((current.timestamp - prev.timestamp) / 1000) : 0;
    const sampleStall = prevHeight !== null && height !== null && prevHeight === height && gapSeconds >= HEAD_SAMPLE_STALL_SECONDS;
    const ageStall = last && motion?.bestTimestampSec != null && motion.observedAtMs != null
      && Math.round(motion.observedAtMs / 1000 - motion.bestTimestampSec) >= 90;
    const stall = sampleStall || ageStall;
    const anySuccess = current.checks.some((c) => c.success) || (last && wsProbe?.status === 'ok');
    const verdict = verdictFor(score.band, stall, !!anySuccess);
    const previousVerdict = points[i - 1]?.verdict ?? null;
    const previousStall = points[i - 1] ? (points[i - 1].stall ? 'stalled' : 'live') : null;
    const transition = i === 0 ? null : alertKindForCycle(previousVerdict, verdict, previousStall, stall ? 'stalled' : 'live');
    const lag = last && typeof wsProbe?.finalityLagBlocks === 'number' ? wsProbe.finalityLagBlocks : null;
    points.push({
      at: current.timestamp,
      score: score.score,
      coverage: score.coverage,
      verdict,
      bestHeight: height,
      finalityLag: lag,
      stall,
      transition,
    });
  }
  return points;
}
