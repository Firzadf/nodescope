import { useMemo } from 'react';
import type { HealthCheckSnapshot } from '../../types/healthCheck';
import type { SubstrateWsProbeResult } from '../../services/substrateWsProbe';
import type { ChainMotion } from '../../utils/stall';
import { buildScoreHistory, type ScoreHistoryPoint } from '../../utils/scoreHistory';

function clock(at: number): string {
  return new Date(at).toLocaleTimeString();
}

const MARK: Record<string, string> = {
  stall: '#fb923c',
  resume: '#34d399',
  degrade: '#f59e0b',
  recover: '#34d399',
};

function Series({
  title,
  points,
  read,
  format,
  color,
}: {
  title: string;
  points: ScoreHistoryPoint[];
  read: (p: ScoreHistoryPoint) => number | null;
  format: (n: number) => string;
  color: string;
}) {
  const series = points.map((p) => ({ at: p.at, value: read(p), point: p })).filter((p) => p.value !== null) as Array<{ at: number; value: number; point: ScoreHistoryPoint }>;
  if (series.length < 2) {
    return <p className="text-xs text-slate-500">{title}: needs two checks in this session.</p>;
  }
  const width = 640;
  const height = 160;
  const pad = { l: 8, r: 8, t: 16, b: 22 };
  const minT = series[0].at;
  const maxT = series[series.length - 1].at;
  const minV = Math.min(...series.map((p) => p.value));
  const maxV = Math.max(...series.map((p) => p.value));
  const x = (t: number) => (maxT === minT ? width / 2 : pad.l + ((t - minT) / (maxT - minT)) * (width - pad.l - pad.r));
  const y = (v: number) => (maxV === minV ? height / 2 : height - pad.b - ((v - minV) / (maxV - minV)) * (height - pad.t - pad.b));
  const d = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  return (
    <figure>
      <figcaption className="text-sm font-semibold text-slate-200">{title}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full rounded-lg border border-line bg-black/25" role="img" aria-label={`${title}, ${series.length} points`}>
        <path d={d} fill="none" stroke={color} strokeWidth="2" />
        {series.map((p) => (
          <g key={p.at}>
            <circle cx={x(p.at)} cy={y(p.value)} r="3.5" fill={p.point.stall ? '#fb923c' : color} />
            {p.point.transition && (
              <circle cx={x(p.at)} cy={y(p.value)} r="7" fill="none" stroke={MARK[p.point.transition] ?? color} strokeWidth="1.5" />
            )}
          </g>
        ))}
        <text x={pad.l} y={height - 6} fill="#64748b" fontSize="11">{clock(series[0].at)}</text>
        <text x={width - pad.r} y={height - 6} fill="#64748b" fontSize="11" textAnchor="end">{clock(series[series.length - 1].at)}</text>
      </svg>
      <p className="mt-1 font-data text-[11px] text-slate-400">
        First {format(series[0].value)} · Last {format(series[series.length - 1].value)}
        {series.some((p) => p.point.stall) ? ' · orange dot = head stalled' : ''}
        {series.some((p) => p.point.transition) ? ' · ring = degrade, recover, stall, or resume' : ''}
      </p>
    </figure>
  );
}

/** Session chart. Empty until the user has run at least two health checks. */
export function ScoreHistoryChart({
  snapshots,
  wsProbe,
  motion,
}: {
  snapshots: HealthCheckSnapshot[];
  wsProbe: SubstrateWsProbeResult | null;
  motion: ChainMotion | null;
}) {
  const points = useMemo(() => buildScoreHistory(snapshots, wsProbe, motion), [snapshots, wsProbe, motion]);
  return (
    <section id="score-history" aria-labelledby="score-history-title" className="instrument-panel scroll-mt-6">
      <div className="border-b border-line px-5 py-3">
        <h3 id="score-history-title" className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-400">
          Score history
        </h3>
      </div>
      <div className="space-y-4 bg-panel p-5">
        <p className="text-xs leading-relaxed text-slate-400">
          Drawn from the health checks in this session, newest endpoint only. Finality lag is the latest probe, not a guessed past. Nothing here polls.
        </p>
        {points.length < 2 ? (
          <p className="text-sm text-slate-400">Run a second health check or a Watch cycle to draw the chart.</p>
        ) : (
          <>
            <Series title="Health Score" points={points} read={(p) => p.score} format={(n) => String(n)} color="#ff5b14" />
            <Series title="Finality lag (blocks)" points={points} read={(p) => p.finalityLag} format={(n) => String(n)} color="#7dd3fc" />
            <Series title="Best head" points={points} read={(p) => (p.bestHeight && /^\d+$/.test(p.bestHeight) && Number.isSafeInteger(Number(p.bestHeight)) ? Number(p.bestHeight) : null)} format={(n) => n.toLocaleString('en-US')} color="#a3e635" />
          </>
        )}
      </div>
    </section>
  );
}
