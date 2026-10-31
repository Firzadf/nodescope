import { useEffect, useMemo } from 'react';
import { computeHealthScoreV2, HEALTH_SCORE_FORMULA_V2, type HealthScoreBand } from '../../utils/healthScore';
import type { HealthCheckSnapshot } from '../../types/healthCheck';
import type { SubstrateWsProbeResult } from '../../services/substrateWsProbe';
import type { ChainMotion } from '../../utils/stall';
import { stallFromSession } from '../../utils/stall';
import { parseBlockHeight } from '../../utils/snapshotComparer';
import { assessEndpointParity } from '../../../shared/endpointParity.mjs';
import { planOperatorActions } from '../../../shared/operatorActions.mjs';
import { compareToBaseline, readBaselines, recordBaseline, type BaselineSample } from '../../utils/baselines';
import { CustomWeighting } from './CustomWeighting';

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

function medianLatency(snapshot: HealthCheckSnapshot | undefined): number | null {
  const samples = (snapshot?.checks ?? [])
    .filter((c) => c.success && typeof c.latencyMs === 'number')
    .map((c) => c.latencyMs as number);
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function HealthScoreHero({ snapshots, wsProbe, motion = null, reliability = null, onRunHealthCheck, running = false }: HealthScoreHeroProps) {
  const score = useMemo(
    () => computeHealthScoreV2({ snapshots, wsProbe, motion, reliability }),
    [snapshots, wsProbe, motion, reliability],
  );
  const latest = useMemo(
    () => [...snapshots].sort((a, b) => b.timestamp - a.timestamp)[0],
    [snapshots],
  );
  const baselineSample = useMemo((): BaselineSample | null => {
    if (!latest) return null;
    const heightCheck = latest.checks.find((c) => c.method === 'eth_blockNumber' && c.success);
    const height = heightCheck ? parseBlockHeight(heightCheck.observedValue) : null;
    const wssRaw = wsProbe?.status === 'ok' ? wsProbe.headerNumberDecimal : null;
    const wssHeight = wssRaw && /^\d+$/.test(wssRaw) ? BigInt(wssRaw) : null;
    let headGap: number | null = null;
    if (height !== null && wssHeight !== null) {
      const delta = height - wssHeight;
      const abs = delta < 0n ? -delta : delta;
      headGap = Number(abs);
    }
    return {
      at: latest.timestamp,
      score: score.score,
      latencyMs: medianLatency(latest),
      bestHeight: height === null ? motion?.bestHeight ?? null : height.toString(),
      finalityLag: typeof wsProbe?.finalityLagBlocks === 'number' ? wsProbe.finalityLagBlocks : null,
      headGap,
    };
  }, [latest, score.score, wsProbe, motion]);
  const priorAbsGaps = useMemo(() => {
    if (!latest || !baselineSample) return [];
    return readBaselines(latest.endpointOrigin)
      .filter((sample) => sample.at !== baselineSample.at && typeof sample.headGap === 'number')
      .map((sample) => sample.headGap as number);
  }, [latest, baselineSample]);
  const parity = useMemo(
    () => assessEndpointParity({ snapshots, wsProbe, priorAbsGaps }),
    [snapshots, wsProbe, priorAbsGaps],
  );
  const stall = useMemo(() => stallFromSession(snapshots, wsProbe, motion), [snapshots, wsProbe, motion]);
  const plan = useMemo(
    () => planOperatorActions({ scope: 'self', score, stall, wsProbe, parity }),
    [score, stall, wsProbe, parity],
  );
  const baselineLines = useMemo(() => {
    if (!latest || !baselineSample) return ['Not enough local history yet for this endpoint. Samples stay in this browser only.'];
    const prior = readBaselines(latest.endpointOrigin).filter((sample) => sample.at !== baselineSample.at);
    return compareToBaseline(baselineSample, prior).lines;
  }, [latest, baselineSample]);
  useEffect(() => {
    if (!latest || !baselineSample) return;
    recordBaseline(latest.endpointOrigin, baselineSample);
  }, [latest, baselineSample]);

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
          <ul className="mt-4 grid grid-cols-2 gap-2" aria-label="Health Score components">
            {score.components.map((c) => {
              const headline = c.id === 'transport_parity';
              return (
                <li key={c.id} className={`border px-2 py-1.5 ${headline ? 'border-signal bg-signal/10' : 'border-line'}`}>
                  <p className="font-data text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    {headline ? 'WSS parity · headline' : c.label}
                  </p>
                  <p className="font-data text-sm text-white">
                    {c.points === null ? '—' : c.points}
                    <span className="text-slate-500">/{c.weight}</span>
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 border border-line bg-black/20 p-3">
            <p className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">Next step · your node</p>
            <p className="mt-1 text-sm font-semibold text-white">{plan.overall.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">{plan.overall.nextStep}</p>
            {plan.degradation && <p className="mt-2 text-sm leading-relaxed text-orange-200">{plan.degradation}</p>}
          </div>
          <div className={`mt-3 border p-3 ${parity.status === 'persistent_gap' ? 'border-signal' : parity.status === 'gap_once' ? 'border-amber-500/60' : 'border-line'}`}>
            <p className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">WSS parity · two-endpoint check</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">{parity.summary}</p>
          </div>
          <div className="mt-3 border border-line p-3">
            <p className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">Your baseline · this browser</p>
            {baselineLines.map((line) => (
              <p key={line} className="mt-1 text-sm leading-relaxed text-slate-300">{line}</p>
            ))}
          </div>
          {plan.finalityEpoch && (
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{plan.finalityEpoch.note}</p>
          )}
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
              const pct = c.points === null || c.weight === 0 ? 0 : (c.points / c.weight) * 100;
              const step = plan.components.find((item) => item.id === c.id);
              const headline = c.id === 'transport_parity';
              return (
                <li key={c.id} className={`py-3 ${headline ? 'border-l-2 border-signal pl-3' : ''}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-sm text-slate-200">
                      <span className="mr-2 font-data text-[11px] text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                      {c.label}
                      {headline && <span className="ml-2 font-data text-[10px] uppercase tracking-[0.14em] text-signal-ink">Headline</span>}
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
                  {step && <p className="mt-1 text-[12px] leading-relaxed text-slate-200">Next: {step.action.nextStep}</p>}
                </li>
              );
            })}
          </ol>
          <CustomWeighting score={score} />
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
