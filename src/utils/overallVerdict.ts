import { extractEvmSide } from './combinedVerdict';
import type { HealthCheckSnapshot } from '../types/healthCheck';
import type { SubstrateWsProbeResult } from '../services/substrateWsProbe';

/**
 * One-word overall verdict for the sticky bar. It shares the EVM-side
 * extraction with panel 07 and adds one rule panel 07 does not state:
 * with no data at all, the verdict is NOT CHECKED, never DOWN.
 *
 * - not_checked: no health snapshot and no probe result yet. The node has
 *   not been checked, so claiming DOWN would be inventing a failure.
 * - healthy: the EVM snapshot passed every check and the probe answered.
 * - down: neither transport produced a single successful response.
 * - degraded: anything in between (one transport only, or some checks failed).
 */
export type OverallVerdict = 'healthy' | 'degraded' | 'down' | 'not_checked';

export function overallVerdictFrom(
  snapshot: HealthCheckSnapshot | null,
  wsProbe: SubstrateWsProbeResult | null,
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
    return 'healthy';
  }
  const anySuccess = (evm !== null && evm.checksPassed > 0) || wsOk;
  return anySuccess ? 'degraded' : 'down';
}
