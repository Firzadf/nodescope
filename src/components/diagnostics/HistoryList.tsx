import { useEffect, useState } from 'react';
import type { DiagnosticHistoryItem } from '../../types/rpc';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import { Clock, CheckCircle2, AlertTriangle, ArrowRight, X, Copy, Check } from 'lucide-react';

interface HistoryListProps {
  history: DiagnosticHistoryItem[];
  onSelect: (item: DiagnosticHistoryItem) => void;
  onClear: () => void;
}

export function HistoryList({ history, onSelect, onClear }: HistoryListProps) {
  const [detail, setDetail] = useState<DiagnosticHistoryItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDetail(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail]);

  if (history.length === 0) {
    return (
      <Card ticks>
        <PanelLabel index="02" label="HISTORY" />
        <h3 className="text-lg font-semibold text-white mt-2">Diagnostic History</h3>
        <div className="empty-shell px-5 py-6 flex items-start gap-4 mt-4">
          <Clock className="w-5 h-5 text-slate-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">Empty ledger</p>
            <p className="text-sm text-slate-400 mt-1.5">No diagnostic history in this session yet.</p>
            <p className="text-xs text-slate-500 mt-1">Run a diagnostic from the RPC Diagnostics tab and results will appear here.</p>
          </div>
        </div>
      </Card>
    );
  }

  const successCount = history.filter((i) => i.success).length;
  const failedCount = history.length - successCount;

  return (
    <Card ticks>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <PanelLabel index="02" label="HISTORY" />
            <div className="flex items-center gap-2 mt-2">
              <Clock className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-semibold text-white">Diagnostic History</h3>
            </div>
          </div>
          <button
            onClick={onClear}
            className="text-xs text-slate-400 hover:text-red-400 transition-colors"
          >
            Clear History
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-y border-line py-2">
          <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">[ Fig. 03 — Session ledger ]</span>
          <span className="font-data text-[10px] uppercase tracking-[0.14em] text-slate-500">
            {history.length} records · {successCount} success · {failedCount} failed
          </span>
        </div>
        <p className="text-xs text-slate-500">Click a record to open its full receipt in a popup, without leaving History.</p>

        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
          {history.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDetail(item)}
              className="w-full bg-black/25 hover:bg-white/[0.04] border border-line rounded-lg px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-data text-[11px] text-slate-600 w-8 shrink-0">
                  {String(history.length - index).padStart(3, '0')}
                </span>
                {item.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white font-data">{item.request.method}</span>
                    <span className="text-xs text-slate-500 truncate max-w-[200px] font-data">{item.endpoint}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-data">
                    {new Date(item.timestamp).toLocaleTimeString()} {item.latency !== null ? `• ${item.latency}ms` : ''}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setDetail(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Receipt for ${detail.request.method}`}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-panel p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">Record receipt</p>
                <h3 className="mt-1 font-data text-lg font-semibold text-white">{detail.request.method}</h3>
                <p className="mt-1 font-data text-xs text-slate-400">
                  {new Date(detail.timestamp).toLocaleString()} · {detail.success ? 'SUCCESS' : 'FAILED'}
                  {detail.latency !== null ? ` · ${detail.latency}ms` : ''} · {detail.endpoint}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close receipt"
                onClick={() => setDetail(null)}
                className="btn-ghost flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-black/30 p-4 font-mono text-xs leading-relaxed text-slate-300">
              {JSON.stringify(detail, null, 2)}
            </pre>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(JSON.stringify(detail, null, 2));
                  setCopied(true);
                }}
                className="btn-ghost inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy receipt JSON'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetail(null);
                  onSelect(detail);
                }}
                className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
              >
                Open in RPC Diagnostics
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
