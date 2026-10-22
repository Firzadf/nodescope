import { useState, useEffect, useRef } from 'react';
import { Zap, Server, Users, Database, Play, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import type { NodeMetricsDetailed, MetricStatus } from '../../types/node';
import type { RpcDiagnosticResult, DiagnosticHistoryItem } from '../../types/rpc';
import type { EndpointProfile } from '../../types/endpoint';
import type { CapabilitySnapshot } from '../../types/capability';
import { defaultBlockMethodForProfile } from '../../utils/blockMethodDefaults';
import {
  defaultLatencyMethodForProfile,
  defaultClientVersionMethodForProfile,
  defaultPeerMethodForProfile,
  hasPeerCountSupport,
} from '../../utils/metricMethodDefaults';
import {
  parseLatency,
  parseClientVersion,
  parsePeerCount,
  parseBlockHeight,
} from '../../utils/metricParsers';
import { getMethodEvidenceStatus, formatEvidenceLabel } from '../../utils/capabilityEvidence';

interface NodeMetricsInspectorProps {
  endpoint: string;
  isConnected: boolean;
  onExecuteRpc: (method: string, params: unknown[]) => Promise<RpcDiagnosticResult | null>;
  metricsDetailed: NodeMetricsDetailed;
  onUpdateMetricsDetailed: (updater: (prev: NodeMetricsDetailed) => NodeMetricsDetailed) => void;
  endpointProfile: EndpointProfile;
  capabilitySnapshot?: CapabilitySnapshot | null;
  history?: DiagnosticHistoryItem[];
}

const BLOCK_METHOD_OPTIONS = [
  { label: 'chain_getHeader (Substrate standard)', method: 'chain_getHeader', params: [] },
  { label: 'chain_getBlock (Substrate standard)', method: 'chain_getBlock', params: [] },
  {
    label: 'eth_blockNumber (EVM — verified 2026-10-19 on Portaldot V3 EVM)',
    method: 'eth_blockNumber',
    params: [] as unknown[],
  },
];

function StatusBadge({ status }: { status: MetricStatus }) {
  switch (status) {
    case 'success':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          Success
        </span>
      );
    case 'unsupported_method':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
          Unsupported Method
        </span>
      );
    case 'network_error':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30">
          Network Error
        </span>
      );
    case 'invalid_response':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/30">
          Invalid Response
        </span>
      );
    case 'not_tested':
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-400 border border-line">
          Not Tested
        </span>
      );
  }
}

export function NodeMetricsInspector({
  endpoint,
  isConnected,
  onExecuteRpc,
  metricsDetailed,
  onUpdateMetricsDetailed,
  endpointProfile,
  capabilitySnapshot = null,
  history = [],
}: NodeMetricsInspectorProps) {
  const [loadingMetric, setLoadingMetric] = useState<string | null>(null);
  const [selectedBlockMethod, setSelectedBlockMethod] = useState(() =>
    defaultBlockMethodForProfile(endpointProfile)
  );
  const prevScopeRef = useRef({ endpoint, profile: endpointProfile });

  // Clear any previously measured peer result when the endpoint or profile scope changes,
  // so a Generic-profile peer count is never displayed as if it belonged to an EVM endpoint.
  useEffect(() => {
    const previous = prevScopeRef.current;
    if (previous.endpoint === endpoint && previous.profile === endpointProfile) return;

    prevScopeRef.current = { endpoint, profile: endpointProfile };
    onUpdateMetricsDetailed((prev) => ({
      ...prev,
      peerCount: { status: 'not_tested', value: null },
    }));
  }, [endpoint, endpointProfile, onUpdateMetricsDetailed]);

  // Keep the block-query selection aligned with the active profile default.
  const selectedBlockMethodRef = useRef(selectedBlockMethod);
  useEffect(() => {
    selectedBlockMethodRef.current = selectedBlockMethod;
  });
  useEffect(() => {
    const current = selectedBlockMethodRef.current;
    const expectedDefault = defaultBlockMethodForProfile(endpointProfile);
    const oppositeDefault = defaultBlockMethodForProfile(
      endpointProfile === 'portaldot_v3_evm' ? 'generic_http' : 'portaldot_v3_evm'
    );
    if (current === oppositeDefault) {
      setSelectedBlockMethod(expectedDefault);
    }
  }, [endpointProfile]);

  const runLatencyCheck = async () => {
    if (!endpoint) return;
    setLoadingMetric('latency');
    const method = defaultLatencyMethodForProfile(endpointProfile);
    const res = await onExecuteRpc(method, []);
    const parsed = parseLatency(res);
    onUpdateMetricsDetailed((prev) => ({ ...prev, latency: parsed }));
    setLoadingMetric(null);
  };

  const runVersionCheck = async () => {
    if (!endpoint) return;
    setLoadingMetric('version');
    const method = defaultClientVersionMethodForProfile(endpointProfile);
    const res = await onExecuteRpc(method, []);
    const parsed = parseClientVersion(res);
    onUpdateMetricsDetailed((prev) => ({ ...prev, clientVersion: parsed }));
    setLoadingMetric(null);
  };

  const runPeerCheck = async () => {
    if (!endpoint) return;
    const method = defaultPeerMethodForProfile(endpointProfile);
    if (!method) {
      onUpdateMetricsDetailed((prev) => ({
        ...prev,
        peerCount: {
          status: 'unsupported_method',
          value: null,
          error: 'Peer count not available for EVM profile',
          sourceMethod: 'N/A',
        },
      }));
      return;
    }
    setLoadingMetric('peer');
    const res = await onExecuteRpc(method, []);
    const parsed = parsePeerCount(res);
    onUpdateMetricsDetailed((prev) => ({ ...prev, peerCount: parsed }));
    setLoadingMetric(null);
  };

  const runBlockHeightCheck = async () => {
    if (!endpoint) return;
    setLoadingMetric('block');
    const option = BLOCK_METHOD_OPTIONS.find((o) => o.method === selectedBlockMethod);
    const res = await onExecuteRpc(selectedBlockMethod, option?.params || []);
    const parsed = parseBlockHeight(res);
    onUpdateMetricsDetailed((prev) => ({ ...prev, blockHeight: parsed }));
    setLoadingMetric(null);
  };

  const isActionDisabled = !endpoint.trim() || loadingMetric !== null;

  return (
    <Card>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 border-b border-line pb-4">
          <div>
            <PanelLabel index="02" label="NODE METRICS" />
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mt-2">
              <Zap className="w-5 h-5 text-slate-400" />
              Node Metrics Inspector
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              All queries are user-triggered. No continuous polling.
            </p>
          </div>
          <div className="text-xs text-slate-400">
            Target Endpoint: <code className="text-slate-200 font-data">{endpoint || 'None'}</code>
          </div>
        </div>

        {!isConnected && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-data text-[10px] uppercase tracking-[0.2em] text-amber-400/90">Status — Not connected</p>
              <p className="mt-1">Node is not marked as connected. You may still trigger individual diagnostics to inspect endpoint behavior.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Metric 1: RPC Latency */}
          <div className="bg-black/25 border border-line rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-white">RPC Latency</span>
              </div>
              <StatusBadge status={metricsDetailed.latency.status} />
            </div>
            <div className="text-2xl font-semibold text-white font-data">
              {metricsDetailed.latency.value !== null ? `${metricsDetailed.latency.value}ms` : '—'}
            </div>
            {(() => {
              const m = defaultLatencyMethodForProfile(endpointProfile);
              const ev = getMethodEvidenceStatus(m, capabilitySnapshot, history, endpoint);
              return <p className="text-xs text-slate-400">Measured via <code className="text-slate-300">{m}</code> — {formatEvidenceLabel(ev)}.</p>;
            })()}
            {metricsDetailed.latency.error && (
              <p className="text-xs text-red-400 font-mono break-all">{metricsDetailed.latency.error}</p>
            )}
            <button
              type="button"
              onClick={runLatencyCheck}
              disabled={isActionDisabled}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-slate-200 rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              {loadingMetric === 'latency' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {loadingMetric === 'latency' ? 'Measuring...' : 'Test Latency'}
            </button>
          </div>

          {/* Metric 2: Client Version */}
          <div className="bg-black/25 border border-line rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-white">Client Version</span>
              </div>
              <StatusBadge status={metricsDetailed.clientVersion.status} />
            </div>
            <div className="text-lg font-mono font-medium text-slate-200 truncate" title={metricsDetailed.clientVersion.value || ''}>
              {metricsDetailed.clientVersion.value || '—'}
            </div>
            {(() => {
              const m = defaultClientVersionMethodForProfile(endpointProfile);
              const ev = getMethodEvidenceStatus(m, capabilitySnapshot, history, endpoint);
              return <p className="text-xs text-slate-400">Queried via <code className="text-slate-300">{m}</code> — {formatEvidenceLabel(ev)}.</p>;
            })()}
            {metricsDetailed.clientVersion.error && (
              <p className="text-xs text-amber-400 font-mono break-all">{metricsDetailed.clientVersion.error}</p>
            )}
            <button
              type="button"
              onClick={runVersionCheck}
              disabled={isActionDisabled}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-slate-200 rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              {loadingMetric === 'version' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {loadingMetric === 'version' ? 'Querying...' : `Query Version (${defaultClientVersionMethodForProfile(endpointProfile)})`}
            </button>
          </div>

          {/* Metric 3: Peer Count */}
          <div className="bg-black/25 border border-line rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-white">Connected Peers</span>
              </div>
              <StatusBadge status={metricsDetailed.peerCount.status} />
            </div>
            <div className="text-2xl font-semibold text-white font-data">
              {metricsDetailed.peerCount.value !== null ? metricsDetailed.peerCount.value : '—'}
            </div>
            {(() => {
              const m = defaultPeerMethodForProfile(endpointProfile);
              if (!m || !hasPeerCountSupport(endpointProfile)) {
                return <p className="text-xs text-slate-400">Not available for EVM profile.</p>;
              }
              const ev = getMethodEvidenceStatus(m, capabilitySnapshot, history, endpoint);
              return <p className="text-xs text-slate-400">Extracted from {m} — {formatEvidenceLabel(ev)} — when valid numeric peers field present.</p>;
            })()}
            {metricsDetailed.peerCount.error && (
              <p className="text-xs text-amber-400 font-mono break-all">{metricsDetailed.peerCount.error}</p>
            )}
            <button
              type="button"
              onClick={runPeerCheck}
              disabled={isActionDisabled || !hasPeerCountSupport(endpointProfile)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-slate-200 rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              {loadingMetric === 'peer' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {loadingMetric === 'peer' ? 'Checking...' : hasPeerCountSupport(endpointProfile) ? 'Query Peers (system_health)' : 'Peers unavailable for EVM'}
            </button>
          </div>

          {/* Metric 4: Block Height */}
          <div className="bg-black/25 border border-line rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-white">Block Height</span>
              </div>
              <StatusBadge status={metricsDetailed.blockHeight.status} />
            </div>
            <div className="text-2xl font-semibold text-white">
              {metricsDetailed.blockHeight.value !== null ? metricsDetailed.blockHeight.value : '—'}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 flex items-center gap-1">
                <span>Select Block Query Method</span>
                <HelpCircle className="w-3 h-3 text-slate-500" />
              </label>
              <select
                value={selectedBlockMethod}
                onChange={(e) => setSelectedBlockMethod(e.target.value)}
                disabled={loadingMetric !== null}
                className="w-full bg-slate-900 border border-line rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {BLOCK_METHOD_OPTIONS.map((opt) => (
                  <option key={opt.method} value={opt.method}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedBlockMethod.startsWith('eth_') && (
              <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2 rounded">
                Note: Portaldot V3.0 EVM JSON-RPC support is not officially confirmed on every node endpoint. If this method fails with code -32601, the node operates standard Substrate RPC.
              </p>
            )}

            {metricsDetailed.blockHeight.error && (
              <p className="text-xs text-amber-400 font-mono break-all">{metricsDetailed.blockHeight.error}</p>
            )}

            <button
              type="button"
              onClick={runBlockHeightCheck}
              disabled={isActionDisabled}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-slate-200 rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              {loadingMetric === 'block' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {loadingMetric === 'block' ? 'Querying Block...' : `Query via ${selectedBlockMethod}`}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
