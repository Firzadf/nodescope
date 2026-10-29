import { useMemo } from 'react';
import { computeHealthScoreV2, HEALTH_SCORE_FORMULA_V2, type HealthScoreBand } from '../../utils/healthScore';
import type { HealthCheckSnapshot } from '../../types/healthCheck';
import type { SubstrateWsProbeResult } from '../../services/substrateWsProbe';
import type { ChainMotion } from '../../utils/stall';
import { parseBlockHeight } from '../../utils/snapshotComparer';

interface HealthScoreHeroProps {
  snapshots: HealthCheckSnapshot[];
  wsProbe: SubstrateWsProbeResult | null;
  motion?: ChainMotion | null;
  reliability?: { samples: number; errors: number; http5xx?: number; p50Ms: number | null; p95Ms: number | null } | null;
  onRunHealthCheck?: () => void;
  running?: boolean;
}

const BAND_LABEL: Record<HealthScoreBand, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  critical: 'Critical',
};

const BAND_TONE: Record<HealthScoreBand, string> = {
  healthy: 'text-emerald-400',
  degraded: 'text-amber-400',
  critical: 'text-red-400',
};

/**
 * Oscilloscope trace from REAL session data: one point per snapshot of the
 * newest endpoint, oldest → newest. With fewer than two points it draws a
 * flat baseline and says why, instead of a decorative fake wave.
 */
function Trace({ values, label, unit }: { values: number[]; label: string; unit: string }) {
  const w = 240;
  const h = 56;
  const pad = 4;
  const has = values.length >= 2;
  const min = has ? Math.min(...values) : 0;
  const max = has ? Math.max(...values) : 1;
  const span = max - min || 1;
  const pts = has
    ? values
        .map((v, i) => {
          const x = pad + (i * (w - pad * 2)) / (values.length - 1);
          const y = h - pad - ((v - min) / span) * (h - pad * 2);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ')
    : '';
  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between gap-2 font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">
        <span>{label}</span>
        <span className="text-slate-300">{has ? `${values[values.length - 1].toLocaleString('en-US')} ${unit}` : '—'}</span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="scope mt-2 h-14 w-full" role="img" aria-label={has ? `${label}: ${values.length} samples` : `${label}: needs two snapshots`}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} className="scope-grid" />
        ))}
        {has ? (
          <polyline points={pts} fill="none" className="scope-trace" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        ) : (
          <line x1={pad} x2={w - pad} y1={h / 2} y2={h / 2} className="scope-flat" strokeDasharray="2 4" />
        )}
      </svg>
      {!has && <p className="mt-1 font-data text-[10px] text-slate-500">Needs 2 snapshots on one endpoint.</p>}
    </figure>
  );
}

export function HealthScoreHero({ snapshots, wsProbe, motion = null, reliability = null, onRunHealthCheck, running = false }: HealthScoreHeroProps) {
  const score = useMemo(
    () => computeHealthScoreV2({ snapshots, wsProbe, motion, reliability }),
    [snapshots, wsProbe, motion, reliability],
  );

  const series = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
    const latest = sorted[sorted.length - 1];
    const same = latest
      ? sorted.filter((s) => s.endpointOrigin === latest.endpointOrigin && s.endpointProfile === latest.endpointProfile).slice(-24)
      : [];
    const heights: number[] = [];
    const latencies: number[] = [];
    for (const s of same) {
      const b = s.checks.find((c) => c.method === 'eth_blockNumber' && c.success);
      const h = b ? parseBlockHeight(b.observedValue) : null;
      if (h !== null) heights.push(Number(h));
      const ls = s.checks.filter((c) => c.success && typeof c.latencyMs === 'number').map((c) => c.latencyMs as number);
      if (ls.length) latencies.push(Math.round(ls.reduce((a, v) => a + v, 0) / ls.length));
    }
    return { heights, latencies };
  }, [snapshots]);

  const display = score.score === null ? '––' : String(score.score);

  return (
    <section aria-labelledby="health-score-title" className="instrument-panel relative overflow-hidden">
      <div className="grid gap-px bg-line lg:grid-cols-12">
        {/* Readout */}
        <div className="bg-panel p-5 md:p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="health-score-title" className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-400">
              Health Score
            </h2>
            <a href="/docs#health-score" className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500 underline decoration-slate-600 underline-offset-4 hover:text-slate-200">
              Formula ↗
            </a>
          </div>
          <div className="mt-3 flex items-end gap-3">
            <p className="score-numeral font-data leading-none text-white" aria-live="polite">
              <span className="sr-only">Health Score </span>
              {display}
              <span className="sr-only">{score.score === null ? ' (not scored)' : ' out of 100'}</span>
            </p>
            <p aria-hidden="true" className="pb-2 font-data text-lg text-slate-500">/100</p>
          </div>
          <p className="mt-3 font-data text-[12px] text-slate-400">
            {score.band ? (
              <span className={`font-semibold uppercase tracking-[0.16em] ${BAND_TONE[score.band]}`}>{BAND_LABEL[score.band]}</span>
            ) : (
              <span className="font-semibold uppercase tracking-[0.16em] text-slate-300">Not scored</span>
            )}
            <span className="text-slate-600"> · </span>
            coverage <span className="text-slate-200">{score.coverage}%</span>
            <span className="text-slate-600"> · </span>
            <span className="text-slate-500">{HEALTH_SCORE_FORMULA_V2}</span>
          </p>
          {score.score === null && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-sm leading-relaxed text-slate-400">
                {snapshots.length === 0
                  ? 'No measurement yet. Run a health check to score the node; a score needs at least 50% of the formula measured.'
                  : 'Less than half of the formula is measured, so no number is shown. Run another health check and the Substrate probe.'}
              </p>
              {onRunHealthCheck && (
                <button type="button" onClick={onRunHealthCheck} disabled={running} className="btn-primary mt-3 px-4 py-2 text-sm font-semibold">
                  {running ? 'Running…' : 'Run first health check'}
                </button>
              )}
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
            <Trace values={series.heights} label="Block height" unit="" />
            <Trace values={series.latencies} label="Mean latency" unit="ms" />
          </div>
        </div>

        {/* Components */}
        <div className="bg-panel p-5 md:p-6 lg:col-span-7">
          <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-400">Where every point comes from</p>
          <ol className="mt-3 divide-y divide-line">
            {score.components.map((c, i) => {
              const pct = c.points === null ? 0 : (c.points / c.weight) * 100;
              return (
                <li key={c.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-sm text-slate-200">
                      <span className="mr-2 font-data text-[11px] text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                      {c.label}
                    </p>
                    <p className="shrink-0 font-data text-sm tabular-nums text-slate-200">
                      {c.points === null ? <span className="text-slate-500">not measured</span> : c.points}
                      <span className="text-slate-500"> / {c.weight}</span>
                    </p>
                  </div>
                  <div className="meter mt-2" aria-hidden="true">
                    <span className={c.measured ? 'meter-fill' : 'meter-empty'} style={{ width: `${c.measured ? pct : 100}%` }} />
                  </div>
                  <p className="mt-1.5 font-data text-[11px] leading-relaxed text-slate-500">{c.detail}</p>
                </li>
              );
            })}
          </ol>
          <details className="disclosure mt-2">
            <summary className="cursor-pointer font-data text-[11px] uppercase tracking-[0.18em] text-slate-400 hover:text-slate-200">
              Raw score object (goes into the next exported report)
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-line bg-black/30 p-3 font-data text-[11px] leading-relaxed text-slate-400">
              {JSON.stringify(score, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </section>
  );
}
