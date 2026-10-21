import { describe, expect, it } from 'vitest';
import {
  compareLatency,
  compareSnapshots,
  isRealFailure,
  isUnsupportedMethod,
  parseBlockHeight,
} from './snapshotComparer';
import {
  HEALTH_SNAPSHOT_SCHEMA_VERSION,
  type HealthCheckCheck,
  type HealthCheckSnapshot,
} from '../types/healthCheck';
import type { Finding } from '../types/diagnostic';

function createCheck(overrides: Partial<HealthCheckCheck> = {}): HealthCheckCheck {
  return {
    method: 'eth_chainId',
    outcome: 'success',
    success: true,
    latencyMs: 40,
    observedValue: '0x190f1ca9',
    error: null,
    ...overrides,
  };
}

function createFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'chain-id-verified',
    severity: 'info',
    title: 'Chain ID Verified',
    evidence: '0x190f1ca9',
    explanation: 'Expected chain ID matched',
    recommendation: 'No action needed',
    ...overrides,
  };
}

function createSnapshot(overrides: Partial<HealthCheckSnapshot> = {}): HealthCheckSnapshot {
  return {
    schemaVersion: HEALTH_SNAPSHOT_SCHEMA_VERSION,
    id: 'snap-1',
    timestamp: 1700000000000,
    exportedAt: '2026-10-21T00:00:00.000Z',
    endpointOrigin: 'https://rpc.example.test',
    endpointProfile: 'portaldot_v3_evm',
    checks: [],
    findings: [],
    ...overrides,
  };
}

describe('compareSnapshots', () => {
  it('reports identical checks and findings as unchanged', () => {
    const snapshot = createSnapshot({
      checks: [createCheck(), createCheck({ method: 'eth_blockNumber', observedValue: '0x64' })],
      findings: [createFinding()],
    });

    const result = compareSnapshots(snapshot, snapshot);

    expect(result.mode).toBe('like_for_like');
    expect(result.comparable).toBe(true);
    expect(result.incompatibilityReason).toBeNull();
    expect(result.checks.map((check) => check.status)).toEqual(['unchanged', 'unchanged']);
    expect(result.findings[0].status).toBe('unchanged_finding');
    expect(result.a.timestamp).toBe(result.b.timestamp);
  });

  it('matches checks by method and reports outcome, success, and error changes', () => {
    const a = createSnapshot({
      checks: [createCheck()],
    });
    const b = createSnapshot({
      checks: [
        createCheck({
          outcome: 'network_error',
          success: false,
          latencyMs: null,
          observedValue: null,
          error: 'Request timed out',
        }),
      ],
    });

    const comparison = compareSnapshots(a, b).checks[0];

    expect(comparison.status).toBe('changed');
    expect(comparison.a?.outcome).toBe('success');
    expect(comparison.b?.outcome).toBe('network_error');
    expect(comparison.fieldChanges).toEqual(
      expect.arrayContaining([
        { field: 'outcome', a: 'success', b: 'network_error' },
        { field: 'success', a: true, b: false },
        { field: 'observedValue', a: '0x190f1ca9', b: null },
        { field: 'latencyMs', a: 40, b: null },
        { field: 'error', a: null, b: 'Request timed out' },
      ])
    );
  });

  it('reports observed value changes and distinguishes null from valid zero, false, and empty string', () => {
    const a = createSnapshot({
      checks: [
        createCheck({ method: 'zero', observedValue: null }),
        createCheck({ method: 'false', observedValue: null }),
        createCheck({ method: 'empty', observedValue: null }),
      ],
    });
    const b = createSnapshot({
      checks: [
        createCheck({ method: 'zero', observedValue: 0 }),
        createCheck({ method: 'false', observedValue: '' }),
        createCheck({ method: 'empty', observedValue: 'value' }),
      ],
    });

    const result = compareSnapshots(a, b);

    expect(result.checks).toHaveLength(3);
    expect(result.checks.every((check) => check.status === 'changed')).toBe(true);
    expect(result.checks.find((check) => check.method === 'zero')?.fieldChanges).toContainEqual({
      field: 'observedValue',
      a: null,
      b: 0,
    });
    expect(result.checks.find((check) => check.method === 'false')?.fieldChanges).toContainEqual({
      field: 'observedValue',
      a: null,
      b: '',
    });
    expect(result.checks.find((check) => check.method === 'empty')?.fieldChanges).toContainEqual({
      field: 'observedValue',
      a: null,
      b: 'value',
    });
  });

  it('reports added and removed checks in stable method order', () => {
    const a = createSnapshot({
      checks: [createCheck({ method: 'removed' }), createCheck({ method: 'same' })],
    });
    const b = createSnapshot({
      checks: [createCheck({ method: 'added' }), createCheck({ method: 'same' })],
    });

    const checks = compareSnapshots(a, b).checks;

    expect(checks.map((check) => check.method)).toEqual(['added', 'removed', 'same']);
    expect(checks.find((check) => check.method === 'added')).toMatchObject({
      status: 'added',
      a: null,
    });
    expect(checks.find((check) => check.method === 'removed')).toMatchObject({
      status: 'removed',
      b: null,
    });
  });

  it('reports latency delta only for two valid finite measurements', () => {
    expect(compareLatency(40, 55)).toEqual({ status: 'available', value: 15 });
    expect(compareLatency(0, 5)).toEqual({ status: 'available', value: 5 });
    expect(compareLatency(null, 55)).toEqual({ status: 'missing_in_a', value: null });
    expect(compareLatency(40, null)).toEqual({ status: 'missing_in_b', value: null });
    expect(compareLatency(null, null)).toEqual({ status: 'missing_in_both', value: null });
    expect(compareLatency(Number.NaN, 55)).toEqual({ status: 'invalid', value: null });
    expect(compareLatency(40, Number.POSITIVE_INFINITY)).toEqual({ status: 'invalid', value: null });
  });

  it('includes latency change in check comparison and keeps missing latency unavailable', () => {
    const a = createSnapshot({ checks: [createCheck({ latencyMs: 10 })] });
    const b = createSnapshot({ checks: [createCheck({ latencyMs: 25 })] });
    const changed = compareSnapshots(a, b).checks[0];

    expect(changed.latencyDelta).toEqual({ status: 'available', value: 15 });

    const missing = compareSnapshots(
      createSnapshot({ checks: [createCheck({ latencyMs: null })] }),
      createSnapshot({ checks: [createCheck({ latencyMs: 25 })] })
    ).checks[0];
    expect(missing.latencyDelta).toEqual({ status: 'missing_in_a', value: null });
  });

  it('keeps unsupported methods distinct from actual failures', () => {
    expect(isUnsupportedMethod('unsupported_method')).toBe(true);
    expect(isUnsupportedMethod('rpc_error')).toBe(false);
    expect(isRealFailure('unsupported_method')).toBe(false);
    expect(isRealFailure('rpc_error')).toBe(true);
    expect(isRealFailure('network_error')).toBe(true);
    expect(isRealFailure('http_error')).toBe(true);
    expect(isRealFailure('invalid_response')).toBe(true);

    const result = compareSnapshots(
      createSnapshot({
        checks: [
          createCheck({
            method: 'unsupported',
            outcome: 'unsupported_method',
            success: false,
            observedValue: null,
            error: 'JSON-RPC Error [-32601]',
          }),
          createCheck({
            method: 'failed',
            outcome: 'rpc_error',
            success: false,
            observedValue: null,
            error: 'JSON-RPC Error [_internal]',
          }),
        ],
      }),
      createSnapshot({
        checks: [
          createCheck({
            method: 'unsupported',
            outcome: 'unsupported_method',
            success: false,
            observedValue: null,
            error: 'JSON-RPC Error [-32601]',
          }),
          createCheck({
            method: 'failed',
            outcome: 'network_error',
            success: false,
            observedValue: null,
            error: 'Network unavailable',
          }),
        ],
      })
    );

    expect(result.checks.find((check) => check.method === 'unsupported')?.status).toBe('unchanged');
    expect(result.checks.find((check) => check.method === 'failed')?.status).toBe('changed');
  });

  it('classifies new, resolved, unchanged, and duplicate findings deterministically', () => {
    const unchanged = createFinding();
    const resolved = createFinding({ ruleId: 'resolved', evidence: 'old' });
    const newFinding = createFinding({ ruleId: 'new', evidence: 'new' });
    const duplicate = createFinding({ ruleId: 'duplicate', evidence: 'same' });

    const result = compareSnapshots(
      createSnapshot({ findings: [unchanged, resolved, duplicate, duplicate] }),
      createSnapshot({ findings: [unchanged, newFinding, duplicate, duplicate] })
    );

    expect(result.findings.map((finding) => [finding.key, finding.status])).toEqual([
      ['chain-id-verified::0x190f1ca9', 'unchanged_finding'],
      ['duplicate::same', 'unchanged_finding'],
      ['duplicate::same#1', 'unchanged_finding'],
      ['new::new', 'new_finding'],
      ['resolved::old', 'resolved_finding'],
    ]);
  });

  it('reports non-key finding field changes without changing finding identity', () => {
    const result = compareSnapshots(
      createSnapshot({ findings: [createFinding({ severity: 'info' })] }),
      createSnapshot({ findings: [createFinding({ severity: 'warning', title: 'Updated' })] })
    );

    expect(result.findings[0].status).toBe('unchanged_finding');
    expect(result.findings[0].fieldChanges).toEqual([
      { field: 'severity', a: 'info', b: 'warning' },
      { field: 'title', a: 'Chain ID Verified', b: 'Updated' },
    ]);
  });

  it('marks same origin and profile comparable', () => {
    const result = compareSnapshots(createSnapshot(), createSnapshot());

    expect(result.comparable).toBe(true);
    expect(result.mode).toBe('like_for_like');
    expect(result.incompatibilityReason).toBeNull();
  });

  it('marks different origin incompatible but still returns descriptive diffs', () => {
    const result = compareSnapshots(
      createSnapshot({
        endpointOrigin: 'https://one.example.test',
        checks: [createCheck({ observedValue: '0x1' })],
      }),
      createSnapshot({
        endpointOrigin: 'https://two.example.test',
        checks: [createCheck({ observedValue: '0x2' })],
      })
    );

    expect(result.comparable).toBe(false);
    expect(result.mode).toBe('cross_endpoint');
    expect(result.incompatibilityReason).toContain('endpoint origin');
    expect(result.checks[0].status).toBe('changed');
    expect(result.blockHeightDelta.status).toBe('unavailable_incompatible_snapshots');
  });

  it('marks different profile incompatible and names profile difference', () => {
    const result = compareSnapshots(
      createSnapshot({ endpointProfile: 'portaldot_v3_evm' }),
      createSnapshot({ endpointProfile: 'generic_http' })
    );

    expect(result.comparable).toBe(false);
    expect(result.incompatibilityReason).toContain('endpoint profile');
    expect(result.blockHeightDelta.status).toBe('unavailable_incompatible_snapshots');
  });

  it('calculates precise EVM hexadecimal block-height delta', () => {
    const result = compareSnapshots(
      createSnapshot({
        checks: [createCheck({ method: 'eth_blockNumber', observedValue: '0xfffffffffffff' })],
      }),
      createSnapshot({
        checks: [createCheck({ method: 'eth_blockNumber', observedValue: '0x10000000000000' })],
      })
    );

    expect(result.blockHeightDelta).toEqual({
      status: 'available',
      method: 'eth_blockNumber',
      a: '4503599627370495',
      b: '4503599627370496',
      delta: '1',
    });
  });

  it('calculates generic profile block-height delta using chain_getHeader', () => {
    const result = compareSnapshots(
      createSnapshot({
        endpointProfile: 'generic_http',
        checks: [createCheck({ method: 'chain_getHeader', observedValue: '0x64' })],
      }),
      createSnapshot({
        endpointProfile: 'generic_http',
        checks: [createCheck({ method: 'chain_getHeader', observedValue: '0x6e' })],
      })
    );

    expect(result.blockHeightDelta).toEqual({
      status: 'available',
      method: 'chain_getHeader',
      a: '100',
      b: '110',
      delta: '10',
    });
  });

  it('reports explicit block-height unavailability for invalid values and missing checks', () => {
    const invalid = compareSnapshots(
      createSnapshot({ checks: [createCheck({ method: 'eth_blockNumber', observedValue: '100' })] }),
      createSnapshot({ checks: [createCheck({ method: 'eth_blockNumber', observedValue: '0x64' })] })
    );
    expect(invalid.blockHeightDelta.status).toBe('unavailable_unsupported_representation');
    expect(invalid.blockHeightDelta.method).toBe('eth_blockNumber');

    const missing = compareSnapshots(
      createSnapshot({ checks: [] }),
      createSnapshot({ checks: [createCheck({ method: 'eth_blockNumber', observedValue: '0x64' })] })
    );
    expect(missing.blockHeightDelta).toEqual({
      status: 'unavailable_missing_check',
      method: 'eth_blockNumber',
      a: null,
      b: null,
      delta: null,
    });
  });

  it('does not derive block height from an unsuccessful check', () => {
    const result = compareSnapshots(
      createSnapshot({
        checks: [
          createCheck({
            method: 'eth_blockNumber',
            outcome: 'rpc_error',
            success: false,
            observedValue: null,
          }),
        ],
      }),
      createSnapshot({
        checks: [createCheck({ method: 'eth_blockNumber', observedValue: '0x64' })],
      })
    );

    expect(result.blockHeightDelta.status).toBe('unavailable_unsupported_representation');
    expect(result.blockHeightDelta.delta).toBeNull();
  });

  it('parses only supported block-height representations without precision loss', () => {
    expect(parseBlockHeight('0x64')).toBe(100n);
    expect(parseBlockHeight(' 0X64 ')).toBe(100n);
    expect(parseBlockHeight(100)).toBe(100n);
    expect(parseBlockHeight('100')).toBeNull();
    expect(parseBlockHeight(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
    expect(parseBlockHeight(null)).toBeNull();
  });

  it('does not mutate snapshots, nested checks, or findings', () => {
    const a = createSnapshot({
      checks: [createCheck()],
      findings: [createFinding()],
    });
    const b = createSnapshot({
      checks: [createCheck({ observedValue: '0x2' })],
      findings: [createFinding({ severity: 'warning' })],
    });
    const beforeA = structuredClone(a);
    const beforeB = structuredClone(b);

    compareSnapshots(a, b);

    expect(a).toEqual(beforeA);
    expect(b).toEqual(beforeB);
  });

  it('produces deterministic output for same inputs', () => {
    const a = createSnapshot({
      timestamp: 1700000000000,
      checks: [createCheck({ method: 'z_method' }), createCheck({ method: 'a_method' })],
      findings: [createFinding({ ruleId: 'z-rule' }), createFinding({ ruleId: 'a-rule' })],
    });
    const b = createSnapshot({ timestamp: 1700000000000 });

    const first = compareSnapshots(a, b);
    const second = compareSnapshots(a, b);

    expect(first).toEqual(second);
    expect(first.checks.map((check) => check.method)).toEqual(['a_method', 'z_method']);
    expect(first.findings.map((finding) => finding.key)).toEqual(expect.arrayContaining([
      'a-rule::0x190f1ca9',
      'z-rule::0x190f1ca9',
    ]));
  });
});
