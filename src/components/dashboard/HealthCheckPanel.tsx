import { useState } from 'react';
import { Activity, Play, RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import type { EndpointProfile } from '../../types/endpoint';
import type { HealthCheckSnapshot, HealthCheckCheck, HealthCheckOutcome } from '../../types/healthCheck';
import type { Finding } from '../../types/diagnostic';

interface HealthCheckPanelProps {
  endpoint: string;
  endpointProfile: EndpointProfile;
  isConnected: boolean;
  latestSnapshot: HealthCheckSnapshot | null;
  onRunHealthCheck: () => Promise<void>;
  isLoading: boolean;
}

function OutcomeBadge({ outcome }: { outcome: HealthCheckOutcome }) {
  switch (outcome) {
    case 'success':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" />
          Success
        </span>
      );
    case 'unsupported_method':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
          <AlertCircle className="w-3 h-3" />
          Unsupported (-32601)
        </span>
      );
    case 'network_error':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30">
          <XCircle className="w-3 h-3" />
          Network Error
        </span>
      );
    case 'http_error':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30">
          <XCircle className="w-3 h-3" />
          HTTP Error
        </span>
      );
    case 'rpc_error':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30">
          <AlertCircle className="w-3 h-3" />
          RPC Error
        </span>
      );
    case 'invalid_response':
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30">
          <AlertCircle className="w-3 h-3" />
          Invalid Response
        </span>
      );
  }
}

function FindingSeverityBadge({ severity }: { severity: Finding['severity'] }) {
  switch (severity) {
    case 'error':
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
          ERROR
        </span>
      );
    case 'warning':
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
          WARNING
        </span>
      );
    case 'info':
    default:
      return (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
          INFO
        </span>
      );
  }
}

export function HealthCheckPanel({
  endpoint,
  endpointProfile,
  isConnected,
  latestSnapshot,
  onRunHealthCheck,
  isLoading,
}: HealthCheckPanelProps) {
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const handleTrigger = async () => {
    setErrorNotice(null);
    try {
      await onRunHealthCheck();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorNotice(msg);
    }
  };

  const isActionDisabled = !endpoint.trim() || isLoading;

  return (
    <Card>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-slate-700 pb-4">
          <div>
            <PanelLabel index="03" label="HEALTH CHECK" />
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mt-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Node Health Check
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Explicit user-triggered node health assessment. No background polling or synthetic metrics.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Profile: <span className="font-mono text-slate-200">{endpointProfile}</span>
            </span>
            <button
              type="button"
              onClick={handleTrigger}
              disabled={isActionDisabled}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isLoading ? 'Running Health Check...' : 'Run Health Check'}
            </button>
          </div>
        </div>

        {errorNotice && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Health check failed: {errorNotice}</span>
          </div>
        )}

        {!isConnected && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Node is not marked as connected. You can still run explicit health checks to inspect endpoint behavior.</span>
          </div>
        )}

        {!latestSnapshot && !isLoading && (
          <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-lg">
            <Activity className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-medium text-slate-400">No health check performed in this session yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Click &quot;Run Health Check&quot; above to query known read-only endpoints for the active profile.
            </p>
          </div>
        )}

        {latestSnapshot && (
          <div className="space-y-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Snapshot ID:</span>
                  <code className="text-slate-200 font-mono text-[11px]">{latestSnapshot.id}</code>
                </div>
                <div className="flex items-center gap-4 text-slate-400">
                  <span>
                    Origin: <code className="text-slate-200">{latestSnapshot.endpointOrigin}</code>
                  </span>
                  <span>
                    Timestamp:{' '}
                    <span className="text-slate-200">
                      {new Date(latestSnapshot.timestamp).toLocaleTimeString()}
                    </span>
                  </span>
                </div>
              </div>

              <h4 className="text-sm font-medium text-slate-300 mb-3">Individual Check Results</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {latestSnapshot.checks.map((check: HealthCheckCheck) => (
                  <div
                    key={check.method}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <code className="text-cyan-400 font-mono font-medium">{check.method}</code>
                      <OutcomeBadge outcome={check.outcome} />
                    </div>
                    <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>Observed value:</span>
                      <span className="text-slate-200 font-mono font-medium">
                        {check.observedValue !== null ? String(check.observedValue) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Latency:</span>
                      <span className="text-slate-200 font-mono">
                        {check.latencyMs !== null ? `${check.latencyMs}ms` : '—'}
                      </span>
                    </div>
                    {check.error && (
                      <p className="text-red-400/90 font-mono text-[11px] pt-1 break-all">{check.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {latestSnapshot.findings.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-medium text-slate-300">Derived Diagnostic Findings</h4>
                <div className="space-y-2">
                  {latestSnapshot.findings.map((f: Finding, idx: number) => (
                    <div
                      key={`${f.ruleId}-${idx}`}
                      className="bg-slate-900 border border-slate-800 rounded p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <FindingSeverityBadge severity={f.severity} />
                        <span className="text-slate-400 font-mono text-[11px]">{f.ruleId}</span>
                        <span className="text-white font-medium">{f.title}</span>
                      </div>
                      <p className="text-slate-300">{f.evidence}</p>
                      <p className="text-slate-500">{f.explanation}</p>
                      <p className="text-cyan-400 font-medium">{f.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-slate-900/40 border border-slate-800/60 rounded-lg p-3 text-[11px] text-slate-400">
              <span className="font-medium text-slate-300">Observation note: </span>
              A successful block height query confirms single-measurement retrieval only. It does not prove active synchronization or continuous block production.
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
