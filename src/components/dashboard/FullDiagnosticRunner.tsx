import { useState } from 'react';
import { Play, Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react';
import { Card } from '../common/Card';
import { runFullDiagnosticSteps, type FullDiagnosticStepStatus } from '../../utils/fullDiagnostic';
import { overallVerdictFrom } from '../../utils/overallVerdict';
import { hexToDecimal } from '../../utils/combinedVerdict';
import { probeSubstrateWs, DEFAULT_SUBSTRATE_WS_URL, type SubstrateWsProbeResult } from '../../services/substrateWsProbe';
import { discoverCapabilities } from '../../services/capabilityDiscovery';
import type { CapabilitySnapshot } from '../../types/capability';
import type { HealthCheckSnapshot } from '../../types/healthCheck';
import type { ConnectionStatus } from '../../types/node';
import type { EndpointProfile } from '../../types/endpoint';

interface FullDiagnosticRunnerProps {
  endpoint: string;
  endpointProfile: EndpointProfile;
  onConnect: () => Promise<{
    status: ConnectionStatus;
    blockHex: string | null;
    blockAt: number | null;
  }>;
  onRunHealthCheck: () => Promise<HealthCheckSnapshot>;
  onProbeResult: (result: SubstrateWsProbeResult) => void;
  onCapabilitySnapshot: (snapshot: CapabilitySnapshot) => void;
  onGoHistory: () => void;
  onToast?: (message: string) => void;
}

interface StepState {
  id: string;
  label: string;
  status: FullDiagnosticStepStatus;
  detail: string;
}

const STEP_LABELS: Array<{ id: string; label: string }> = [
  { id: 'connect', label: 'Connect to endpoint' },
  { id: 'health', label: 'Health check' },
  { id: 'capabilities', label: 'Capability discovery' },
  { id: 'probe', label: 'Substrate WSS probe' },
  { id: 'snapshot', label: 'Snapshot recorded' },
  { id: 'verdict', label: 'Combined verdict' },
];

function verdictLabel(snapshot: HealthCheckSnapshot | null, probe: SubstrateWsProbeResult | null): string {
  switch (overallVerdictFrom(snapshot, probe)) {
    case 'healthy':
      return 'HEALTHY';
    case 'degraded':
      return 'DEGRADED';
    case 'down':
      return 'DOWN';
    case 'not_checked':
      return 'NOT CHECKED YET';
  }
}

/**
 * Judge demo flow, top of /app Overview. Runs the six steps in order, all
 * user-triggered, reusing the same handlers as the individual panels — no
 * separate code path, no simulated results. A failed step does not stop the
 * rest; the run reports what actually happened, then offers Export (the
 * History section, which exports the session's whole history) and Verify
 * (the public /verify page, in a new tab so this tab is preserved).
 */
export function FullDiagnosticRunner({
  endpoint,
  endpointProfile,
  onConnect,
  onRunHealthCheck,
  onProbeResult,
  onCapabilitySnapshot,
  onGoHistory,
  onToast,
}: FullDiagnosticRunnerProps) {
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [steps, setSteps] = useState<StepState[]>(() =>
    STEP_LABELS.map((s) => ({ ...s, status: 'pending' as FullDiagnosticStepStatus, detail: '' })),
  );
  const [ticker, setTicker] = useState<Array<{ block: string; at: number }>>([]);

  const run = async () => {
    setRunning(true);
    setFinished(false);
    setTicker([]);
    setSteps(STEP_LABELS.map((s) => ({ ...s, status: 'pending' as FullDiagnosticStepStatus, detail: '' })));
    let snapshotFromRun: HealthCheckSnapshot | null = null;
    let probeFromRun: SubstrateWsProbeResult | null = null;
    let doneCount = 0;

    const update = (id: string, status: FullDiagnosticStepStatus, detail = '') => {
      if (status === 'done') doneCount += 1;
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status, detail } : s)));
    };

    await runFullDiagnosticSteps(
      [
        {
          id: 'connect',
          label: 'Connect to endpoint',
          run: async () => {
            const { status, blockHex, blockAt } = await onConnect();
            if (status !== 'connected') throw new Error(`Connection ended as ${status}`);
            const decimal = hexToDecimal(blockHex);
            if (decimal && blockAt) {
              setTicker((prev) => [...prev, { block: decimal, at: blockAt }]);
            }
            return `Connected — ${endpointProfile === 'portaldot_v3_evm' ? 'Portaldot V3 EVM' : 'generic HTTP'} profile`;
          },
        },
        {
          id: 'health',
          label: 'Health check',
          run: async () => {
            const snap = await onRunHealthCheck();
            snapshotFromRun = snap;
            const passed = snap.checks.filter((c) => c.success).length;
            const blockCheck = snap.checks.find((c) => c.method === 'eth_blockNumber');
            const decimal = hexToDecimal(
              typeof blockCheck?.observedValue === 'string' ? blockCheck.observedValue : null,
            );
            if (decimal) {
              setTicker((prev) => [...prev, { block: decimal, at: snap.timestamp }]);
            }
            return `${passed}/${snap.checks.length} checks passed · snapshot ${snap.id}`;
          },
        },
        {
          id: 'capabilities',
          label: 'Capability discovery',
          run: async () => {
            const snap = await discoverCapabilities(endpoint);
            if (snap.discoveryStatus !== 'success') throw new Error(snap.error ?? 'Discovery failed');
            onCapabilitySnapshot(snap);
            return `${snap.safeAdvertisedMethods.length} safe methods advertised of ${snap.rawMethodCount} observed`;
          },
        },
        {
          id: 'probe',
          label: 'Substrate WSS probe',
          run: async () => {
            const res = await probeSubstrateWs(DEFAULT_SUBSTRATE_WS_URL);
            probeFromRun = res;
            onProbeResult(res);
            if (res.status !== 'ok') throw new Error(res.error ?? 'Probe failed');
            return `Answered · header ${res.headerNumberDecimal ?? '—'} · ${res.peers ?? '—'} peers`;
          },
        },
        {
          id: 'snapshot',
          label: 'Snapshot recorded',
          run: async () => {
            if (!snapshotFromRun) throw new Error('No snapshot from this run');
            return `Snapshot ${snapshotFromRun.id} recorded`;
          },
        },
        {
          id: 'verdict',
          label: 'Combined verdict',
          run: async () =>
            `Overall verdict: ${verdictLabel(snapshotFromRun, probeFromRun)}`,
        },
      ],
      update,
    );
    setRunning(false);
    setFinished(true);
    onToast?.(`Full diagnostic finished — ${doneCount} of ${STEP_LABELS.length} steps succeeded`);
  };

  return (
    <Card ticks>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Run full diagnostic</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Connect, health check, capability discovery, Substrate probe, snapshot, combined
              verdict — in order, using the same checks as the panels below. User-triggered only,
              no polling, no simulated results. A failed step does not stop the rest.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void run()}
            disabled={running}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#0181FB] px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {running ? 'Running…' : 'Run full diagnostic'}
          </button>
        </div>

        <ol className="space-y-1.5">
          {steps.map((step) => (
            <li key={step.id} className="flex items-start gap-2.5 text-sm">
              {step.status === 'done' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : step.status === 'failed' ? (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              ) : step.status === 'running' ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-400" />
              ) : (
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
              )}
              <span className="text-slate-300">
                {step.label}
                {step.detail && (
                  <span className="block font-data text-xs text-slate-500">{step.detail}</span>
                )}
              </span>
            </li>
          ))}
        </ol>

        {ticker.length > 0 && (
          <div className="rounded-lg border border-line bg-black/25 p-3">
            <p className="font-data text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Blocks read during this run — not a live feed, no polling
            </p>
            <ul className="mt-2 space-y-1">
              {ticker.map((entry, i) => (
                <li key={`${entry.block}-${entry.at}`} className="font-data text-xs text-slate-300">
                  Block #{entry.block} · {new Date(entry.at).toLocaleTimeString()}
                  {i > 0 && (
                    <span className="text-slate-500">
                      {' '}· {Math.max(0, Math.round((entry.at - ticker[i - 1].at) / 1000))}s after the previous read
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {finished && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={onGoHistory}
              className="rounded-lg bg-[#0181FB] px-4 py-2 text-sm font-semibold text-white"
            >
              Export report
            </button>
            <button
              type="button"
              onClick={() => window.open('/verify', '_blank', 'noreferrer')}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              Verify report
            </button>
            <p className="text-xs text-slate-500">
              Export covers the session&apos;s whole history, not just this run. Verify opens the
              public /verify page in a new tab; this tab is preserved.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
