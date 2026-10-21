import { Activity, Zap, Database, Server } from 'lucide-react';
import { MetricCard } from './MetricCard';
import { NodeMetricsInspector } from './NodeMetricsInspector';
import { HealthCheckPanel } from './HealthCheckPanel';
import { CapabilityDiscoveryPanel } from '../diagnostics/CapabilityDiscoveryPanel';
import type { NodeMetricsDetailed } from '../../types/node';
import type { RpcDiagnosticResult } from '../../types/rpc';
import type { EndpointProfile } from '../../types/endpoint';
import type { CapabilitySnapshot } from '../../types/capability';
import type { DiagnosticHistoryItem } from '../../types/rpc';
import type { HealthCheckSnapshot } from '../../types/healthCheck';

interface OverviewProps {
  endpoint: string;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  metricsDetailed: NodeMetricsDetailed;
  onUpdateMetricsDetailed: (updater: (prev: NodeMetricsDetailed) => NodeMetricsDetailed) => void;
  onExecuteRpc: (method: string, params: unknown[]) => Promise<RpcDiagnosticResult | null>;
  endpointProfile: EndpointProfile;
  capabilitySnapshot: CapabilitySnapshot | null;
  history: DiagnosticHistoryItem[];
  onCapabilitySnapshotChange: (snapshot: CapabilitySnapshot | null) => void;
  latestHealthSnapshot?: HealthCheckSnapshot | null;
  onRunHealthCheck?: () => Promise<void>;
  isHealthChecking?: boolean;
}

export function Overview({
  endpoint,
  connectionStatus,
  metricsDetailed,
  onUpdateMetricsDetailed,
  onExecuteRpc,
  endpointProfile,
  capabilitySnapshot,
  history,
  onCapabilitySnapshotChange,
  latestHealthSnapshot = null,
  onRunHealthCheck,
  isHealthChecking = false,
}: OverviewProps) {
  const isDisconnected = connectionStatus === 'disconnected';

  // Format header values from detailed metrics
  const latencyDisplay =
    metricsDetailed.latency.value !== null ? `${metricsDetailed.latency.value}ms` : '—';
  const blockDisplay =
    metricsDetailed.blockHeight.value !== null ? String(metricsDetailed.blockHeight.value) : '—';
  const clientVersionDisplay =
    metricsDetailed.clientVersion.value !== null ? metricsDetailed.clientVersion.value : '—';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Connection Status"
          value={connectionStatus.toUpperCase()}
          icon={Activity}
          subtitle={endpoint || 'No endpoint configured'}
          unavailable={isDisconnected}
        />
        <MetricCard
          title="Latency"
          value={latencyDisplay}
          icon={Zap}
          subtitle={metricsDetailed.latency.sourceMethod ? `via ${metricsDetailed.latency.sourceMethod}` : 'Not tested'}
          unavailable={isDisconnected || metricsDetailed.latency.status !== 'success'}
        />
        <MetricCard
          title="Latest Block"
          value={blockDisplay}
          icon={Database}
          subtitle={metricsDetailed.blockHeight.sourceMethod ? `via ${metricsDetailed.blockHeight.sourceMethod}` : 'Not tested'}
          unavailable={isDisconnected || metricsDetailed.blockHeight.status !== 'success'}
        />
        <MetricCard
          title="Node Version"
          value={clientVersionDisplay}
          icon={Server}
          subtitle={metricsDetailed.clientVersion.sourceMethod ? `via ${metricsDetailed.clientVersion.sourceMethod}` : 'Not tested'}
          unavailable={isDisconnected || metricsDetailed.clientVersion.status !== 'success'}
        />
      </div>

      <NodeMetricsInspector
        endpoint={endpoint}
        isConnected={connectionStatus === 'connected'}
        onExecuteRpc={onExecuteRpc}
        metricsDetailed={metricsDetailed}
        onUpdateMetricsDetailed={onUpdateMetricsDetailed}
        endpointProfile={endpointProfile}
        capabilitySnapshot={capabilitySnapshot}
        history={history}
      />

      <HealthCheckPanel
        endpoint={endpoint}
        endpointProfile={endpointProfile}
        isConnected={connectionStatus === 'connected'}
        latestSnapshot={latestHealthSnapshot}
        onRunHealthCheck={onRunHealthCheck || (async () => {})}
        isLoading={isHealthChecking}
      />

      <CapabilityDiscoveryPanel
        endpoint={endpoint}
        snapshot={capabilitySnapshot}
        onSnapshotChange={onCapabilitySnapshotChange}
        history={history}
      />

      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center">
            <span className="text-cyan-400 text-sm font-semibold">i</span>
          </div>
          <div>
            <p className="text-sm font-medium text-cyan-300">Demo & Preview Mode Active</p>
            <p className="mt-1 text-sm text-slate-400">
              NodeScope requires an active, reachable Portaldot JSON-RPC endpoint with CORS enabled for direct browser requests. No continuous auto-polling or mock live metrics are displayed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
