import { useState } from 'react';
import type { RpcDiagnosticResult } from '../../types/rpc';
import { Card } from '../common/Card';
import { CheckCircle2, AlertTriangle, Clock, Zap, Copy, Check } from 'lucide-react';

interface ResponseViewerProps {
  result: RpcDiagnosticResult | null;
}

export function ResponseViewer({ result }: ResponseViewerProps) {
  const [copied, setCopied] = useState(false);

  if (!result) {
    return (
      <Card>
        <div className="text-center py-8 text-slate-500">
          <p className="text-sm">No diagnostic executed yet. Configure an endpoint and run a method above.</p>
        </div>
      </Card>
    );
  }

  const handleCopy = () => {
    const payload = JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedJson = JSON.stringify(result.response || { error: result.error }, null, 2);

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400" />
            )}
            <h3 className="text-lg font-semibold text-white">Diagnostic Result</h3>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Payload'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/50 p-3 rounded-lg border border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 block">Method</span>
            <code className="text-slate-200 font-mono">{result.request.method}</code>
          </div>
          <div>
            <span className="text-slate-500 block">Status</span>
            <span className={result.success ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
              {result.success ? 'Success' : 'Failed'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Latency</span>
            <span className="text-slate-200 flex items-center gap-1 font-mono">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              {result.latency !== null ? `${result.latency}ms` : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Timestamp</span>
            <span className="text-slate-200 flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {new Date(result.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {result.error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 font-mono whitespace-pre-wrap">
            {result.error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">JSON Response / Output</label>
          <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-[300px]">
            {formattedJson}
          </pre>
        </div>
      </div>
    </Card>
  );
}

