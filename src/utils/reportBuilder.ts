import type { DiagnosticHistoryItem } from '../types/rpc';
import type { MetricStatus } from '../types/node';
import type { Finding } from '../types/diagnostic';
import type { HealthCheckSnapshot } from '../types/healthCheck';
import type { SubstrateWsProbeResult } from '../services/substrateWsProbe';
import {
  parseLatency,
  parseClientVersion,
  parsePeerCount,
  parseBlockHeight,
} from './metricParsers';
import { BLOCK_INTERVAL_NOTE, computeSessionTrends, type SessionTrends } from './sessionTrends';
import { computeHealthScoreV2, type HealthScore } from './healthScore';
import type { ChainMotion, StallAssessment } from './stall';
import type { ReliabilityReport } from '../services/reliabilityProbe';
import type { UnitsSanity } from './unitsSanity';
import { operatorFindings } from './operatorFindings';
import { buildScoreHistory, type ScoreHistoryPoint } from './scoreHistory';
import { assessEndpointParity } from '../../shared/endpointParity.mjs';
import { planOperatorActions, type OperatorActionPlan } from '../../shared/operatorActions.mjs';

export const REPORT_SCHEMA_VERSION = 'nodescope.diagnostic-report.v1';

export type EvidenceLabel =
  | 'demo_mock'
  | 'generic_endpoint_tested'
  | 'portaldot_local_node_verified'
  | 'portaldot_v3_testnet_verified';

export type DiagnosticOutcome = 'success' | 'rpc_error' | 'network_or_http_error' | 'invalid_response';

export interface DiagnosticReportEntry {
  id: string;
  requestMethod: string;
  timestamp: string;
  endpointOrigin: string;
  outcome: DiagnosticOutcome;
  latencyMs: number | null;
  metricStatus: MetricStatus;
  metricResult: string | number | boolean | null;
  evidenceLabel: EvidenceLabel;
  dataOrigin: 'real_request';
  error: string | null;
  findings?: Finding[];
}

/**
 * Optional Phase 2.5 block: the session's deterministic trends and verdict,
 * attached additively. The report schema stays v1 — v1 consumers ignore this
 * field, and it is omitted entirely when no trend could honestly be computed.
 */
export interface SessionTrendsExport extends SessionTrends {
  blockIntervalNote: string;
}

/**
 * Optional integrity stamp (stage 2): a SHA-256 hash over the canonical form
 * of the report, computed at export time by `stampReportIntegrity` in
 * reportIntegrity.ts. Additive — the schema stays v1 and v1 consumers ignore
 * this field. The hash covers everything in the report except this block.
 */
export interface ReportIntegrity {
  algorithm: 'SHA-256';
  /** Lowercase hex, 64 characters. */
  hash: string;
  /** Human-readable statement of exactly what the hash covers. */
  scope: string;
}

export interface DiagnosticReportExport {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  exportedAt: string;
  recordCount: number;
  records: DiagnosticReportEntry[];
  findings?: Finding[];
  sessionTrends?: SessionTrendsExport;
  /**
   * Optional Substrate probe result, attached additively before the
   * integrity stamp, so one export can carry both transports. The probe
   * result is stored as observed, with its own URL and timestamps, and
   * is never merged into an EVM record.
   */
  substrateWsProbe?: SubstrateWsProbeResult;
  /**
   * Optional Health Score block. New exports use
   * nodescope.health-score.v2. Reports that already carry v1, including
   * the anchored evidence files, are unchanged and still verify.
   */
  healthScore?: HealthScoreExport;
  /**
   * Optional operator signals (stall, finality inputs already on the
   * probe, reliability, units). Additive. Omitted when none were run.
   */
  operatorSignals?: OperatorSignalsExport;
  /**
   * Optional session score chart. Omitted when fewer than two checks
   * exist. Older reports, including the anchored evidence files, do not
   * have this field and still verify.
   */
  scoreHistory?: { schema: 'nodescope.score-history.v1'; points: ScoreHistoryPoint[] };
  /**
   * Optional next step for the operator who exported the file. Additive.
   * The canonical healthScore block is unchanged. Older reports, including
   * the anchored evidence, do not have this field and still verify.
   */
  operatorActions?: OperatorActionPlan;
  integrity?: ReportIntegrity;
}

export interface OperatorSignalsExport {
  schema: 'nodescope.operator-signals.v1';
  stall: StallAssessment | null;
  reliability: ReliabilityReport | null;
  units: UnitsSanity | null;
  findings: ReturnType<typeof operatorFindings>;
}

export interface HealthScoreExport extends HealthScore {
  /** Published formula location, so a reader can recompute every point. */
  methodology: string;
}

export const HEALTH_SCORE_METHODOLOGY_URL = '/docs#health-score';

export function sanitizeEndpointOrigin(endpoint: string): string {
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'invalid-url';
    }
    return parsed.origin;
  } catch {
    return 'invalid-url';
  }
}

function classifyOutcome(item: DiagnosticHistoryItem): DiagnosticOutcome {
  if (item.success) {
    return 'success';
  }

  if (item.response?.error) {
    return 'rpc_error';
  }

  const err = item.error || '';
  if (
    err.includes('HTTP Error') ||
    err.includes('Network') ||
    err.includes('CORS') ||
    err.includes('Failed to fetch') ||
    err.includes('timeout')
  ) {
    return 'network_or_http_error';
  }

  return 'invalid_response';
}

function metricFromRecord(item: DiagnosticHistoryItem): { status: MetricStatus; result: string | number | boolean | null } {
  switch (item.request.method) {
    case 'system_version': {
      const parsed = parseClientVersion(item);
      return { status: parsed.status, result: parsed.value };
    }
    case 'system_health': {
      const peerCount = parsePeerCount(item);
      if (peerCount.status === 'success') {
        return { status: peerCount.status, result: peerCount.value };
      }
      const latency = parseLatency(item);
      return { status: latency.status, result: latency.value };
    }
    case 'chain_getHeader':
    case 'chain_getBlock':
    case 'eth_blockNumber': {
      const parsed = parseBlockHeight(item);
      return { status: parsed.status, result: parsed.value };
    }
    default: {
      const latency = parseLatency(item);
      return { status: latency.status, result: latency.value };
    }
  }
}

export function buildDiagnosticReportEntry(item: DiagnosticHistoryItem): DiagnosticReportEntry {
  const metric = metricFromRecord(item);
  const entry: DiagnosticReportEntry = {
    id: item.id,
    requestMethod: item.request.method,
    timestamp: new Date(item.timestamp).toISOString(),
    endpointOrigin: sanitizeEndpointOrigin(item.endpoint),
    outcome: classifyOutcome(item),
    latencyMs: item.latency,
    metricStatus: metric.status,
    metricResult: metric.result,
    evidenceLabel: 'generic_endpoint_tested',
    dataOrigin: 'real_request',
    error: item.error,
  };
  return entry;
}

export function buildDiagnosticReport(
  history: DiagnosticHistoryItem[],
  exportedAtOrFindings?: Finding[] | Date,
  maybeExportedAt?: Date
): DiagnosticReportExport {
  // Allow older call: buildDiagnosticReport(history, date)
  // New call: buildDiagnosticReport(history, findings, date?) or (history, findings?) or (history, date?)
  let findings: Finding[] | undefined;
  let exportedAt: Date;

  if (exportedAtOrFindings instanceof Date) {
    findings = undefined;
    exportedAt = exportedAtOrFindings;
  } else if (Array.isArray(exportedAtOrFindings) || exportedAtOrFindings === undefined) {
    findings = exportedAtOrFindings as Finding[] | undefined;
    exportedAt = maybeExportedAt ?? new Date();
  } else {
    findings = undefined;
    exportedAt = new Date();
  }

  const records = history.map((item) => buildDiagnosticReportEntry(item));
  const exportPayload: DiagnosticReportExport = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    recordCount: records.length,
    records,
  };

  if (findings !== undefined) exportPayload.findings = findings;

  return exportPayload;
}

/**
 * Attach the session trends & verdict block to a report (Phase 2.5).
 *
 * Returns a NEW report object; the input is never mutated and every v1 field
 * is carried over untouched. When the snapshots cannot support an honest
 * trend (fewer than 2 for one endpoint), the report is returned unchanged —
 * the export never claims a trend that was not computed.
 */
/**
 * Attach the latest Substrate probe result to a report, additively.
 * Returns a NEW report; when the result is null the report is returned
 * unchanged, so an export without a probe never claims one.
 */
export function attachSubstrateWsProbe(
  report: DiagnosticReportExport,
  result: SubstrateWsProbeResult | null,
): DiagnosticReportExport {
  if (!result) return report;
  return { ...report, substrateWsProbe: result };
}

export function attachSessionTrends(
  report: DiagnosticReportExport,
  snapshots: HealthCheckSnapshot[]
): DiagnosticReportExport {
  const trends = computeSessionTrends(snapshots);
  if (trends.status !== 'available') return report;
  return {
    ...report,
    sessionTrends: { ...trends, blockIntervalNote: BLOCK_INTERVAL_NOTE },
  };
}

/**
 * Attach the Health Score block to a report, additively. Returns a NEW
 * report; with no snapshot and no probe the report is returned unchanged,
 * so an export never claims a score that was not computed. A score below
 * the coverage floor is attached as score: null with its components, so
 * the reader still sees exactly what was and was not measured.
 */
export function attachHealthScore(
  report: DiagnosticReportExport,
  snapshots: HealthCheckSnapshot[],
  wsProbe: SubstrateWsProbeResult | null,
  extras?: { motion?: ChainMotion | null; reliability?: ReliabilityReport | null },
): DiagnosticReportExport {
  if (snapshots.length === 0 && !wsProbe && !extras?.motion && !extras?.reliability) return report;
  const score = computeHealthScoreV2({
    snapshots,
    wsProbe,
    motion: extras?.motion ?? null,
    reliability: extras?.reliability
      ? { samples: extras.reliability.samples, errors: extras.reliability.errors, http5xx: extras.reliability.http5xx, p50Ms: extras.reliability.p50Ms, p95Ms: extras.reliability.p95Ms }
      : null,
  });
  return { ...report, healthScore: { ...score, methodology: HEALTH_SCORE_METHODOLOGY_URL } };
}

export function attachOperatorSignals(
  report: DiagnosticReportExport,
  input: { stall: StallAssessment | null; wsProbe: SubstrateWsProbeResult | null; reliability: ReliabilityReport | null; units: UnitsSanity | null },
): DiagnosticReportExport {
  const stallWorthSaving = input.stall !== null && input.stall.state !== 'unknown';
  if (!stallWorthSaving && !input.reliability && !input.units) return report;
  const findings = operatorFindings(input);
  return {
    ...report,
    operatorSignals: {
      schema: 'nodescope.operator-signals.v1',
      stall: input.stall,
      reliability: input.reliability,
      units: input.units,
      findings,
    },
  };
}

/**
 * Attach the operator next step. Additive. Skipped when there is no
 * score and no stall, so an empty export does not invent an action.
 * Custom weights and local baselines stay in the browser and are not
 * written here.
 */
export function attachOperatorActions(
  report: DiagnosticReportExport,
  input: {
    snapshots: HealthCheckSnapshot[];
    wsProbe: SubstrateWsProbeResult | null;
    stall: StallAssessment | null;
  },
): DiagnosticReportExport {
  const stalled = input.stall?.state === 'stalled';
  if (!report.healthScore && !stalled) return report;
  const parity = assessEndpointParity({ snapshots: input.snapshots, wsProbe: input.wsProbe });
  const plan = planOperatorActions({
    scope: 'self',
    score: report.healthScore ?? null,
    stall: input.stall,
    wsProbe: input.wsProbe,
    parity,
  });
  return { ...report, operatorActions: plan };
}

/** Attach the session chart when at least two checks exist. Additive. */
export function attachScoreHistory(
  report: DiagnosticReportExport,
  snapshots: HealthCheckSnapshot[],
  wsProbe: SubstrateWsProbeResult | null,
  motion: ChainMotion | null = null,
): DiagnosticReportExport {
  const points = buildScoreHistory(snapshots, wsProbe, motion);
  if (points.length < 2) return report;
  return { ...report, scoreHistory: { schema: 'nodescope.score-history.v1', points } };
}
