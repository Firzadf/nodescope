import { useMemo } from 'react';
import type { HealthCheckSnapshot } from '../../types/healthCheck';
import { parseBlockHeight } from '../../utils/snapshotComparer';

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

function clock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

function LineChart({
  title,
  points,
  getValue,
  formatValue,
  emptyNote,
}: {
  title: string;
  points: TimelinePoint[];
  getValue: (p: TimelinePoint) => number | null;
  formatValue: (v: number) => string;
  emptyNote: string;
}) {
  const series = points
    .map((p) => ({ timestamp: p.timestamp, value: getValue(p) }))
    .filter((p): p is { timestamp: number; value: number } => p.value !== null);
  if (series.length < 2) {
    return (
      <div>
        <h5 className="text-sm font-semibold text-slate-300">{title}</h5>
        <p className="mt-1 text-xs text-slate-500">{emptyNote}</p>
      </div>
    );
  }
  const width = 640;
  const height = 180;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 12;
  const padBottom = 24;
  const minTime = series[0].timestamp;
  const maxTime = series[series.length - 1].timestamp;
  const minValue = Math.min(...series.map((p) => p.value));
  const maxValue = Math.max(...series.map((p) => p.value));
  const x = (t: number) =>
    maxTime === minTime ? width / 2 : padLeft + ((t - minTime) / (maxTime - minTime)) * (width - padLeft - padRight);
  const y = (v: number) =>
    maxValue === minValue
      ? height / 2
      : height - padBottom - ((v - minValue) / (maxValue - minValue)) * (height - padTop - padBottom);
  const path = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.timestamp).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const first = series[0];
  const last = series[series.length - 1];
  return (
    <div>
      <h5 className="text-sm font-semibold text-slate-300">{title}</h5>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-2 w-full rounded-lg border border-line bg-black/25"
        role="img"
        aria-label={`${title}: ${series.length} points from ${clock(first.timestamp)} to ${clock(last.timestamp)}`}
      >
        <title>{`${title}: ${series.length} points`}</title>
        <path d={path} fill="none" stroke="#0181FB" strokeWidth="2" />
        {series.map((p) => (
          <circle key={`${p.timestamp}-${p.value}`} cx={x(p.timestamp)} cy={y(p.value)} r="4" fill="#0181FB" />
        ))}
        <text x={padLeft} y={height - 6} fill="#64748b" fontSize="11">
          {clock(first.timestamp)}
        </text>
        <text x={width - padRight} y={height - 6} fill="#64748b" fontSize="11" textAnchor="end">
          {clock(last.timestamp)}
        </text>
      </svg>
      <p className="mt-1 font-data text-[11px] text-slate-400">
        First {formatValue(first.value)} · Last {formatValue(last.value)} · Range {formatValue(minValue)}–
        {formatValue(maxValue)}
      </p>
    </div>
  );
}

export function TimelineChart({ snapshots }: { snapshots: HealthCheckSnapshot[] }) {
  const points = useMemo(() => buildTimelinePoints(snapshots), [snapshots]);
  if (points.length < 2) {
    return (
      <p className="text-xs text-slate-500">
        Run at least 2 health checks to draw a timeline. Points appear only from checks you ran;
        nothing here is polled or simulated.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      <LineChart
        title="Timeline — Block height over the session"
        points={points}
        getValue={(p) => (p.blockHeight === null ? null : Number(p.blockHeight))}
        formatValue={(v) => String(Math.round(v))}
        emptyNote="Fewer than 2 usable block heights in this session, so no block timeline is drawn. A failed or unsupported block check contributes no point and is never treated as height 0."
      />
      <LineChart
        title="Timeline — Median latency per health check"
        points={points}
        getValue={(p) => p.medianLatencyMs}
        formatValue={(v) => `${Number.isInteger(v) ? v : v.toFixed(1)} ms`}
        emptyNote="No latency was recorded in at least 2 checks, so no latency timeline is drawn."
      />
      <p className="text-[11px] leading-relaxed text-slate-500">
        The horizontal axis is wall-clock time between your checks, not chain time. The block line
        uses the session&apos;s block-height method only; a Substrate header is a different counter
        and is never plotted on it.
      </p>
    </div>
  );
}
