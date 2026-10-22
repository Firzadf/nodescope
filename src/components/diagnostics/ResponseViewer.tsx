import { useState, type ReactNode } from 'react';
import type { RpcDiagnosticResult } from '../../types/rpc';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import { CheckCircle2, AlertTriangle, Clock, Zap, Copy, Check, Terminal } from 'lucide-react';

interface ResponseViewerProps {
  result: RpcDiagnosticResult | null;
}

/** Minimal JSON syntax tinting: keys recede to white, strings/numbers/literals carry the color. */
function highlightJson(json: string): ReactNode[] {
  const pattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(json)) !== null) {
    if (m.index > last) {
      nodes.push(
        <span key={k++} className="text-slate-500">
          {json.slice(last, m.index)}
        </span>,
      );
    }
    const [full, str, colon, bool] = m;
    if (str !== undefined) {
      nodes.push(
        <span key={k++} className={colon ? 'text-slate-100' : 'text-sky-300/90'}>
          {str}
        </span>,
      );
      if (colon) {
        nodes.push(
          <span key={k++} className="text-slate-500">
            {colon}
          </span>,
        );
      }
    } else if (bool !== undefined || full === 'null') {
      nodes.push(
        <span key={k++} className="text-violet-300/90">
          {full}
        </span>,
      );
    } else {
      nodes.push(
        <span key={k++} className="text-amber-200/90">
          {full}
        </span>,
      );
    }
    last = m.index + full.length;
  }
  if (last < json.length) {
    nodes.push(
      <span key={k++} className="text-slate-500">
        {json.slice(last)}
      </span>,
    );
  }
  return nodes;
}

export function ResponseViewer({ result }: ResponseViewerProps) {
  const [copied, setCopied] = useState(false);

  if (!result) {
    return (
      <Card ticks>
        <div className="space-y-4">
          <div>
            <PanelLabel index="02" label="RESULT" />
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mt-2">
              <Terminal className="w-5 h-5 text-slate-400" />
              Diagnostic Result
            </h3>
          </div>
          <div className="empty-shell px-5 py-6 flex items-start gap-4">
            <Terminal className="w-5 h-5 text-slate-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">Awaiting first run</p>
              <p className="text-sm text-slate-400 mt-1.5">No diagnostic executed yet. Configure an endpoint and run a method above.</p>
            </div>
          </div>
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
    <Card ticks>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <PanelLabel index="02" label="RESULT" />
            <div className="flex items-center gap-2 mt-2">
              {result.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              )}
              <h3 className="text-lg font-semibold text-white">Diagnostic Result</h3>
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy Payload'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line rounded-lg overflow-hidden text-xs">
          <div className="bg-panel px-3.5 py-3">
            <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500 block mb-1">Method</span>
            <code className="text-slate-100 font-data">{result.request.method}</code>
          </div>
          <div className="bg-panel px-3.5 py-3">
            <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500 block mb-1">Status</span>
            <span className={result.success ? 'text-emerald-400 font-medium font-data' : 'text-red-400 font-medium font-data'}>
              {result.success ? 'Success' : 'Failed'}
            </span>
          </div>
          <div className="bg-panel px-3.5 py-3">
            <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500 block mb-1">Latency</span>
            <span className="text-slate-100 flex items-center gap-1.5 font-data">
              <Zap className="w-3.5 h-3.5 text-slate-500" />
              {result.latency !== null ? `${result.latency}ms` : '—'}
            </span>
          </div>
          <div className="bg-panel px-3.5 py-3">
            <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500 block mb-1">Timestamp</span>
            <span className="text-slate-100 flex items-center gap-1.5 font-data">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {new Date(result.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {result.error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 font-mono whitespace-pre-wrap">
            {result.error}
          </div>
        )}

        <div className="border border-line rounded-lg overflow-hidden">
          <div className="flex items-center justify-between gap-3 bg-black/30 px-3.5 py-2 border-b border-line">
            <span className="font-data text-[11px] text-slate-400 truncate">&gt;_ RAW RESPONSE · {result.request.method}</span>
            <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600 shrink-0">[ Fig. 02 — Raw response ]</span>
          </div>
          <pre className="bg-slate-950/60 p-4 text-xs font-mono text-slate-400 overflow-x-auto max-h-[300px] leading-relaxed">
            {highlightJson(formattedJson)}
          </pre>
        </div>
      </div>
    </Card>
  );
}

