import { useEffect, useState } from 'react';
import { formatTimeAgo, isStale } from '../../utils/relativeTime';
import { overallVerdictFrom, type OverallVerdict } from '../../utils/overallVerdict';
import type { HealthCheckSnapshot } from '../../types/healthCheck';
import type { SubstrateWsProbeResult } from '../../services/substrateWsProbe';
import type { EndpointProfile } from '../../types/endpoint';

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
  endpointProfile?: EndpointProfile;
}

/**
 * The probe result's host, shortened the way the bar names it: the default
 * Portaldot probe endpoint reads as "test-node-v3", anything else reads as
 * its real hostname so a custom probe URL is never mislabeled.
 */
function probeHostLabel(url: string | null): string {
  if (!url) return 'test-node-v3';
  const host = url.replace(/^wss?:\/\//, '').split('/')[0];
  return host.startsWith('test-node-v3.') ? 'test-node-v3' : host;
}

/**
 * Sticky verdict bar: one line that stays visible while scrolling Overview.
 * Every value is derived from results that already ran — the overall word
 * comes from overallVerdictFrom, which shares panel 07's EVM-side extraction.
 * With no data at all it reads NOT CHECKED YET, never DOWN.
 */
export function VerdictBar({ latestHealthSnapshot, wsProbeResult, latencyMs, latencyMethod, endpointProfile }: VerdictBarProps) {
  const overall = overallVerdictFrom(latestHealthSnapshot, wsProbeResult);
  const evmPassed = latestHealthSnapshot
    ? latestHealthSnapshot.checks.filter((c) => c.success).length
    : null;
  const evmTotal = latestHealthSnapshot ? latestHealthSnapshot.checks.length : null;
  const evmText = evmPassed === null ? 'No snapshot yet' : `${evmPassed}/${evmTotal} checks passed`;
  // On the EVM HTTP-only profile the bare "WSS" label reads as if the EVM
  // endpoint itself answered over WebSocket. Name the transport: the
  // probe always runs against the Substrate node, never the EVM RPC.
  const wssLabel = endpointProfile === 'portaldot_v3_evm'
    ? `Substrate WSS (${probeHostLabel(wsProbeResult?.url ?? null)})`
    : 'WSS';
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
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (latestHealthSnapshot === null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [latestHealthSnapshot]);
  const lastTs = latestHealthSnapshot !== null ? new Date(latestHealthSnapshot.timestamp).getTime() : null;
  const stale = lastTs !== null && isStale(lastTs, now);

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
          {wssLabel} <span className="text-slate-200 font-data">{wssText}</span>
        </span>
        <span className="text-xs text-slate-400">
          Latency{' '}
          <span className="text-slate-200 font-data">
            {latencyMs !== null ? `${latencyMs}ms` : '—'}
            {latencyMethod ? ` via ${latencyMethod}` : ''}
          </span>
        </span>
        <span className="text-xs text-slate-400">
          Last checked{' '}
          {lastTs !== null ? (
            <time dateTime={new Date(lastTs).toISOString()} title={lastChecked} className={`font-data ${stale ? 'text-amber-300' : 'text-slate-200'}`}>
              {formatTimeAgo(lastTs, now)}
              {stale ? ' · stale, re-run to refresh' : ''}
            </time>
          ) : (
            <span className="text-slate-200 font-data">—</span>
          )}
        </span>
      </div>
    </div>
  );
}
