import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { checkFleetTarget, DEFAULT_FLEET, type FleetTarget } from '../../services/fleetCheck';
import { flagMostBehind, sortFleet, type FleetRow, type FleetSortKey } from '../../utils/fleet';
import { WATCH_INTERVALS, type WatchInterval } from '../../utils/alertWebhook';
import { validateRpcUrl } from '../../utils/urlValidator';

function kindFor(url: string): FleetTarget['kind'] | null {
  try {
    const protocol = new URL(url).protocol;
    if (protocol === 'https:' || protocol === 'http:') return 'evm';
    if (protocol === 'wss:' || protocol === 'ws:') return 'wss';
  } catch {
    return null;
  }
  return null;
}

const COLUMNS: Array<{ key: FleetSortKey; label: string }> = [
  { key: 'label', label: 'Node' },
  { key: 'verdict', label: 'Verdict' },
  { key: 'score', label: 'Score' },
  { key: 'block', label: 'Block' },
  { key: 'finalityLag', label: 'Lag' },
  { key: 'peers', label: 'Peers' },
  { key: 'latencyMs', label: 'Latency' },
];

/**
 * Several endpoints, checked only when the user asks. Watch reuses the
 * same 30s floor as the single-node watch. No method lists are shown.
 */
export function FleetPanel() {
  const [targets, setTargets] = useState<FleetTarget[]>(DEFAULT_FLEET);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FleetRow[]>([]);
  const [running, setRunning] = useState(false);
  const [sortKey, setSortKey] = useState<FleetSortKey>('block');
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc');
  const [watching, setWatching] = useState(false);
  const [interval, setIntervalSec] = useState<WatchInterval>(60);
  const targetsRef = useRef(targets);
  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  const shown = useMemo(() => sortFleet(flagMostBehind(rows), sortKey, direction), [rows, sortKey, direction]);

  const checkAll = async (list: FleetTarget[]) => {
    setRunning(true);
    setError(null);
    const next = await Promise.all(list.map((target) => checkFleetTarget(target)));
    setRows(next);
    setRunning(false);
  };

  useEffect(() => {
    if (!watching) return;
    let timer = 0;
    let cancelled = false;
    const tick = async () => {
      const next = await Promise.all(targetsRef.current.map((target) => checkFleetTarget(target)));
      if (!cancelled) setRows(next);
      if (!cancelled) timer = window.setTimeout(() => void tick(), interval * 1000);
    };
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [watching, interval]);

  const add = () => {
    const url = draft.trim();
    const kind = kindFor(url);
    if (!kind) {
      setError('Use an https:// or wss:// URL.');
      return;
    }
    if (kind === 'evm' && !validateRpcUrl(url).isValid) {
      setError(validateRpcUrl(url).error ?? 'That URL is not valid.');
      return;
    }
    if (kind === 'wss') {
      const host = new URL(url).hostname;
      const local = host === 'localhost' || host === '127.0.0.1';
      if (new URL(url).protocol === 'ws:' && !local) {
        setError('Remote WebSocket checks use wss://.');
        return;
      }
    }
    if (targets.some((t) => t.url === url)) {
      setError('That endpoint is already in the list.');
      return;
    }
    setTargets((prev) => [...prev, { id: `${kind}-${prev.length}`, label: new URL(url).host, url, kind }]);
    setDraft('');
    setError(null);
  };

  const toggleSort = (key: FleetSortKey) => {
    if (sortKey === key) setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setDirection(key === 'label' ? 'asc' : 'desc');
    }
  };

  return (
    <section id="fleet" className="space-y-4">
      <div>
        <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">Several nodes, one table</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Multi-node</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          The published EVM RPC and WebSocket are listed already. Add your own endpoints, then press Check all. Checks on one endpoint stay under 5 requests per second. The node with the lowest head is marked behind. Nothing runs until you ask.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="Endpoint URL"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://… or wss://…"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-line bg-black/30 px-3 py-2 font-data text-sm text-slate-100"
        />
        <button type="button" onClick={add} className="btn-ghost rounded-lg px-4 py-2 text-sm">Add endpoint</button>
        <button type="button" onClick={() => void checkAll(targets)} disabled={running} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {running ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</span> : 'Check all'}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">Watch</span>
        {WATCH_INTERVALS.map((s) => (
          <button key={s} type="button" aria-pressed={interval === s} disabled={watching} onClick={() => setIntervalSec(s)} className={`rounded-md border border-line px-2 py-1 font-data text-[11px] ${interval === s ? 'bg-signal text-ink' : 'text-slate-300'}`}>
            {s < 60 ? `${s}s` : `${s / 60}m`}
          </button>
        ))}
        <button type="button" onClick={() => setWatching((w) => !w)} className={`${watching ? 'btn-ghost' : 'btn-primary'} px-3 py-1.5 text-sm font-semibold`}>
          {watching ? 'Stop watch' : 'Start watch'}
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line font-data text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-3 py-2 font-medium">
                  <button type="button" onClick={() => toggleSort(col.key)} className="hover:text-white">
                    {col.label}{sortKey === col.key ? (direction === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-slate-500">No check yet.</td></tr>
            ) : shown.map((row) => (
              <tr key={row.id} className={`border-b border-line ${row.behind ? 'bg-amber-500/10' : ''}`}>
                <td className="px-3 py-3">
                  <div className="text-white">{row.label}</div>
                  <div className="max-w-[220px] truncate font-data text-[11px] text-slate-500">{row.url}</div>
                  {row.behind && <div className="mt-1 text-[11px] text-amber-300">Most behind</div>}
                  {row.error && <div className="mt-1 text-[11px] text-red-300">{row.error}</div>}
                </td>
                <td className="px-3 py-3 font-data text-slate-200">{row.verdict.replace('_', ' ').toUpperCase()}</td>
                <td className="px-3 py-3 font-data">{row.score ?? '—'}</td>
                <td className="px-3 py-3 font-data">{row.block ?? '—'}</td>
                <td className="px-3 py-3 font-data">{row.finalityLag ?? '—'}</td>
                <td className="px-3 py-3 font-data">{row.peers ?? '—'}</td>
                <td className="px-3 py-3 font-data">{row.latencyMs === null ? '—' : `${row.latencyMs} ms`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
