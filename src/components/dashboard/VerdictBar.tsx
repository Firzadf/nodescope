import { overallVerdictFrom, type OverallVerdict } from '../../utils/overallVerdict';
import type { HealthCheckSnapshot } from '../../types/healthCheck';
import type { SubstrateWsProbeResult } from '../../services/substrateWsProbe';

const LABEL: Record<OverallVerdict, string> = {
  healthy: 'HEALTHY',
  degraded: 'DEGRADED',
  down: 'DOWN',
  not_checked: 'NOT CHECKED YET',
};

const COLOR: Record<OverallVerdict, string> = {
  healthy: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  degraded: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  down: 'text-red-400 border-red-500/30 bg-red-500/10',
  not_checked: 'text-slate-400 border-line bg-white/[0.03]',
};

interface VerdictBarProps {
  latestHealthSnapshot: HealthCheckSnapshot | null;
  wsProbeResult: SubstrateWsProbeResult | null;
  latencyMs: number | null;
  latencyMethod?: string;
}

/**
 * Sticky verdict bar: one line that stays visible while scrolling Overview.
 * Every value is derived from results that already ran — the overall word
 * comes from overallVerdictFrom, which shares panel 07's EVM-side extraction.
 * With no data at all it reads NOT CHECKED YET, never DOWN.
 */
export function VerdictBar({ latestHealthSnapshot, wsProbeResult, latencyMs, latencyMethod }: VerdictBarProps) {
  const overall = overallVerdictFrom(latestHealthSnapshot, wsProbeResult);
  const evmPassed = latestHealthSnapshot
    ? latestHealthSnapshot.checks.filter((c) => c.success).length
    : null;
  const evmTotal = latestHealthSnapshot ? latestHealthSnapshot.checks.length : null;
  const evmText = evmPassed === null ? 'No snapshot yet' : `${evmPassed}/${evmTotal} checks passed`;
  const wssText =
    wsProbeResult === null
      ? 'No probe yet'
      : wsProbeResult.status === 'ok'
        ? 'Answered'
        : 'Failed';
  const lastChecked =
    latestHealthSnapshot !== null
      ? new Date(latestHealthSnapshot.timestamp).toLocaleString()
      : '—';

  return (
    <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-ink/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-panel px-4 py-3">
        <span className={`inline-flex items-center rounded-full border px-3 py-1 font-data text-[11px] font-semibold tracking-[0.16em] ${COLOR[overall]}`}>
          {LABEL[overall]}
        </span>
        <span className="text-xs text-slate-400">
          EVM <span className="text-slate-200 font-data">{evmText}</span>
        </span>
        <span className="text-xs text-slate-400">
          WSS <span className="text-slate-200 font-data">{wssText}</span>
        </span>
        <span className="text-xs text-slate-400">
          Latency{' '}
          <span className="text-slate-200 font-data">
            {latencyMs !== null ? `${latencyMs}ms` : '—'}
            {latencyMethod ? ` via ${latencyMethod}` : ''}
          </span>
        </span>
        <span className="text-xs text-slate-400">
          Last checked <span className="text-slate-200 font-data">{lastChecked}</span>
        </span>
      </div>
    </div>
  );
}
