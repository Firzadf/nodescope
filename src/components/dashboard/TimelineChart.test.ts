import { describe, it, expect } from 'vitest';
import { buildTimelinePoints } from '../../utils/timelinePoints';
import type { HealthCheckSnapshot } from '../../types/healthCheck';

function snapshot(id: string, timestamp: number, height: number | null, latencies: (number | null)[]): HealthCheckSnapshot {
  return {
    schemaVersion: 'nodescope.health-snapshot.v1',
    id,
    timestamp,
    exportedAt: new Date(timestamp).toISOString(),
    endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
    endpointProfile: 'portaldot_v3_evm',
    checks: [
      { method: 'eth_blockNumber', outcome: 'success', success: true, latencyMs: latencies[0] ?? null, observedValue: height, error: null },
      { method: 'eth_chainId', outcome: 'success', success: true, latencyMs: latencies[1] ?? null, observedValue: '420420777', error: null },
    ],
    findings: [],
  };
}

describe('buildTimelinePoints', () => {
  it('orders chronologically and computes median latency per snapshot', () => {
    const points = buildTimelinePoints([
      snapshot('b', 2000, 103, [70, 90]),
      snapshot('a', 1000, 100, [60, 80]),
    ]);
    expect(points.map((p) => p.blockHeight)).toEqual(['100', '103']);
    expect(points.map((p) => p.medianLatencyMs)).toEqual([70, 80]);
  });

  it('keeps missing values as null, never as zero', () => {
    const points = buildTimelinePoints([
      snapshot('a', 1000, null, [null, null]),
      snapshot('b', 2000, 101, [50, null]),
    ]);
    expect(points[0]).toEqual({ timestamp: 1000, blockHeight: null, medianLatencyMs: null });
    expect(points[1].medianLatencyMs).toBe(50);
  });
});
