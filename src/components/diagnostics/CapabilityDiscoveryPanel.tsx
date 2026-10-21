import { getMethodEvidenceStatus, formatEvidenceLabel } from '../../utils/capabilityEvidence';
import { useEffect, useRef, useState } from 'react';
import { Search, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '../common/Card';
import type { CapabilitySnapshot } from '../../types/capability';
import { discoverCapabilities } from '../../services/capabilityDiscovery';

interface CapabilityDiscoveryPanelProps {
  endpoint: string;
  snapshot: CapabilitySnapshot | null;
  onSnapshotChange: (snapshot: CapabilitySnapshot | null) => void;
  history?: import('../../types/rpc').DiagnosticHistoryItem[];
}

function statusLabel(status: CapabilitySnapshot['discoveryStatus']): string {
  switch (status) {
    case 'success':
      return 'Success';
    case 'unsupported_method':
      return 'Unsupported — rpc_methods not exposed on this endpoint';
    case 'transport_error':
      return 'Transport error';
    case 'invalid_response':
      return 'Invalid response';
    default:
      return 'Not attempted';
  }
}

function statusTone(status: CapabilitySnapshot['discoveryStatus']): string {
  switch (status) {
    case 'success':
      return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    case 'unsupported_method':
      return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    case 'transport_error':
      return 'text-red-400 border-red-500/30 bg-red-500/10';
    default:
      return 'text-slate-400 border-slate-700 bg-slate-800';
  }
}

export function CapabilityDiscoveryPanel({ endpoint, snapshot, onSnapshotChange, history = [] }: CapabilityDiscoveryPanelProps) {
  const [loading, setLoading] = useState(false);
  const lastEndpointRef = useRef(endpoint);

  useEffect(() => {
    if (endpoint !== lastEndpointRef.current) {
      lastEndpointRef.current = endpoint;
      onSnapshotChange(null);
    }
  }, [endpoint, onSnapshotChange]);

  const handleDiscover = async () => {
    if (!endpoint.trim() || loading) return;
    setLoading(true);
    try {
      const next = await discoverCapabilities(endpoint);
      onSnapshotChange(next);
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = !endpoint.trim() || loading;

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-400" />
              RPC Capability Discovery
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Lists methods advertised by <code className="text-slate-300">rpc_methods</code> without executing them. No polling; no side effects.
            </p>
          </div>
          <div className="text-xs text-slate-400">
            Target: <code className="text-slate-200">{endpoint || 'None'}</code>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDiscover}
          disabled={isDisabled}
          className="w-full md:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sm font-medium text-slate-200 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-700"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Discovering…' : 'Discover Capabilities'}
        </button>

        {!snapshot && !loading && (
          <p className="text-xs text-slate-500">No discovery attempted. Click Discover Capabilities to query this endpoint.</p>
        )}

        {snapshot && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center px-2 py-1 rounded border text-xs font-medium ${statusTone(snapshot.discoveryStatus)}`}>
                {statusLabel(snapshot.discoveryStatus)}
              </span>
              <span className="text-slate-500">
                Origin: <code className="text-slate-300">{snapshot.endpointOrigin}</code>
              </span>
              <span className="text-slate-500">
                At: <span className="text-slate-300">{new Date(snapshot.discoveredAt).toLocaleString()}</span>
              </span>
              {snapshot.latencyMs !== null && (
                <span className="text-slate-500">
                  Latency: <span className="text-slate-300">{snapshot.latencyMs}ms</span>
                </span>
              )}
            </div>

            {snapshot.error && (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-amber-300 flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="font-mono break-all">{snapshot.error}</span>
              </div>
            )}

            {snapshot.discoveryStatus === 'success' && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-2">
                <div className="text-xs text-slate-400">
                  Advertised methods (safe allowlist): <span className="text-slate-200 font-medium">{snapshot.safeAdvertisedMethods.length}</span>
                  <span className="text-slate-500"> of {snapshot.rawMethodCount} total unique methods observed</span>
                </div>
                {snapshot.safeAdvertisedMethods.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {snapshot.safeAdvertisedMethods.map((entry) =>
                      (() => {
                        const status = getMethodEvidenceStatus(entry.method, snapshot, history, endpoint);
                        const label = formatEvidenceLabel(status);
                        const tone =
                          status === 'confirmed'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                            : status === 'unsupported'
                            ? 'bg-red-500/15 text-red-300 border-red-500/25'
                            : status === 'advertised'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                            : 'bg-slate-800 text-slate-400 border-slate-700';
                        return (
                          <li
                            key={entry.method}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200"
                            title={label}
                          >
                            {entry.method}
                            <span className={`text-[10px] font-sans font-medium px-1 py-0.5 rounded border ${tone}`}>
                              {label}
                            </span>
                          </li>
                        );
                      })()
                    )}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">No safe advertised methods matched the read-only allowlist.</p>
                )}
                <p className="text-[11px] text-slate-500">
                  Listed methods are advertised via <code className="text-slate-400">rpc_methods</code>. They have not been executed; use RPC Console or metrics to test them.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
