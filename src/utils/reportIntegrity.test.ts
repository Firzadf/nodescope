import { describe, expect, it } from 'vitest';
import {
  attachSessionTrends,
  buildDiagnosticReport,
  type DiagnosticReportExport,
} from './reportBuilder';
import {
  INTEGRITY_SCOPE,
  canonicalizeReport,
  canonicalizeValue,
  sha256Hex,
  stampReportIntegrity,
  verifyReport,
  verifyReportText,
} from './reportIntegrity';
import type { DiagnosticHistoryItem } from '../types/rpc';
import {
  HEALTH_SNAPSHOT_SCHEMA_VERSION,
  type HealthCheckCheck,
  type HealthCheckSnapshot,
} from '../types/healthCheck';

const T0 = 1700000000000;
const EXPORT_DATE = new Date('2026-10-21T00:00:00.000Z');

function blockRecord(overrides: Partial<DiagnosticHistoryItem> = {}): DiagnosticHistoryItem {
  return {
    id: 'record-1',
    endpoint: 'https://rpc.example.test',
    timestamp: T0,
    request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
    response: { jsonrpc: '2.0', result: '0x10', id: 1 },
    latency: 23,
    error: null,
    success: true,
    ...overrides,
  };
}

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

/** A realistic report: two records + findings + the Phase 2.5 trends block, stamped. */
async function buildStampedReport(): Promise<DiagnosticReportExport> {
  const base = buildDiagnosticReport(
    [blockRecord(), blockRecord({ id: 'record-2', timestamp: T0 + 76_000, latency: 31 })],
    [],
    EXPORT_DATE
  );
  const withTrends = attachSessionTrends(base, [
    trendSnapshot('s1', T0, '0x100'),
    trendSnapshot('s2', T0 + 76_000, '0x10c'),
  ]);
  return stampReportIntegrity(withTrends);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Rebuild a value with every object's keys in reverse order (JSON-formatter simulation). */
function shuffleKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shuffleKeys);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).reverse()) {
      out[key] = shuffleKeys(source[key]);
    }
    return out;
  }
  return value;
}

describe('canonicalizeValue', () => {
  it('is independent of key insertion order, including nested objects', () => {
    const a = { b: 1, a: { d: [true, null], c: 'x' }, n: 2.5 };
    const b = { n: 2.5, a: { c: 'x', d: [true, null] }, b: 1 };
    expect(canonicalizeValue(a)).toBe(canonicalizeValue(b));
  });

  it('matches the pinned canonical vector', () => {
    const fixture = { b: 1, a: { d: [true, null], c: 'x' }, n: 2.5 };
    expect(canonicalizeValue(fixture)).toBe('{"a":{"c":"x","d":[true,null]},"b":1,"n":2.5}');
  });

  it('preserves array order and applies the JSON mirroring rules', () => {
    expect(canonicalizeValue([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalizeValue({ keep: 1, drop: undefined })).toBe('{"keep":1}');
    expect(canonicalizeValue({ x: Number.NaN, y: Number.POSITIVE_INFINITY })).toBe('{"x":null,"y":null}');
    expect(canonicalizeValue(-0)).toBe('0');
    expect(canonicalizeValue('héllo "quoted"')).toBe(JSON.stringify('héllo "quoted"'));
  });
});

describe('sha256Hex', () => {
  it('matches the known SHA-256 of the empty string', async () => {
    await expect(sha256Hex('')).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('matches the pinned digest of the canonical fixture', async () => {
    const canonical = canonicalizeValue({ b: 1, a: { d: [true, null], c: 'x' }, n: 2.5 });
    await expect(sha256Hex(canonical)).resolves.toBe(
      'cf440d3b2f707bf7deb43602e0f034a270818fe2ef6ae186db4d1dfe69626ac0'
    );
  });
});

describe('stampReportIntegrity + verifyReport', () => {
  it('stamps additively: v1 fields untouched, input not mutated, scope printed', async () => {
    const base = buildDiagnosticReport([blockRecord()], [], EXPORT_DATE);
    const before = JSON.stringify(base);

    const stamped = await stampReportIntegrity(base);

    expect(JSON.stringify(base)).toBe(before);
    expect(base.integrity).toBeUndefined();
    expect(stamped.schemaVersion).toBe(base.schemaVersion);
    expect(stamped.records).toEqual(base.records);
    expect(stamped.integrity?.algorithm).toBe('SHA-256');
    expect(stamped.integrity?.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stamped.integrity?.scope).toBe(INTEGRITY_SCOPE);
  });

  it('round-trips: a stamped report verifies even after every key is reordered', async () => {
    const stamped = await buildStampedReport();
    const shuffledText = JSON.stringify(shuffleKeys(stamped));

    const result = await verifyReportText(shuffledText);

    expect(result.status).toBe('verified');
    expect(result.statedHash).toBe(stamped.integrity?.hash);
    expect(result.computedHash).toBe(stamped.integrity?.hash);
    expect(result.report?.sessionTrends?.verdict.level).toBe('healthy');
  });

  it('excludes the integrity block itself from the hash scope', async () => {
    const stamped = await buildStampedReport();
    const unstamped = clone(stamped);
    delete unstamped.integrity;
    expect(canonicalizeReport(stamped)).toBe(canonicalizeReport(unstamped));
  });

  it('re-stamping a stamped report verifies and reproduces the same hash (never hash a hash)', async () => {
    const stamped = await buildStampedReport();
    const restamped = await stampReportIntegrity(stamped);

    expect(restamped.integrity?.hash).toBe(stamped.integrity?.hash);
    await expect(verifyReport(restamped)).resolves.toMatchObject({ status: 'verified' });
  });

  it('detects a flipped latency', async () => {
    const tampered = clone(await buildStampedReport());
    tampered.records[0].latencyMs = 999;

    const result = await verifyReport(tampered);

    expect(result.status).toBe('mismatch');
    expect(result.statedHash).toBe(tampered.integrity?.hash);
    expect(result.computedHash).not.toBe(result.statedHash);
    expect(result.detail).toMatch(/altered after export/);
  });

  it('detects a flipped block height (record metricResult)', async () => {
    const tampered = clone(await buildStampedReport());
    tampered.records[0].metricResult = 999999;

    await expect(verifyReport(tampered)).resolves.toMatchObject({ status: 'mismatch' });
  });

  it('detects a flipped session verdict level', async () => {
    const tampered = clone(await buildStampedReport());
    expect(tampered.sessionTrends?.verdict.level).toBe('healthy');
    tampered.sessionTrends!.verdict.level = 'unstable';

    await expect(verifyReport(tampered)).resolves.toMatchObject({ status: 'mismatch' });
  });

  it('detects a changed exportedAt and a removed record', async () => {
    const stamped = await buildStampedReport();

    const timeShifted = clone(stamped);
    timeShifted.exportedAt = '2026-10-22T00:00:00.000Z';
    await expect(verifyReport(timeShifted)).resolves.toMatchObject({ status: 'mismatch' });

    const shrunk = clone(stamped);
    shrunk.records.pop();
    await expect(verifyReport(shrunk)).resolves.toMatchObject({ status: 'mismatch' });
  });

  it('reports a legacy report without a stamp as NO_INTEGRITY', async () => {
    const legacy = buildDiagnosticReport([blockRecord()], [], EXPORT_DATE);

    const fromObject = await verifyReport(legacy);
    expect(fromObject.status).toBe('no_integrity');
    expect(fromObject.detail).toMatch(/predates integrity stamping/);
    expect(fromObject.report?.recordCount).toBe(1);

    const fromText = await verifyReportText(JSON.stringify(legacy));
    expect(fromText.status).toBe('no_integrity');
  });

  it('reports a malformed stamp as NO_INTEGRITY with the malformed detail', async () => {
    const badAlgorithm = clone(await buildStampedReport());
    badAlgorithm.integrity = { algorithm: 'SHA-256', hash: 'abc', scope: 'x' };
    const shortHash = await verifyReport(badAlgorithm);
    expect(shortHash.status).toBe('no_integrity');
    expect(shortHash.detail).toMatch(/malformed/);

    const noStampShape = clone(await buildStampedReport());
    noStampShape.integrity = 'not-an-object' as never;
    await expect(verifyReport(noStampShape)).resolves.toMatchObject({ status: 'no_integrity' });
  });

  it('rejects non-NodeScope shapes as NOT_NODESCOPE', async () => {
    await expect(verifyReport({})).resolves.toMatchObject({ status: 'not_nodescope' });
    await expect(verifyReport({ schemaVersion: 'other.v9', records: [], recordCount: 0 }))
      .resolves.toMatchObject({ status: 'not_nodescope' });
    await expect(verifyReport([1, 2, 3])).resolves.toMatchObject({ status: 'not_nodescope' });
    await expect(verifyReport('a string')).resolves.toMatchObject({ status: 'not_nodescope' });
    await expect(verifyReport(null)).resolves.toMatchObject({ status: 'not_nodescope' });
    await expect(
      verifyReport({ schemaVersion: 'nodescope.diagnostic-report.v1', records: 'nope', recordCount: 0 })
    ).resolves.toMatchObject({ status: 'not_nodescope' });
  });

  it('reports unparseable text as MALFORMED', async () => {
    await expect(verifyReportText('{not json')).resolves.toMatchObject({ status: 'malformed' });
    await expect(verifyReportText('')).resolves.toMatchObject({ status: 'malformed' });
  });
});
