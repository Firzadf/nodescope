import { describe, expect, it } from 'vitest';
import type { HealthCheckSnapshot } from '../types/healthCheck';
import {
  PORTALDOT_V3_GO_LIVE_MS,
  describeV3Eras,
  detectV3Crossing,
  getV3Era,
} from './v3Era';

function snapshot(id: string, timestamp: number): HealthCheckSnapshot {
  return {
    schemaVersion: 'nodescope.health-snapshot.v1',
    id,
    timestamp,
    exportedAt: new Date(timestamp).toISOString(),
    endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
    endpointProfile: 'portaldot_v3_evm',
    checks: [],
    findings: [],
  };
}

describe('v3Era', () => {
  it('uses the official go-live instant: 23 Oct 2026, 23:00 UTC', () => {
    expect(new Date(PORTALDOT_V3_GO_LIVE_MS).toISOString()).toBe('2026-10-23T23:00:00.000Z');
  });

  it('tags one millisecond before go-live as Pre-V3 and go-live itself as Post-V3', () => {
    expect(getV3Era(PORTALDOT_V3_GO_LIVE_MS - 1)).toBe('pre_v3');
    expect(getV3Era(PORTALDOT_V3_GO_LIVE_MS)).toBe('post_v3');
  });

  it('detects a crossing and reports the boundary pair in chronological order', () => {
    const crossing = detectV3Crossing([
      snapshot('post-1', PORTALDOT_V3_GO_LIVE_MS + 60000),
      snapshot('pre-1', PORTALDOT_V3_GO_LIVE_MS - 60000),
      snapshot('pre-2', PORTALDOT_V3_GO_LIVE_MS - 120000),
    ]);
    expect(crossing).toEqual({
      preSnapshotId: 'pre-1',
      postSnapshotId: 'post-1',
      preCount: 2,
      postCount: 1,
    });
  });

  it('returns null when all snapshots are in one era', () => {
    expect(detectV3Crossing([snapshot('a', PORTALDOT_V3_GO_LIVE_MS + 1)])).toBeNull();
    expect(detectV3Crossing([])).toBeNull();
  });

  it('describes a post-V3-only session without claiming a crossing', () => {
    const text = describeV3Eras([snapshot('a', PORTALDOT_V3_GO_LIVE_MS + 1)]);
    expect(text).toContain('Post-V3');
    expect(text).not.toContain('crosses');
  });
});
