import { extractEvmSide } from './combinedVerdict';
import type { HealthCheckSnapshot } from '../types/healthCheck';
import type { SubstrateWsProbeResult } from '../services/substrateWsProbe';
import type { HealthScoreBand } from './healthScore';

/**
 * One-word overall verdict for the sticky bar. It shares the EVM-side
 * extraction with panel 07 and adds one rule panel 07 does not state:
 * with no data at all, the verdict is NOT CHECKED, never DOWN.
 *
 * - not_checked: no health snapshot and no probe result yet. The node has
 *   not been checked, so claiming DOWN would be inventing a failure.
 * - healthy: the EVM snapshot passed every check and the probe answered.
 * - down: neither transport produced a single successful response.
 * - degraded: anything in between (one transport only, or some checks failed),
 *   or every check answered but the Health Score band is below healthy
 *   (e.g. the head stalled). Answering is not the same as working, so the
 *   score can pull HEALTHY down to DEGRADED. It never produces DOWN: DOWN
 *   stays reserved for "no transport answered at all".
 */
export type OverallVerdict = 'healthy' | 'degraded' | 'down' | 'not_checked';

export function overallVerdictFrom(
  snapshot: HealthCheckSnapshot | null,
  wsProbe: SubstrateWsProbeResult | null,
  scoreBand: HealthScoreBand | null = null,
): OverallVerdict {
  if (!snapshot && !wsProbe) return 'not_checked';
  const evm = extractEvmSide(snapshot);
  const wsOk = wsProbe !== null && wsProbe.status === 'ok';
  if (
    evm !== null &&
    evm.checksTotal > 0 &&
    evm.checksPassed === evm.checksTotal &&
    wsOk
  ) {
    return scoreBand === null || scoreBand === 'healthy' ? 'healthy' : 'degraded';
  }
  const anySuccess = (evm !== null && evm.checksPassed > 0) || wsOk;
  return anySuccess ? 'degraded' : 'down';
}
