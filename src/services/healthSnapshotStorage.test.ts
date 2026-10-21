// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getHealthSnapshots,
  saveHealthSnapshot,
  clearHealthSnapshots,
  isValidHealthSnapshot,
} from './healthSnapshotStorage';
import {
  HEALTH_SNAPSHOT_SCHEMA_VERSION,
  type HealthCheckSnapshot,
} from '../types/healthCheck';

function validSnapshot(overrides: Partial<HealthCheckSnapshot> = {}): HealthCheckSnapshot {
  return {
    schemaVersion: HEALTH_SNAPSHOT_SCHEMA_VERSION,
    id: 'health-12345',
    timestamp: 1700000000000,
    exportedAt: '2026-10-21T00:00:00.000Z',
    endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
    endpointProfile: 'portaldot_v3_evm',
    checks: [
      {
        method: 'eth_chainId',
        outcome: 'success',
        success: true,
        latencyMs: 40,
        observedValue: '0x190f1ca9',
        error: null,
      },
    ],
    findings: [
      {
        ruleId: 'chain-id-verified',
        severity: 'info',
        title: 'Chain ID Verified',
        evidence: '0x190f1ca9',
        explanation: 'Expected chain ID matched',
        recommendation: 'All good',
      },
    ],
    ...overrides,
  };
}

describe('healthSnapshotStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('validates a conformant health snapshot', () => {
    expect(isValidHealthSnapshot(validSnapshot())).toBe(true);
  });

  it('rejects snapshot with invalid schema version', () => {
    const invalid = {
      ...validSnapshot(),
      schemaVersion: 'nodescope.health-snapshot.v99',
    };
    expect(isValidHealthSnapshot(invalid)).toBe(false);
  });

  it('rejects snapshot with invalid endpoint profile', () => {
    const invalid = {
      ...validSnapshot(),
      endpointProfile: 'arbitrary_network',
    };
    expect(isValidHealthSnapshot(invalid)).toBe(false);
  });

  it('rejects snapshot with malformed check outcome', () => {
    const invalid = {
      ...validSnapshot(),
      checks: [
        {
          method: 'eth_chainId',
          outcome: 'unknown_failure_code',
          success: false,
          latencyMs: 10,
          observedValue: null,
          error: 'boom',
        },
      ],
    };
    expect(isValidHealthSnapshot(invalid)).toBe(false);
  });

  it('rejects snapshot with malformed finding severity', () => {
    const invalid = {
      ...validSnapshot(),
      findings: [
        {
          ruleId: 'test',
          severity: 'fatal_disaster',
          title: 'T',
          evidence: 'E',
          explanation: 'Ex',
          recommendation: 'R',
        },
      ],
    };
    expect(isValidHealthSnapshot(invalid)).toBe(false);
  });

  it('saves and reads valid snapshots from sessionStorage', () => {
    const snap = validSnapshot();
    saveHealthSnapshot(snap);

    const loaded = getHealthSnapshots();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(snap.id);
  });

  it('filters out malformed stored entries automatically', () => {
    const good = validSnapshot({ id: 'good-1' });
    const bad = { corrupted: true };
    sessionStorage.setItem(
      'nodescope_health_snapshots_v1',
      JSON.stringify([good, bad, null, 'string-entry'])
    );

    const loaded = getHealthSnapshots();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('good-1');
  });

  it('limits saved snapshots to MAX_SNAPSHOTS (20)', () => {
    for (let i = 0; i < 25; i++) {
      saveHealthSnapshot(validSnapshot({ id: `snap-${i}`, timestamp: 1000 + i }));
    }
    const loaded = getHealthSnapshots();
    expect(loaded.length).toBeLessThanOrEqual(20);
  });

  it('clears snapshots completely', () => {
    saveHealthSnapshot(validSnapshot());
    expect(getHealthSnapshots()).toHaveLength(1);

    clearHealthSnapshots();
    expect(getHealthSnapshots()).toHaveLength(0);
  });
});
