/**
 * Fee Lab report export.
 *
 * A Fee Lab comparison is exported as a genuine `nodescope.diagnostic-report.v1`
 * report — the SAME schema Health reports use, not a second schema. The two
 * measured legs become diagnostic records (one per surface, ok or failed),
 * and the full comparison rides additively as `feeComparison`, exactly the
 * way `substrateWsProbe` and `sessionTrends` ride additively on Health
 * reports. Nothing here invents a schema: the builder and the SHA-256
 * canonicalization are the ones Health reports already use, so:
 *
 * - the export verifies on /verify (change one value, the stamp breaks),
 * - the export's `integrity.hash` is what gets anchored to the registry,
 *   the same registry Health reports anchor to (one registry, both pillars),
 * - `anchor-report.sh` reads `integrity.hash` from any report JSON, so a
 *   fee report anchors with the same command as a Health report.
 *
 * Honesty notes, deliberate:
 * - `latencyMs` is null: the comparison does not time each leg separately,
 *   and the report never claims a latency it did not measure.
 * - An unavailable leg still becomes a record (outcome + error), so the
 *   report shows exactly what was measured, including the failure.
 * - Bigints are stored as decimal strings in `feeComparison` (JSON-safe),
 *   the same conversion `serializeComparison` already performs.
 */
import {
  REPORT_SCHEMA_VERSION,
  type DiagnosticReportEntry,
  type DiagnosticReportExport,
} from './reportBuilder';
import { DEFAULT_NETWORK } from '../services/feeLab/constants';
import {
  serializeComparison,
  type Comparison,
  type EvmLeg,
  type NativeLeg,
} from '../services/feeLab/compare';

export type FeeReportExport = DiagnosticReportExport & {
  /** JSON-safe comparison (bigints as decimal strings). Covered by the integrity stamp. */
  feeComparison: unknown;
  /** Panel operation that was priced: transfer | erc20 | deploy | calldata. */
  feeOperation: string;
};

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return 'invalid-url';
  }
}

function classifyLegError(reason: string): {
  outcome: 'network_or_http_error' | 'invalid_response';
  metricStatus: 'network_error' | 'invalid_response';
} {
  if (/timeout|timed out|network|fetch|econnrefused|econnreset|econnaborted|socket hang up/i.test(reason)) {
    return { outcome: 'network_or_http_error', metricStatus: 'network_error' };
  }
  return { outcome: 'invalid_response', metricStatus: 'invalid_response' };
}

function legRecord(
  leg: EvmLeg | NativeLeg,
  surface: 'evm' | 'native',
  endpointOrigin: string,
  measuredAt: string,
): DiagnosticReportEntry {
  if (leg.status === 'ok') {
    return {
      id: surface,
      requestMethod: leg.method,
      timestamp: measuredAt,
      endpointOrigin,
      outcome: 'success',
      latencyMs: null,
      metricStatus: 'success',
      metricResult: leg.totalPlanck.toString(),
      evidenceLabel: 'generic_endpoint_tested',
      dataOrigin: 'real_request',
      error: null,
    };
  }
  const classified = classifyLegError(leg.reason);
  return {
    id: surface,
    requestMethod: leg.method,
    timestamp: measuredAt,
    endpointOrigin,
    outcome: classified.outcome,
    latencyMs: null,
    metricStatus: classified.metricStatus,
    metricResult: null,
    evidenceLabel: 'generic_endpoint_tested',
    dataOrigin: 'real_request',
    error: leg.reason,
  };
}

/**
 * Build the fee report for a comparison. Unstamped: callers stamp it with
 * `stampReportIntegrity`, exactly like the Health export flow, so the stamp
 * covers records AND the additive `feeComparison` block.
 */
export function buildFeeReport(
  comparison: Comparison,
  feeOperation: string,
  network: { evmRpc: string; substrateWss: string } = DEFAULT_NETWORK,
): FeeReportExport {
  const measuredAt = comparison.measuredAt;
  const records = [
    legRecord(comparison.evm, 'evm', originOf(network.evmRpc), measuredAt),
    legRecord(comparison.native, 'native', originOf(network.substrateWss), measuredAt),
  ];
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    exportedAt: measuredAt,
    recordCount: records.length,
    records,
    feeComparison: JSON.parse(serializeComparison(comparison)),
    feeOperation,
  };
}
