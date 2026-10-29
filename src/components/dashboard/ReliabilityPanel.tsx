import { useState } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import { runReliabilityProbe, type ReliabilityReport } from '../../services/reliabilityProbe';

interface ReliabilityPanelProps {
  endpoint: string;
  initial?: ReliabilityReport | null;
  onResult?: (report: ReliabilityReport) => void;
}

/**
 * Repeated read-only calls, one old-block history check, and rpc_methods.
 * Unsafe names are listed. None of them are invoked.
 */
export function ReliabilityPanel({ endpoint, initial = null, onResult }: ReliabilityPanelProps) {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ReliabilityReport | null>(initial);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const next = await runReliabilityProbe(endpoint);
      setReport(next);
      onResult?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Probe failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card ticks>
      <div className="space-y-4">
        <PanelLabel index="09" label="RPC RELIABILITY" />
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <ShieldAlert className="h-5 w-5 text-slate-400" />
          Reliability, history, and exposed methods
        </h3>
        <p className="text-xs leading-relaxed text-slate-400">
          Six <code className="font-data text-slate-300">eth_blockNumber</code> calls for the error rate and latency spread,
          one header and one balance about 10,000 blocks back for archival-versus-pruned, and <code className="font-data text-slate-300">rpc_methods</code> to
          list unsafe operator methods. Those methods are named, never called. On the published Portaldot testnet hosts the names are withheld.
        </p>
        <button type="button" onClick={() => void run()} disabled={running || !endpoint} className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-300 disabled:opacity-50">
          {running ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Probing…</span> : 'Run reliability probe'}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {report && (
          <div className="space-y-3 rounded-lg border border-line bg-black/25 p-4 text-sm">
            <dl className="grid grid-cols-2 gap-3 font-data text-xs md:grid-cols-4">
              <div><dt className="text-slate-500">Samples</dt><dd className="mt-0.5 text-slate-200">{report.errors}/{report.samples} failed</dd></div>
              <div><dt className="text-slate-500">HTTP 5xx</dt><dd className="mt-0.5 text-slate-200">{report.http5xx}</dd></div>
              <div><dt className="text-slate-500">p50 / p95</dt><dd className="mt-0.5 text-slate-200">{report.p50Ms ?? '—'} / {report.p95Ms ?? '—'} ms</dd></div>
              <div><dt className="text-slate-500">Spread</dt><dd className="mt-0.5 text-slate-200">{report.spreadMs ?? '—'} ms</dd></div>
              <div><dt className="text-slate-500">History</dt><dd className="mt-0.5 text-slate-200">{report.history}</dd></div>
              <div><dt className="text-slate-500">Methods</dt><dd className="mt-0.5 text-slate-200">{report.methodCount ?? '—'}</dd></div>
            </dl>
            <p className="text-xs text-slate-400">{report.historyDetail}</p>
            {report.discoveryError && <p className="text-xs text-amber-300">rpc_methods: {report.discoveryError}</p>}
            {report.exposedMethodsWithheld ? (
              <p className="text-xs leading-relaxed text-slate-300">{report.exposedMethodsNote}</p>
            ) : report.unsafe.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-red-300">Unsafe operator methods advertised ({report.unsafe.length})</p>
                <p className="mt-1 font-data text-[11px] leading-relaxed text-slate-300">{report.unsafe.map((m) => m.method).join(', ')}</p>
              </div>
            ) : report.methodCount !== null ? (
              <p className="text-xs text-emerald-300">No unsafe operator methods in the advertised list.</p>
            ) : null}
            {!report.exposedMethodsWithheld && report.stateChanging.length > 0 && (
              <p className="font-data text-[11px] text-slate-500">State-changing, not invoked: {report.stateChanging.map((m) => m.method).join(', ')}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
