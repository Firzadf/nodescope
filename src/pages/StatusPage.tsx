import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PaperHeader } from '../components/layout/PaperHeader';
import { BADGE_EVM_HOST, BADGE_WSS_HOST, FORMULA_V2 } from '../../shared/liveStatus.mjs';

interface PublicStatus {
  verdict: string;
  score: number | null;
  coverage?: number;
  formula?: string;
  checkedAt?: string;
  bestHeight?: string | null;
  finalizedHeight?: string | null;
  finalityLag?: number | null;
  peers?: number | null;
  isSyncing?: boolean | null;
  latencyMs?: number | null;
  chain?: string | null;
  explanation?: string;
  error?: string;
}

const NAV = [
  { href: '/', label: 'Landing' },
  { href: '/app', label: 'Launch App' },
  { href: '/status', label: 'Status' },
  { href: '/judges', label: 'Judges' },
  { href: '/verify', label: 'Verify' },
  { href: '/docs', label: 'Docs' },
];

const TONE: Record<string, string> = {
  healthy: 'text-emerald-400',
  degraded: 'text-amber-400',
  stalled: 'text-orange-300',
  down: 'text-red-400',
  not_checked: 'text-slate-400',
};

async function loadStatus(fresh: boolean): Promise<PublicStatus> {
  const path = fresh ? '/api/status?target=portaldot-v3-testnet&fresh=1' : '/api/status?target=portaldot-v3-testnet';
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (res.ok) return (await res.json()) as PublicStatus;
  } catch {
    // Vite preview has no serverless function. The same checker runs here.
  }
  const { liveBadgeStatus } = await import('../../api/badge.js');
  return liveBadgeStatus(`https://${BADGE_EVM_HOST}`, `wss://${BADGE_WSS_HOST}`) as Promise<PublicStatus>;
}

/**
 * Public testnet status. One check when the page opens, and again only
 * if the visitor presses Refresh. The hosts are the published testnet
 * pair; this page does not accept an arbitrary RPC.
 */
export function StatusPage() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nodescope.vercel.app';
  const badgeUrl = `${origin}/api/badge?target=portaldot-v3-testnet`;
  const markdown = `[![NodeScope](${badgeUrl})](${origin}/status)`;

  const apply = useCallback(async (fresh: boolean) => {
    setFailed(null);
    try {
      const next = await loadStatus(fresh);
      if (next.error) setFailed(next.error);
      else setStatus(next);
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'The status check failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadStatus(false)
      .then((next) => {
        if (cancelled) return;
        if (next.error) setFailed(next.error);
        else setStatus(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFailed(err instanceof Error ? err.message : 'The status check failed.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = () => {
    setLoading(true);
    void apply(true);
  };

  const word = (status?.verdict ?? 'not_checked').replace(/_/g, ' ').toUpperCase();

  return (
    <div className="paper min-h-screen bg-ink text-slate-200">
      <PaperHeader links={NAV} current="/status" />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">Portaldot V3 testnet</p>
        <h1 className="mt-2 font-display text-5xl text-white">Status</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          One read-only check of the published EVM RPC and WebSocket, run when this page opens. Press Refresh to check again. Nothing polls, and nothing is signed.
        </p>
        <div className="mt-8 rounded-xl border border-line bg-panel p-6">
          {loading && !status ? (
            <p className="inline-flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Checking the testnet…</p>
          ) : (
            <>
              <p className={`font-data text-3xl font-semibold tracking-[0.12em] ${TONE[status?.verdict ?? 'not_checked'] ?? 'text-slate-300'}`}>{word}</p>
              {status?.explanation && <p className="mt-2 text-sm text-slate-300">{status.explanation}</p>}
              <dl className="mt-6 grid grid-cols-2 gap-4 font-data text-sm md:grid-cols-3">
                <div><dt className="text-slate-500">Health Score</dt><dd className="text-white">{status?.score ?? '—'}/100</dd></div>
                <div><dt className="text-slate-500">Coverage</dt><dd className="text-white">{status?.coverage ?? '—'}%</dd></div>
                <div><dt className="text-slate-500">Best head</dt><dd className="text-white">{status?.bestHeight ?? '—'}</dd></div>
                <div><dt className="text-slate-500">Finalized</dt><dd className="text-white">{status?.finalizedHeight ?? '—'}</dd></div>
                <div><dt className="text-slate-500">Finality lag</dt><dd className="text-white">{status?.finalityLag ?? '—'}{status?.finalityLag != null ? ' blocks' : ''}</dd></div>
                <div><dt className="text-slate-500">Peers</dt><dd className="text-white">{status?.peers ?? '—'}</dd></div>
                <div><dt className="text-slate-500">Latency</dt><dd className="text-white">{status?.latencyMs == null ? '—' : `${status.latencyMs} ms`}</dd></div>
                <div><dt className="text-slate-500">Chain</dt><dd className="text-white">{status?.chain ?? '—'}</dd></div>
                <div><dt className="text-slate-500">Checked</dt><dd className="text-white">{status?.checkedAt ? new Date(status.checkedAt).toLocaleString() : '—'}</dd></div>
              </dl>
              <p className="mt-4 font-data text-[11px] text-slate-500">{status?.formula ?? FORMULA_V2}</p>
            </>
          )}
          {failed && <p className="mt-3 text-sm text-red-400">{failed}</p>}
          <button type="button" onClick={refresh} disabled={loading} className="btn-primary mt-6 px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {loading ? 'Checking…' : 'Refresh'}
          </button>
        </div>
        <div className="mt-8 rounded-xl border border-line bg-panel p-6">
          <h2 className="text-lg font-semibold text-white">Embed the badge</h2>
          <img alt="NodeScope status badge" src={badgeUrl} className="mt-4 h-5" />
          <code className="mt-4 block overflow-x-auto rounded-lg border border-line bg-black/30 px-3 py-2 font-data text-[12px] text-slate-300">{markdown}</code>
        </div>
      </main>
    </div>
  );
}
