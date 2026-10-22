import { useMemo } from 'react';
import { TrendingUp, CheckCircle2, AlertTriangle, XCircle, PauseCircle, GitBranch } from 'lucide-react';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import { SnapshotStrip } from './SnapshotStrip';
import type { HealthCheckSnapshot } from '../../types/healthCheck';
import {
  BLOCK_INTERVAL_NOTE,
  computeSessionTrends,
  type SessionTrends,
  type VerdictLevel,
  type VerdictRuleResult,
} from '../../utils/sessionTrends';

interface SessionTrendsPanelProps {
  snapshots: HealthCheckSnapshot[];
}

function fmtMs(value: number | null): string {
  if (value === null) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function fmtSeconds(value: number | null): string {
  if (value === null) return '—';
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

function clock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

const VERDICT_STYLE: Record<VerdictLevel, { word: string; text: string; Icon: typeof CheckCircle2 }> = {
  healthy: { word: 'HEALTHY', text: 'text-emerald-400', Icon: CheckCircle2 },
  degraded: { word: 'DEGRADED', text: 'text-amber-400', Icon: AlertTriangle },
  unstable: { word: 'UNSTABLE', text: 'text-red-400', Icon: XCircle },
  insufficient_data: { word: 'INSUFFICIENT DATA', text: 'text-slate-400', Icon: PauseCircle },
};

function RuleRow({ rule, index }: { rule: VerdictRuleResult; index: number }) {
  const tag = !rule.evaluated
    ? { label: 'NOT EVALUATED', cls: 'bg-slate-800 text-slate-400 border-line' }
    : rule.fired
      ? rule.effect === 'unstable'
        ? { label: 'FIRED', cls: 'bg-red-500/10 text-red-400 border-red-500/30' }
        : { label: 'FIRED', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' }
      : { label: 'CLEAR', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };

  return (
    <div className="bg-slate-900 border border-line rounded p-3 text-xs space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-data text-slate-600">[{String(index + 1).padStart(3, '0')}]</span>
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${tag.cls}`}>{tag.label}</span>
        <span className="text-slate-500 font-data text-[11px]">{rule.ruleId}</span>
        <span className="text-slate-500 text-[11px] uppercase tracking-wider">
          → {rule.effect === 'unstable' ? 'Unstable' : 'Degraded'} if fired
        </span>
      </div>
      <p className="text-slate-300 leading-relaxed">{rule.description}</p>
      <p className="font-data text-[11.5px] text-slate-400 break-words">
        <span className="text-slate-500">Evidence: </span>
        {rule.evidence}
      </p>
    </div>
  );
}

function PanelHeader() {
  return (
    <div className="border-b border-line pb-4">
      <PanelLabel index="05" label="TRENDS & VERDICT" />
      <h3 className="text-lg font-semibold text-white flex items-center gap-2 mt-2">
        <TrendingUp className="w-5 h-5 text-slate-400" />
        Session Trends &amp; Verdict
      </h3>
      <p className="text-xs text-slate-400 mt-1">
        Computed only from the health checks you ran this session, for one endpoint at a time. The verdict is
        deterministic — every rule behind it is printed below with its evidence. No score, no polling.
      </p>
    </div>
  );
}

export function SessionTrendsPanel({ snapshots }: SessionTrendsPanelProps) {
  const trends: SessionTrends = useMemo(() => computeSessionTrends(snapshots), [snapshots]);
  const groupSnapshots = useMemo(
    () => snapshots.filter((s) => trends.snapshotIds.includes(s.id)),
    [snapshots, trends.snapshotIds]
  );

  if (trends.status === 'insufficient_data') {
    return (
      <Card ticks>
        <div id="session-trends" className="space-y-4 scroll-mt-6">
          <PanelHeader />
          {groupSnapshots.length > 0 && <SnapshotStrip snapshots={groupSnapshots} />}
          <div className="empty-shell px-5 py-6 flex items-start gap-4">
            <TrendingUp className="w-5 h-5 text-slate-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">Insufficient data</p>
              <p className="text-sm font-medium text-slate-300 mt-1.5">{trends.reason}</p>
              <p className="text-xs text-slate-500 mt-1">
                {snapshots.length === 0
                  ? 'Trigger "Run Health Check" to start the session record.'
                  : `Currently ${trends.snapshotCount} health check(s) recorded for the current endpoint${
                      trends.excludedSnapshotCount > 0
                        ? ` · ${trends.excludedSnapshotCount} snapshot(s) belong to other endpoints and are never mixed into a trend`
                        : ''
                    }. Trends and the verdict appear once a second check lands.`}
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const verdictStyle = VERDICT_STYLE[trends.verdict.level];
  const VerdictIcon = verdictStyle.Icon;
  const firedCount = trends.verdict.rules.filter((r) => r.fired).length;
  const prog = trends.blockProgression;
  const passPercent =
    trends.passRate.ratio !== null ? `${Math.round(trends.passRate.ratio * 100)}%` : '—';

  return (
    <Card ticks>
      <div id="session-trends" className="space-y-6 scroll-mt-6">
        <PanelHeader />

        {trends.excludedSnapshotCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
            <p>
              Trends below cover only <code className="font-data text-amber-200">{trends.endpointOrigin}</code> (
              {trends.endpointProfile}) — the endpoint of your most recent check.{' '}
              {trends.excludedSnapshotCount} snapshot(s) from other endpoints are excluded, never mixed into a
              trend line.
            </p>
          </div>
        )}

        {/* Verdict banner — the word, then every rule that produced it. */}
        <div
          key={`${trends.verdict.level}-${trends.snapshotCount}`}
          className="state-swap bg-black/25 border border-line rounded-lg p-4 space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <VerdictIcon className={`w-8 h-8 ${verdictStyle.text}`} />
              <div>
                <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  Session verdict — deterministic
                </p>
                <p className={`text-3xl font-bold tracking-tight ${verdictStyle.text}`}>{verdictStyle.word}</p>
              </div>
            </div>
            <div className="font-data text-[11px] text-slate-500 space-y-0.5 md:text-right">
              <p>
                {trends.snapshotCount} health checks · {trends.passRate.total} method checks
              </p>
              <p>
                {firedCount === 0
                  ? 'No rule fired'
                  : `${firedCount} rule${firedCount === 1 ? '' : 's'} fired — see evidence below`}
              </p>
              <p className="break-all">{trends.endpointOrigin}</p>
            </div>
          </div>
          <div className="space-y-2">
            {trends.verdict.rules.map((rule, i) => (
              <RuleRow key={rule.ruleId} rule={rule} index={i} />
            ))}
          </div>
        </div>

        {/* Session stat strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-xl overflow-hidden">
          <div className="bg-panel p-4">
            <p className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">Checks in session</p>
            <p className="value-pop font-data text-xl font-semibold text-white mt-1.5" key={trends.snapshotCount}>
              {trends.snapshotCount}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">snapshots, one endpoint</p>
          </div>
          <div className="bg-panel p-4">
            <p className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">Session window</p>
            <p className="font-data text-sm font-semibold text-white mt-2">
              {trends.firstTimestamp !== null ? clock(trends.firstTimestamp) : '—'} →{' '}
              {trends.lastTimestamp !== null ? clock(trends.lastTimestamp) : '—'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {trends.firstTimestamp !== null && trends.lastTimestamp !== null
                ? `${fmtSeconds((trends.lastTimestamp - trends.firstTimestamp) / 1000)} s of observation`
                : ''}
            </p>
          </div>
          <div className="bg-panel p-4">
            <p className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">Pass rate</p>
            <p className="font-data text-xl font-semibold text-white mt-1.5">
              {trends.passRate.passed}/{trends.passRate.total}
              <span className="text-slate-400 text-sm"> · {passPercent}</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">unsupported methods count as not passed, never as failures</p>
          </div>
          <div className="bg-panel p-4">
            <p className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">Median block interval</p>
            <p className="font-data text-xl font-semibold text-white mt-1.5">
              {prog.medianSecondsPerBlock !== null ? `${fmtSeconds(prog.medianSecondsPerBlock)} s/block` : '—'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">estimate — see note below</p>
          </div>
        </div>

        {/* Block progression */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-slate-500" />
              Block Progression
            </h4>
            <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">
              [ Fig. 01 — {prog.method ?? 'block height'} ]
            </span>
          </div>
          <SnapshotStrip snapshots={groupSnapshots} />
          {prog.points.length >= 2 ? (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs pt-1">
                <span className="text-slate-400">
                  First: <code className="text-slate-200 font-data">{prog.points[0].height}</code>
                </span>
                <span className="text-slate-400">
                  Last: <code className="text-slate-200 font-data">{prog.points[prog.points.length - 1].height}</code>
                </span>
                <span className="text-slate-400">
                  Total delta:{' '}
                  <span className="text-gradient font-data font-bold text-sm">
                    {`${prog.totalDelta !== null && !prog.totalDelta.startsWith('-') ? '+' : ''}${prog.totalDelta} blocks`}
                  </span>
                </span>
              </div>
              <div className="max-h-[180px] overflow-y-auto pr-1 space-y-1.5">
                {prog.intervals.map((interval) => (
                  <div
                    key={`${interval.fromSnapshotId}-${interval.toSnapshotId}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-0.5 bg-slate-900/60 border border-line/60 rounded px-2.5 py-1.5 font-data text-[11px] text-slate-400"
                  >
                    <span>
                      {clock(interval.fromTimestamp)} → {clock(interval.toTimestamp)}
                    </span>
                    <span className="text-slate-300">
                      Δ {interval.blockDelta.startsWith('-') ? '' : '+'}
                      {interval.blockDelta} blocks
                    </span>
                    <span>gap {fmtSeconds(interval.gapSeconds)} s</span>
                    <span>
                      {interval.secondsPerBlock !== null
                        ? `≈ ${fmtSeconds(interval.secondsPerBlock)} s/block (est.)`
                        : 'no estimate — height did not advance'}
                    </span>
                  </div>
                ))}
              </div>
              {prog.stalls.map((stall) => (
                <div
                  key={`stall-${stall.earlierSnapshotId}-${stall.laterSnapshotId}`}
                  className="bg-amber-500/5 border border-amber-500/25 rounded-lg p-3 text-xs text-amber-200/90"
                >
                  <span className="font-semibold">Stall finding: </span>
                  block height unchanged at <code className="font-data">{stall.height}</code> between two
                  consecutive checks ({fmtSeconds(stall.gapSeconds)} s apart).
                </div>
              ))}
              {prog.regressions.map((regression) => (
                <div
                  key={`regression-${regression.earlierSnapshotId}-${regression.laterSnapshotId}`}
                  className="bg-red-500/5 border border-red-500/25 rounded-lg p-3 text-xs text-red-200/90"
                >
                  <span className="font-semibold">Regression finding: </span>
                  block height decreased <code className="font-data">{regression.fromHeight}</code> →{' '}
                  <code className="font-data">{regression.toHeight}</code> between consecutive checks.
                </div>
              ))}
              <p className="text-[11px] leading-relaxed text-slate-500">{BLOCK_INTERVAL_NOTE}</p>
            </>
          ) : (
            <p className="text-xs text-slate-500 italic">
              Fewer than 2 usable block heights in this session — progression unavailable. A failed or
              unsupported block check contributes no point and is never treated as height 0.
            </p>
          )}
        </div>

        {/* Latency trends */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-semibold text-slate-300">Latency Trends by Method</h4>
            <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">
              [ Fig. 02 — Recorded response times ]
            </span>
          </div>
          <div className="overflow-x-auto border border-line rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 border-b border-line text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Method</th>
                  <th className="p-2.5">Samples</th>
                  <th className="p-2.5">Min</th>
                  <th className="p-2.5">Median</th>
                  <th className="p-2.5">Max</th>
                  <th className="p-2.5">Last</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40 font-mono">
                {trends.methods.map((m) => (
                  <tr key={m.method} className="hover:bg-slate-900/50">
                    <td className="p-2.5 text-slate-200 font-data font-medium">{m.method}</td>
                    <td className="p-2.5 text-slate-300">{m.samples}</td>
                    <td className="p-2.5 text-slate-300">{m.minMs !== null ? `${fmtMs(m.minMs)} ms` : '—'}</td>
                    <td className="p-2.5 text-slate-100 font-medium">{m.medianMs !== null ? `${fmtMs(m.medianMs)} ms` : '—'}</td>
                    <td className="p-2.5 text-slate-300">{m.maxMs !== null ? `${fmtMs(m.maxMs)} ms` : '—'}</td>
                    <td className="p-2.5 text-slate-300">{m.lastMs !== null ? `${fmtMs(m.lastMs)} ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-500">
            Samples count every recorded response time for the method, including calls that ultimately failed —
            a failed call still took as long as it took.
          </p>
        </div>
      </div>
    </Card>
  );
}
