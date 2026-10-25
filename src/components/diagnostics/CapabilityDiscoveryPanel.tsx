import { getMethodEvidenceStatus, formatEvidenceLabel } from '../../utils/capabilityEvidence';
import { useEffect, useRef, useState } from 'react';
import { Search, RefreshCw, AlertCircle } from 'lucide-react';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import type { CapabilitySnapshot } from '../../types/capability';
import { discoverCapabilities } from '../../services/capabilityDiscovery';

interface CapabilityDiscoveryPanelProps {
  endpoint: string;
  snapshot: CapabilitySnapshot | null;
  onSnapshotChange: (snapshot: CapabilitySnapshot | null) => void;
  history?: import('../../types/rpc').DiagnosticHistoryItem[];
  restoredAt?: number | null;
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
      return 'text-slate-400 border-line bg-slate-800';
  }
}

export function CapabilityDiscoveryPanel({ endpoint, snapshot, onSnapshotChange, history = [], restoredAt = null }: CapabilityDiscoveryPanelProps) {
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
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 border-b border-line pb-4">
          <div>
            <PanelLabel index="08" label="CAPABILITIES" />
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mt-2">
              <Search className="w-5 h-5 text-slate-400" />
              RPC Capability Discovery
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Advertised methods from <code className="text-slate-300">rpc_methods</code> — listed, never executed. No polling.
            </p>
          </div>
          <div className="text-xs text-slate-400">
            Target: <code className="text-slate-200 font-data">{endpoint || 'None'}</code>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDiscover}
          disabled={isDisabled}
          className="btn-ghost w-full md:w-auto px-5 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Discovering…' : 'Discover Capabilities'}
        </button>

        {!snapshot && !loading && (
          <div className="empty-shell px-5 py-4">
            <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">Not queried</p>
            <p className="text-xs text-slate-500 mt-1.5">No discovery attempted. Click Discover Capabilities to query this endpoint.</p>
          </div>
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
              {restoredAt !== null && (
                <span className="text-slate-500">
                  Restored from previous session · {new Date(restoredAt).toLocaleString()} · re-run Discover Capabilities for a fresh result.
                </span>
              )}
            </div>

            {snapshot.error && (
              <div className="bg-slate-950 border border-line rounded-lg p-3 text-xs text-amber-300 flex gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="font-mono break-all">{snapshot.error}</span>
              </div>
            )}

            {snapshot.discoveryStatus === 'success' && (
              <div className="bg-black/25 border border-line rounded-lg p-4 space-y-2">
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
                            : 'bg-slate-800 text-slate-400 border-line';
                        return (
                          <li
                            key={entry.method}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-900 border border-line text-xs font-mono text-slate-200"
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
