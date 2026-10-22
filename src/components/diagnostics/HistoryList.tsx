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
        <div className="text-center py-8 text-slate-500">
          <p className="text-sm">No diagnostic history in this session yet.</p>
          <p className="text-xs text-slate-600 mt-1">Run a diagnostic from the RPC Diagnostics tab and results will appear here.</p>
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
              <Clock className="w-5 h-5 text-cyan-400" />
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
              className="bg-slate-950/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-3 flex items-center justify-between cursor-pointer transition-colors"
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
