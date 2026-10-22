import type { DiagnosticHistoryItem } from '../../types/rpc';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import { Clock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface HistoryListProps {
  history: DiagnosticHistoryItem[];
  onSelect: (item: DiagnosticHistoryItem) => void;
  onClear: () => void;
}

export function HistoryList({ history, onSelect, onClear }: HistoryListProps) {
  if (history.length === 0) {
    return (
      <Card>
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

  return (
    <Card>
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

        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              className="bg-black/25 hover:bg-slate-900 border border-line hover:border-line rounded-lg p-3 flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                {item.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white font-mono">{item.request.method}</span>
                    <span className="text-xs text-slate-500 truncate max-w-[200px]">{item.endpoint}</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(item.timestamp).toLocaleTimeString()} {item.latency !== null ? `• ${item.latency}ms` : ''}
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
