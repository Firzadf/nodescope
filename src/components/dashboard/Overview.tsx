import { Activity, Zap, Database, Server } from 'lucide-react';
import { MetricCard } from './MetricCard';
import { NodeMetricsInspector } from './NodeMetricsInspector';
import { HealthCheckPanel } from './HealthCheckPanel';
import { SnapshotComparison } from './SnapshotComparison';
import { SessionTrendsPanel } from './SessionTrendsPanel';
import { SubstrateWsProbePanel } from './SubstrateWsProbePanel';
import { CombinedVerdictPanel } from './CombinedVerdictPanel';
import { VerdictBar } from './VerdictBar';
import { HealthScoreHero } from './HealthScoreHero';
import { ScoreHistoryChart } from './ScoreHistoryChart';
import { useMemo, type ReactNode } from 'react';
import { computeHealthScoreV2 } from '../../utils/healthScore';
import { stallFromSession, type ChainMotion, type StallAssessment } from '../../utils/stall';
import type { ReliabilityReport } from '../../services/reliabilityProbe';
import type { SubstrateWsProbeResult } from '../../services/substrateWsProbe';
import { CapabilityDiscoveryPanel } from '../diagnostics/CapabilityDiscoveryPanel';
import type { NodeMetricsDetailed } from '../../types/node';
import type { RpcDiagnosticResult } from '../../types/rpc';
import type { EndpointProfile } from '../../types/endpoint';
import type { CapabilitySnapshot } from '../../types/capability';
import type { DiagnosticHistoryItem } from '../../types/rpc';
import type { HealthCheckSnapshot, HealthCheckCheck } from '../../types/healthCheck';

interface OverviewProps {  endpoint: string;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  metricsDetailed: NodeMetricsDetailed;
  onUpdateMetricsDetailed: (updater: (prev: NodeMetricsDetailed) => NodeMetricsDetailed) => void;
  onExecuteRpc: (method: string, params: unknown[]) => Promise<RpcDiagnosticResult | null>;
  endpointProfile: EndpointProfile;
  capabilitySnapshot: CapabilitySnapshot | null;
  history: DiagnosticHistoryItem[];
  onCapabilitySnapshotChange: (snapshot: CapabilitySnapshot | null) => void;
  healthSnapshots?: HealthCheckSnapshot[];
  latestHealthSnapshot?: HealthCheckSnapshot | null;
  onRunHealthCheck?: (onCheck?: (check: HealthCheckCheck) => void) => Promise<void>;
  isHealthChecking?: boolean;
  wsProbeResult?: SubstrateWsProbeResult | null;
  onWsProbeResultChange?: (result: SubstrateWsProbeResult) => void;
  probeRestoredAt?: number | null;
  capabilityRestoredAt?: number | null;
  /** Watch & alerts panel, owned by App (it runs health checks). */
  alertsSlot?: ReactNode;
  /** Run-full-diagnostic + endpoint configuration, owned by App. */
  setupSlot?: ReactNode;
  motion?: ChainMotion | null;
  reliability?: ReliabilityReport | null;
  /** Reliability, units, and the status badge. Owned by App so exports see them. */
  signalsSlot?: ReactNode;
}

/**
 * One-row stand-in for a panel that has nothing to show yet. Instead of a
 * big card saying "insufficient data", the row names exactly what is
 * missing and offers the one action that produces it.
 */
function CollapsedPanelRow({
  index,
  label,
  needs,
  onRun,
  running,
}: {
  index: string;
  label: string;
  needs: string;
  onRun: () => void;
  running: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3">
      <p className="text-sm text-slate-300">
        <span className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">
          {index} · {label}
        </span>
        <span className="text-slate-500"> — </span>
        {needs}
      </p>
      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className="rounded-lg bg-signal px-3 py-1.5 text-sm font-medium text-graphite transition-opacity disabled:opacity-50"
      >
        {running ? 'Running…' : 'Run health check'}
      </button>
    </div>
  );
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
  healthSnapshots = [],
  latestHealthSnapshot = null,
  onRunHealthCheck,
  isHealthChecking = false,
  wsProbeResult = null,
  onWsProbeResultChange,
  probeRestoredAt = null,
  capabilityRestoredAt = null,
  alertsSlot,
  setupSlot,
  motion = null,
  reliability = null,
  signalsSlot,
}: OverviewProps) {
  const isDisconnected = connectionStatus === 'disconnected';
  const verdictScore = useMemo(
    () => computeHealthScoreV2({
      snapshots: healthSnapshots,
      wsProbe: wsProbeResult,
      motion,
      reliability: reliability ? { samples: reliability.samples, errors: reliability.errors, http5xx: reliability.http5xx, p50Ms: reliability.p50Ms, p95Ms: reliability.p95Ms } : null,
    }),
    [healthSnapshots, wsProbeResult, motion, reliability],
  );
  const stall: StallAssessment = useMemo(
    () => stallFromSession(healthSnapshots, wsProbeResult ?? null, motion),
    [healthSnapshots, wsProbeResult, motion],
  );

  // Format header values from detailed metrics
  const latencyDisplay =
    metricsDetailed.latency.value !== null ? `${metricsDetailed.latency.value}ms` : '—';
  const blockDisplay =
    metricsDetailed.blockHeight.value !== null ? String(metricsDetailed.blockHeight.value) : '—';
  const clientVersionDisplay =
    metricsDetailed.clientVersion.value !== null ? metricsDetailed.clientVersion.value : '—';

  return (
    <div className="space-y-6 stagger">
      <VerdictBar
        latestHealthSnapshot={latestHealthSnapshot}
        wsProbeResult={wsProbeResult}
        latencyMs={metricsDetailed.latency.value}
        latencyMethod={metricsDetailed.latency.sourceMethod}
        endpointProfile={endpointProfile}
        scoreBand={verdictScore.band}
        score={verdictScore.score}
        stall={stall.state}
        stallExplanation={stall.state === 'stalled' ? stall.explanation : null}
      />
      <ScoreHistoryChart snapshots={healthSnapshots} wsProbe={wsProbeResult ?? null} motion={motion} />
      <HealthScoreHero
        snapshots={healthSnapshots}
        wsProbe={wsProbeResult ?? null}
        motion={motion}
        reliability={reliability}
        onRunHealthCheck={onRunHealthCheck ? () => void onRunHealthCheck() : undefined}
        running={isHealthChecking}
      />
      {setupSlot}
      {alertsSlot}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-xl overflow-hidden ">
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

      {healthSnapshots.length < 2 ? (
        <CollapsedPanelRow
          index="04"
          label="Comparison"
          needs="Needs 2 health checks to compare."
          onRun={() => void (onRunHealthCheck || (async () => {}))()}
          running={isHealthChecking}
        />
      ) : (
        <SnapshotComparison snapshots={healthSnapshots} />
      )}

      {healthSnapshots.length === 0 ? (
        <CollapsedPanelRow
          index="05"
          label="Trends & Verdict"
          needs="Needs 1 health check to show trends."
          onRun={() => void (onRunHealthCheck || (async () => {}))()}
          running={isHealthChecking}
        />
      ) : (
        <SessionTrendsPanel snapshots={healthSnapshots} />
      )}

      <div id="substrate-ws-probe" className="scroll-mt-6">
        <SubstrateWsProbePanel onResult={onWsProbeResultChange} initialResult={wsProbeResult} restoredAt={probeRestoredAt} />
      </div>

      {!latestHealthSnapshot && !wsProbeResult ? (
        <CollapsedPanelRow
          index="07"
          label="Combined Verdict"
          needs="Needs a health snapshot and a Substrate probe result."
          onRun={() => void (onRunHealthCheck || (async () => {}))()}
          running={isHealthChecking}
        />
      ) : (
        <CombinedVerdictPanel latestHealthSnapshot={latestHealthSnapshot} wsProbeResult={wsProbeResult} probeRestoredAt={probeRestoredAt} />
      )}

      {signalsSlot}
      <div id="capabilities" className="scroll-mt-6">
        <CapabilityDiscoveryPanel
          endpoint={endpoint}
          snapshot={capabilitySnapshot}
          onSnapshotChange={onCapabilitySnapshotChange}
          history={history}
          restoredAt={capabilityRestoredAt}
        />
      </div>

      {connectionStatus !== 'connected' && (
        <div className="bg-panel border border-line rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-signal flex items-center justify-center">
              <span className="text-white text-sm font-bold">i</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Not connected yet</p>
              <p className="mt-1 text-sm text-slate-400">
                Requires a reachable Portaldot JSON-RPC endpoint with CORS enabled for direct browser requests. No auto-polling, no mock metrics.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
