import type { HealthCheckSnapshot } from '../types/healthCheck';
import { parseBlockHeight } from './snapshotComparer';

/**
 * Timeline charts: block height and median latency over the session.
 *
 * This is a visual rendering of numbers the Trends panel already computes
 * from the same snapshots, not a new data source. Points come only from
 * health checks the user ran this session, one endpoint at a time, in
 * chronological order. No polling, no interpolation between points, and
 * no mixing of counters: the block chart shows the session's block-height
 * method only (eth_blockNumber for the EVM profile), never a Substrate
 * header, and a missing value is drawn as a gap, never as zero.
 * The tables below the charts remain the authoritative numbers.
 */
export interface TimelinePoint {
  timestamp: number;
  blockHeight: string | null;
  medianLatencyMs: number | null;
}

const BLOCK_HEIGHT_METHOD: Record<string, string> = {
  portaldot_v3_evm: 'eth_blockNumber',
  generic_http: 'chain_getHeader',
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function buildTimelinePoints(snapshots: HealthCheckSnapshot[]): TimelinePoint[] {
  const chronological = [...snapshots].sort((a, b) =>
    a.timestamp !== b.timestamp ? a.timestamp - b.timestamp : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  return chronological.map((snapshot) => {
    const method = BLOCK_HEIGHT_METHOD[snapshot.endpointProfile];
    const blockCheck = method ? snapshot.checks.find((c) => c.method === method) : undefined;
    const height = blockCheck ? parseBlockHeight(blockCheck.observedValue) : null;
    const latencies = snapshot.checks
      .map((c) => c.latencyMs)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    return {
      timestamp: snapshot.timestamp,
      blockHeight: height === null ? null : height.toString(),
      medianLatencyMs: median(latencies),
    };
  });
}
