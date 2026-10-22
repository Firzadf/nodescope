import type { DiagnosticHistoryItem } from '../types/rpc';
import type { MetricStatus } from '../types/node';
import type { Finding } from '../types/diagnostic';
import type { HealthCheckSnapshot } from '../types/healthCheck';
import {
  parseLatency,
  parseClientVersion,
  parsePeerCount,
  parseBlockHeight,
} from './metricParsers';
import { BLOCK_INTERVAL_NOTE, computeSessionTrends, type SessionTrends } from './sessionTrends';

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
  integrity?: ReportIntegrity;
}

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
