import { describe, expect, it } from 'vitest';
import {
  REPORT_SCHEMA_VERSION,
  attachSessionTrends,
  buildDiagnosticReport,
  buildDiagnosticReportEntry,
  sanitizeEndpointOrigin,
} from './reportBuilder';
import type { DiagnosticHistoryItem } from '../types/rpc';
import {
  HEALTH_SNAPSHOT_SCHEMA_VERSION,
  type HealthCheckCheck,
  type HealthCheckSnapshot,
} from '../types/healthCheck';
import { evaluateHistoryFindings } from '../services/diagnosticRules';

function blockRecord(overrides: Partial<DiagnosticHistoryItem> = {}): DiagnosticHistoryItem {
  return {
    id: 'record-1',
    endpoint: 'https://user:pass@example.com:443/rpc?token=secret#frag',
    timestamp: 1700000000000,
    request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
    response: { jsonrpc: '2.0', result: '0x10', id: 1 },
    latency: 23,
    error: null,
    success: true,
    ...overrides,
  };
}

function record(overrides: Partial<DiagnosticHistoryItem> = {}): DiagnosticHistoryItem {
  return {
    id: 'record-1',
    endpoint: 'https://user:pass@example.com:443/rpc?token=secret#frag',
    timestamp: 1700000000000,
    request: {
      jsonrpc: '2.0',
      method: 'system_version',
      params: [],
      id: 1,
    },
    response: {
      jsonrpc: '2.0',
      result: 'portaldot-dev/0.1.0',
      id: 1,
    },
    latency: 23,
    error: null,
    success: true,
    ...overrides,
  };
}

describe('reportBuilder', () => {
  it('removes URL credentials, query strings, and fragments from endpoint origin', () => {
    const origin = sanitizeEndpointOrigin('https://alice:secret@rpc.example.com:8443/path?token=abc#key');
    expect(origin).toBe('https://rpc.example.com:8443');
  });

  it('returns invalid-url for malformed endpoints', () => {
    expect(sanitizeEndpointOrigin('not a url')).toBe('invalid-url');
  });

  it('builds schema-consistent empty export', () => {
    const report = buildDiagnosticReport([], new Date('2026-10-14T00:00:00.000Z'));
    expect(report.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    expect(report.exportedAt).toBe('2026-10-14T00:00:00.000Z');
    expect(report.recordCount).toBe(0);
    expect(report.records).toEqual([]);
  });

  it('labels successful history record as generic endpoint evidence from real request', () => {
    const entry = buildDiagnosticReportEntry(record());
    expect(entry.evidenceLabel).toBe('generic_endpoint_tested');
    expect(entry.dataOrigin).toBe('real_request');
    expect(entry.outcome).toBe('success');
    expect(entry.requestMethod).toBe('system_version');
    expect(entry.latencyMs).toBe(23);
    expect(entry.metricStatus).toBe('success');
    expect(entry.metricResult).toBe('portaldot-dev/0.1.0');
  });

  it('classifies JSON-RPC errors separately from network failures', () => {
    const entry = buildDiagnosticReportEntry(
      record({
        success: false,
        error: 'JSON-RPC Error [-32601]: Method not found',
        response: {
          jsonrpc: '2.0',
          error: { code: -32601, message: 'Method not found' },
          id: 1,
        },
      })
    );
    expect(entry.outcome).toBe('rpc_error');
    expect(entry.metricStatus).toBe('unsupported_method');
  });

  it('classifies network and HTTP failures', () => {
    const entry = buildDiagnosticReportEntry(
      record({
        success: false,
        response: null,
        error: 'HTTP Error: 502 Bad Gateway',
        latency: 64,
      })
    );
    expect(entry.outcome).toBe('network_or_http_error');
    expect(entry.latencyMs).toBe(64);
  });

  it('preserves missing latency as null', () => {
    const entry = buildDiagnosticReportEntry(
      record({
        success: false,
        response: null,
        error: 'Network or CORS Error: Could not connect',
        latency: null,
      })
    );
    expect(entry.outcome).toBe('network_or_http_error');
    expect(entry.latencyMs).toBeNull();
  });

  it('maps malformed responses to invalid_response', () => {
    const entry = buildDiagnosticReportEntry(
      record({
        request: { jsonrpc: '2.0', method: 'system_version', params: [], id: 2 },
        response: {
          jsonrpc: '2.0',
          result: { unexpected: true },
          id: 2,
        },
      })
    );
    expect(entry.metricStatus).toBe('invalid_response');
  });

  it('does not create fabricated demo records', () => {
    const report = buildDiagnosticReport([], new Date('2026-10-14T00:00:00.000Z'));
    expect(report.records.some((entry) => entry.evidenceLabel === 'demo_mock')).toBe(false);
    expect(report.recordCount).toBe(0);
  });

  it('never elevates a generic successful request to a portaldot-verified label', () => {
    const entry = buildDiagnosticReportEntry(
      record({
        endpoint: 'http://127.0.0.1:9944',
        request: { jsonrpc: '2.0', method: 'system_health', params: [], id: 1 },
        response: { jsonrpc: '2.0', result: { peers: 3, isSyncing: false }, id: 1 },
        success: true,
      })
    );
    expect(entry.evidenceLabel).toBe('generic_endpoint_tested');
    expect(entry.evidenceLabel).not.toBe('portaldot_local_node_verified');
    expect(entry.evidenceLabel).not.toBe('portaldot_v3_testnet_verified');
  });

  it('strips credentials and tokens from localhost and IP-based endpoints', () => {
    const origin = sanitizeEndpointOrigin('http://admin:secret@127.0.0.1:9944/rpc?token=abc#frag');
    expect(origin).toBe('http://127.0.0.1:9944');
  });

  it('includes findings in exported report without mutating existing records or labels', () => {
    const mockFinding = {
      ruleId: 'chain-id-verified',
      severity: 'info' as const,
      title: 'Chain ID Observed',
      evidence: 'Observed chain ID: 420420777',
      explanation: 'Matches expected testnet',
      recommendation: 'Proceed',
    };
    const report = buildDiagnosticReport([record()], [mockFinding], new Date('2026-10-14T00:00:00.000Z'));
    expect(report.findings).toHaveLength(1);
    expect(report.findings?.[0].ruleId).toBe('chain-id-verified');
    expect(report.records[0].evidenceLabel).toBe('generic_endpoint_tested');
  });

  describe('report export finding deduplication & endpoint scoping (regression)', () => {
    it('deduplicates repeated findings for same endpoint while preserving latest by timestamp, even if out of order', () => {
      // Arrives out of chronological order: newest item first, older item second
      const history: DiagnosticHistoryItem[] = [
        blockRecord({
          id: 'rec-new',
          endpoint: 'https://test-evm-rpc-v3.portaldot.dev',
          timestamp: 2000,
          response: { jsonrpc: '2.0', result: '0x105', id: 2 },
        }),
        blockRecord({
          id: 'rec-old',
          endpoint: 'https://test-evm-rpc-v3.portaldot.dev',
          timestamp: 1000,
          response: { jsonrpc: '2.0', result: '0x100', id: 1 },
        }),
      ];

      const findings = evaluateHistoryFindings(history);
      const report = buildDiagnosticReport(history, findings, new Date('2026-10-21T00:00:00.000Z'));

      // Both raw records must remain intact in the export
      expect(report.records).toHaveLength(2);
      expect(report.recordCount).toBe(report.records.length);
      expect(report.recordCount).toBe(2);
      expect(report.records[0].id).toBe('rec-new');
      expect(report.records[1].id).toBe('rec-old');

      // Findings must be deduplicated to exactly one finding: the one with the latest timestamp
      expect(report.findings).toHaveLength(1);
      expect(report.findings?.[0].ruleId).toBe('block-height-retrieved');
      expect(report.findings?.[0].evidence).toContain('0x105');
    });

    it('keeps identical rule and identical evidence from two different endpoints separate in the export', () => {
      // Same method, same ruleId, identical response/evidence, but two distinct endpoints
      const history: DiagnosticHistoryItem[] = [
        blockRecord({
          id: 'rec-ep1',
          endpoint: 'https://endpoint-a.example.com/rpc',
          timestamp: 1000,
          response: { jsonrpc: '2.0', result: '0x100', id: 1 },
        }),
        blockRecord({
          id: 'rec-ep2',
          endpoint: 'https://endpoint-b.example.com/rpc',
          timestamp: 1000,
          response: { jsonrpc: '2.0', result: '0x100', id: 2 },
        }),
      ];

      const findings = evaluateHistoryFindings(history);
      const report = buildDiagnosticReport(history, findings, new Date('2026-10-21T00:00:00.000Z'));

      // Raw records remain intact
      expect(report.records).toHaveLength(2);
      expect(report.recordCount).toBe(report.records.length);
      expect(report.recordCount).toBe(2);

      // Both distinct endpoints must have their own separate finding despite identical rule and evidence
      expect(report.findings).toHaveLength(2);
      const blockFindings = report.findings?.filter((f) => f.ruleId === 'block-height-retrieved');
      expect(blockFindings).toHaveLength(2);
      expect(blockFindings?.[0].evidence).toBe(blockFindings?.[1].evidence);
    });

    it('keeps distinct rule IDs and error classifications separate in the export', () => {
      const history: DiagnosticHistoryItem[] = [
        record({
          id: 'rec-chain',
          endpoint: 'https://test-evm-rpc-v3.portaldot.dev',
          timestamp: 1000,
          request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
          response: { jsonrpc: '2.0', result: '0x190f1ca9', id: 1 },
          success: true,
        }),
        record({
          id: 'rec-unsupported',
          endpoint: 'https://test-evm-rpc-v3.portaldot.dev',
          timestamp: 1050,
          request: { jsonrpc: '2.0', method: 'system_version', params: [], id: 2 },
          response: { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 2 },
          error: 'JSON-RPC Error [-32601]: Method not found',
          success: false,
        }),
        blockRecord({
          id: 'rec-block',
          endpoint: 'https://test-evm-rpc-v3.portaldot.dev',
          timestamp: 1100,
          response: { jsonrpc: '2.0', result: '0x50', id: 3 },
          success: true,
        }),
      ];

      const findings = evaluateHistoryFindings(history);
      const report = buildDiagnosticReport(history, findings, new Date('2026-10-21T00:00:00.000Z'));

      // Raw history untouched
      expect(report.records).toHaveLength(3);
      expect(report.recordCount).toBe(3);

      // Distinct rules must not collapse
      expect(report.findings).toHaveLength(3);
      const ruleIds = report.findings?.map((f) => f.ruleId);
      expect(ruleIds).toContain('chain-id-verified');
      expect(ruleIds).toContain('method-unsupported-on-endpoint');
      expect(ruleIds).toContain('block-height-retrieved');
    });
  });

  describe('attachSessionTrends (Phase 2.5, additive)', () => {
    const T0 = 1700000000000;

    function trendCheck(overrides: Partial<HealthCheckCheck> = {}): HealthCheckCheck {
      return {
        method: 'eth_blockNumber',
        outcome: 'success',
        success: true,
        latencyMs: 40,
        observedValue: '0x100',
        error: null,
        ...overrides,
      };
    }

    function trendSnapshot(id: string, timestamp: number, blockHex: string): HealthCheckSnapshot {
      return {
        schemaVersion: HEALTH_SNAPSHOT_SCHEMA_VERSION,
        id,
        timestamp,
        exportedAt: new Date(timestamp).toISOString(),
        endpointOrigin: 'https://rpc.example.test',
        endpointProfile: 'portaldot_v3_evm',
        checks: [
          trendCheck({ method: 'eth_chainId', observedValue: '0x190f1ca9' }),
          trendCheck({ method: 'eth_blockNumber', observedValue: blockHex }),
        ],
        findings: [],
      };
    }

    it('attaches the trends & verdict block when at least 2 snapshots support it', () => {
      const base = buildDiagnosticReport([blockRecord()], new Date('2026-10-21T00:00:00.000Z'));
      const snapshots = [trendSnapshot('s1', T0, '0x100'), trendSnapshot('s2', T0 + 76_000, '0x10c')];

      const report = attachSessionTrends(base, snapshots);

      expect(report.sessionTrends).toBeDefined();
      expect(report.sessionTrends?.status).toBe('available');
      expect(report.sessionTrends?.verdict.level).toBe('healthy');
      expect(report.sessionTrends?.verdict.rules).toHaveLength(4);
      expect(report.sessionTrends?.snapshotIds).toEqual(['s1', 's2']);
      expect(report.sessionTrends?.blockProgression.totalDelta).toBe('12');
      expect(report.sessionTrends?.blockIntervalNote).toMatch(/estimated from the wall-clock gap/);
      // The block must survive a JSON round-trip (no BigInt leaks).
      expect(() => JSON.stringify(report)).not.toThrow();
    });

    it('omits the block entirely when trends are insufficient (0 or 1 snapshots)', () => {
      const base = buildDiagnosticReport([blockRecord()], new Date('2026-10-21T00:00:00.000Z'));
      expect(attachSessionTrends(base, []).sessionTrends).toBeUndefined();
      expect(
        attachSessionTrends(base, [trendSnapshot('s1', T0, '0x100')]).sessionTrends
      ).toBeUndefined();
    });

    it('keeps every v1 field untouched and does not mutate the base report', () => {
      const base = buildDiagnosticReport([blockRecord()], new Date('2026-10-21T00:00:00.000Z'));
      const snapshots = [trendSnapshot('s1', T0, '0x100'), trendSnapshot('s2', T0 + 76_000, '0x10c')];

      const report = attachSessionTrends(base, snapshots);

      expect(report).not.toBe(base);
      expect(base.sessionTrends).toBeUndefined();
      expect(report.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
      expect(report.exportedAt).toBe(base.exportedAt);
      expect(report.recordCount).toBe(base.recordCount);
      expect(report.records).toEqual(base.records);
    });
  });
});
