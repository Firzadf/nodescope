import type { HealthCheckSnapshot } from '../../types/healthCheck';
import { getV3Era, v3EraLabel } from '../../utils/v3Era';

interface SnapshotStripProps {
  snapshots: HealthCheckSnapshot[];
}

/**
 * Uptime-style strip of this session's health checks (oldest → newest).
 * One cell per snapshot; tone reflects how many of its checks passed.
 * Renders nothing until at least one snapshot exists.
 */
export function SnapshotStrip({ snapshots }: SnapshotStripProps) {
  if (snapshots.length === 0) return null;

  const ordered = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">Session strip</p>
        <p className="font-data text-[10px] uppercase tracking-[0.14em] text-slate-600">
          {ordered.length} check{ordered.length === 1 ? '' : 's'} this session
        </p>
      </div>
      <div className="mt-2 flex gap-1" role="img" aria-label={`${ordered.length} health checks this session`}>
        {ordered.map((s, i) => {
          const passed = s.checks.filter((c) => c.success).length;
          const total = s.checks.length;
          const block = s.checks.find((c) => c.method === 'eth_blockNumber')?.observedValue;
          const tone =
            passed === total
              ? 'bg-emerald-400/80'
              : passed >= Math.ceil(total / 2)
                ? 'bg-amber-400/80'
                : 'bg-red-400/80';
          return (
            <div
              key={s.id}
              title={`${new Date(s.timestamp).toLocaleTimeString()} · ${v3EraLabel(getV3Era(s.timestamp))} · block ${block ?? '—'} · ${passed}/${total} checks passed`}
              style={{ animationDelay: `${Math.min(i * 45, 600)}ms` }}
              className={`strip-cell-in h-7 min-w-[10px] flex-1 rounded-[4px] ${tone}`}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between font-data text-[10px] text-slate-600">
        <span>{new Date(first.timestamp).toLocaleTimeString()}</span>
        <span>{new Date(last.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
