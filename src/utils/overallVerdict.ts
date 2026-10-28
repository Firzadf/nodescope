import { extractEvmSide } from './combinedVerdict';
import type { HealthCheckSnapshot } from '../types/healthCheck';
import type { SubstrateWsProbeResult } from '../services/substrateWsProbe';
import type { HealthScoreBand } from './healthScore';
import type { StallState } from './stall';

/**
 * One-word overall verdict for the sticky bar. It shares the EVM-side
 * extraction with panel 07 and adds one rule panel 07 does not state:
 * with no data at all, the verdict is NOT CHECKED, never DOWN.
 *
 * Order, first match wins:
 * - not_checked: no health snapshot and no probe result yet.
 * - down: neither transport produced a single successful response.
 *   DOWN stays reserved for "no transport answered at all".
 * - stalled: a transport answered AND the stall assessment is `stalled`
 *   (best head and/or finalized head has not advanced past the threshold).
 *   This is "chain paused but RPC answers". It outranks a low Health
 *   Score: the word operators need is STALLED, not a generic DEGRADED.
 *   A stall never produces DOWN.
 * - healthy: every EVM check passed, the probe answered, and the Health
 *   Score band is healthy or not yet scored.
 * - degraded: anything in between, including a score band below healthy.
 *   The score can pull HEALTHY down to DEGRADED. It never produces DOWN
 *   or STALLED by itself.
 */
export type OverallVerdict = 'healthy' | 'degraded' | 'stalled' | 'down' | 'not_checked';

export function overallVerdictFrom(
  snapshot: HealthCheckSnapshot | null,
  wsProbe: SubstrateWsProbeResult | null,
  scoreBand: HealthScoreBand | null = null,
  stall: StallState | null = null,
): OverallVerdict {
  if (!snapshot && !wsProbe) return 'not_checked';
  const evm = extractEvmSide(snapshot);
  const wsOk = wsProbe !== null && wsProbe.status === 'ok';
  const anySuccess = (evm !== null && evm.checksPassed > 0) || wsOk;
  if (!anySuccess) return 'down';
  if (stall === 'stalled') return 'stalled';
  if (
    evm !== null &&
    evm.checksTotal > 0 &&
    evm.checksPassed === evm.checksTotal &&
    wsOk
  ) {
    return scoreBand === null || scoreBand === 'healthy' ? 'healthy' : 'degraded';
  }
  return 'degraded';
}
