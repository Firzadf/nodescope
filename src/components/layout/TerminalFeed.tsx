import { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { DiagnosticHistoryItem } from '../../types/rpc';

interface TerminalFeedProps {
  history: DiagnosticHistoryItem[];
}

/**
 * Bottom terminal strip for the app. It only ever lists checks the user
 * actually ran in this session, newest first, capped at the last 8 records.
 * It never polls, never invents a line, and shows an explicit empty state
 * instead of a fake live stream.
 */
export function TerminalFeed({ history }: TerminalFeedProps) {
  const [open, setOpen] = useState(false);
  const latest = history.slice(0, 8);

  return (
    <section aria-label="Session terminal" className="border-t border-line bg-deep">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <Terminal className="h-4 w-4 shrink-0 text-[#0181FB]" />
        <span className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-300">
          Terminal — session ledger
        </span>
        <span className="font-data text-[11px] text-slate-500">
          {history.length === 0
            ? 'no checks run yet'
            : `${history.length} record${history.length === 1 ? '' : 's'} · latest ${latest[0].request.method}`}
        </span>
        <span className="ml-auto flex items-center gap-2 font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">
          {open ? 'Collapse' : 'Expand'}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-6 py-4">
          {latest.length === 0 ? (
            <p className="font-data text-xs text-slate-500">
              $ nodescope — waiting for your first check. Run Connect &amp; Test or a health check and the
              receipt appears here, line by line.
            </p>
          ) : (
            <ol className="space-y-1.5 font-data text-xs leading-relaxed">
              {latest.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 text-slate-400">
                  {item.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  )}
                  <span className="text-slate-500">{new Date(item.timestamp).toLocaleTimeString()}</span>
                  <span className="text-slate-100">{item.request.method}</span>
                  <span className="text-slate-500">
                    {item.success ? 'OK' : item.error ?? 'FAILED'}
                    {item.latency !== null ? ` · ${item.latency}ms` : ''}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">
            User-triggered only · nothing polls · full records live in History
          </p>
        </div>
      )}
    </section>
  );
}
