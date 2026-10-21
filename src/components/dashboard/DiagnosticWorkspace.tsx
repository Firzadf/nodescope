import { Card } from '../common/Card';
import { Terminal } from 'lucide-react';

export function DiagnosticWorkspace() {
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Terminal className="w-5 h-5 text-cyan-400" />
        <h3 className="text-lg font-semibold text-white">RPC Diagnostic Console</h3>
      </div>
      <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
        <p className="text-slate-500 text-sm">No active connection. Configure an RPC endpoint to start diagnostics.</p>
      </div>
    </Card>
  );
}
