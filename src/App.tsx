import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Header } from './components/layout/Header';
import { CommandPalette, type PaletteCommand } from './components/common/CommandPalette';
import { Sidebar } from './components/layout/Sidebar';
import { TerminalFeed } from './components/layout/TerminalFeed';
import { BackToTop } from './components/BackToTop';
import { IntroSplash } from './components/common/IntroSplash';
import { Toasts, type Toast } from './components/common/Toasts';
import { Overview } from './components/dashboard/Overview';
import { EndpointConfig } from './components/dashboard/EndpointConfig';
import { RpcConsole } from './components/diagnostics/RpcConsole';
import { ResponseViewer } from './components/diagnostics/ResponseViewer';
import { HistoryList } from './components/diagnostics/HistoryList';
import { DiagnosticReport } from './components/diagnostics/DiagnosticReport';
import { ReportVerifier } from './components/diagnostics/ReportVerifier';
import { AttestationPanel } from './components/diagnostics/AttestationPanel';
import type { ConnectionStatus, NodeMetricsDetailed } from './types/node';
import type { RpcDiagnosticResult, DiagnosticHistoryItem } from './types/rpc';
import type { EvmConnectionDetails, EndpointProfile } from './types/endpoint';
import { DEFAULT_PORTALDOT_V3_EVM_RPC } from './types/endpoint';
import type { CapabilitySnapshot } from './types/capability'; // Import new type
import type { HealthCheckSnapshot, HealthCheckCheck } from './types/healthCheck';
import { sendJsonRpcRequest } from './services/rpcClient';
import { testPortaldotV3EvmConnection, testGenericHttpConnection } from './services/connectionTester';
import { getDiagnosticHistory, saveDiagnosticHistory, clearDiagnosticHistory } from './services/historyStorage';
import { getHealthSnapshots, saveHealthSnapshot } from './services/healthSnapshotStorage';
import { runHealthCheck } from './services/healthCheckRunner';
import type { SubstrateWsProbeResult } from './services/substrateWsProbe';
import { loadWsProbe, saveWsProbe, loadCapability, saveCapability } from './services/sessionRestore';
import { initialSidebarCollapsed } from './utils/sidebarState';
import { defaultLatencyMethodForProfile, defaultClientVersionMethodForProfile } from './utils/metricMethodDefaults';
import { parseLatency, parseClientVersion, latencyFromCheck, versionFromCheck } from './utils/metricParsers';
import { extractEvmSide } from './utils/combinedVerdict';
import { FullDiagnosticRunner } from './components/dashboard/FullDiagnosticRunner';
// Fee Lab is lazy: its panel code stays out of the first load (the
// @polkadot/api chunk was already lazy via dynamic import).
const FeeLabPanel = lazy(() => import('./components/feeLab/FeeLabPanel').then((m) => ({ default: m.FeeLabPanel })));

const initialMetricsDetailed: NodeMetricsDetailed = {
  latency: { status: 'not_tested', value: null },
  clientVersion: { status: 'not_tested', value: null },
  peerCount: { status: 'not_tested', value: null },
  blockHeight: { status: 'not_tested', value: null },
};

// Section <-> URL sync (no router dependency: the app switches on state,
// and the URL is kept in step with replaceState so a section is linkable
// and reloadable). Unknown /app paths fall back to overview, as before;
// trailing slashes are normalized so /app/fee-lab/ opens Fee Lab.
import { sectionFromPath, pathForSection } from './utils/appSections';

function App() {
  const [activeSection, setActiveSection] = useState(() => sectionFromPath(window.location.pathname));
  // replaceState (not pushState): section switches keep the URL honest
  // without flooding the back-button history with every sidebar click.
  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    window.history.replaceState(null, '', pathForSection(section));
  };
  const [endpoint, setEndpoint] = useState(DEFAULT_PORTALDOT_V3_EVM_RPC);
  const [endpointProfile, setEndpointProfile] = useState<EndpointProfile>('portaldot_v3_evm');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<RpcDiagnosticResult | null>(null);
  const [evmConnectionDetails, setEvmConnectionDetails] = useState<EvmConnectionDetails | null>(null);
  const [history, setHistory] = useState<DiagnosticHistoryItem[]>(() => getDiagnosticHistory());
  const [metricsDetailed, setMetricsDetailed] = useState<NodeMetricsDetailed>(initialMetricsDetailed);
  const [capabilitySnapshot, setCapabilitySnapshot] = useState<CapabilitySnapshot | null>(() => loadCapability(endpoint)?.snapshot ?? null); // Lift capability snapshot state
  const [capabilityRestoredAt, setCapabilityRestoredAt] = useState<number | null>(() => loadCapability(endpoint)?.storedAt ?? null);
  const [healthSnapshots, setHealthSnapshots] = useState<HealthCheckSnapshot[]>(() => getHealthSnapshots());
  const [wsProbeResult, setWsProbeResult] = useState<SubstrateWsProbeResult | null>(() => loadWsProbe(endpoint)?.result ?? null);
  const [probeRestoredAt, setProbeRestoredAt] = useState<number | null>(() => loadWsProbe(endpoint)?.storedAt ?? null);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };
  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem('nodescope-sidebar-collapsed', next ? '1' : '0');
      } catch {
        // Session-only preference is best effort; the app still works without it.
      }
      return next;
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const doHealthCheck = async (
    onCheck?: (check: HealthCheckCheck) => void,
  ): Promise<HealthCheckSnapshot> => {
    setIsHealthChecking(true);
    try {
      const snapshot = await runHealthCheck(endpoint, endpointProfile, {
        onRecordResult: (result) => {
          setHistory((_prev) => saveDiagnosticHistory(endpoint, result));
        },
        onCheck,
      });
      saveHealthSnapshot(snapshot);
      setHealthSnapshots(getHealthSnapshots());
      // Fill Node Metrics (and the VerdictBar latency, which reads the
      // same value) from this snapshot's actual checks, so a "Success"
      // badge never sits next to a "—" value again.
      const latency = latencyFromCheck(
        snapshot.checks.find((c) => c.method === defaultLatencyMethodForProfile(endpointProfile)),
        snapshot.timestamp,
      );
      const version = versionFromCheck(
        snapshot.checks.find((c) => c.method === defaultClientVersionMethodForProfile(endpointProfile)),
        snapshot.timestamp,
      );
      if (latency || version) {
        setMetricsDetailed((prev) => ({
          ...prev,
          ...(latency ? { latency } : {}),
          ...(version ? { clientVersion: version } : {}),
        }));
      }
      return snapshot;
    } finally {
      setIsHealthChecking(false);
    }
  };

  const handleRunHealthCheck = async (onCheck?: (check: HealthCheckCheck) => void) => {
    const snap = await doHealthCheck(onCheck);
    const passed = snap.checks.filter((c) => c.success).length;
    pushToast(`Health snapshot saved — ${passed}/${snap.checks.length} checks passed`);
  };

  const handleConnect = async (): Promise<{
    status: ConnectionStatus;
    blockHex: string | null;
    blockAt: number | null;
  }> => {
    setIsLoading(true);
    setConnectionStatus('connecting');
    setEvmConnectionDetails(null);

    let finalStatus: ConnectionStatus = 'error';
    let blockHex: string | null = null;
    let blockAt: number | null = null;
    if (endpointProfile === 'portaldot_v3_evm') {
      const { chainIdResult, blockResult, validation, status } = await testPortaldotV3EvmConnection(endpoint);

      const details: EvmConnectionDetails = {
        chainIdResult,
        blockResult,
        validation,
      };
      setEvmConnectionDetails(details);
      setCurrentResult(chainIdResult);
      setConnectionStatus(status);
      finalStatus = status;
      if (blockResult.success && typeof blockResult.response?.result === 'string') {
        blockHex = blockResult.response.result;
        blockAt = blockResult.timestamp;
      }

      let updated = saveDiagnosticHistory(endpoint, chainIdResult);
      updated = saveDiagnosticHistory(endpoint, blockResult);
      setHistory(updated);
    } else {
      const { result, status } = await testGenericHttpConnection(endpoint);
      setCurrentResult(result);
      setHistory(saveDiagnosticHistory(endpoint, result));
      setConnectionStatus(status);
      finalStatus = status;
    }

    setIsLoading(false);
    return { status: finalStatus, blockHex, blockAt };
  };

  const handleDisconnect = () => {
    setConnectionStatus('disconnected');
    setCurrentResult(null);
    setEvmConnectionDetails(null);
    setMetricsDetailed(initialMetricsDetailed);
    setCapabilitySnapshot(null); // Clear snapshot on disconnect
  };

  const handleRunDiagnostic = async (method: string, params: unknown[]) => {
    setIsLoading(true);
    const result = await sendJsonRpcRequest(endpoint, method, params);
    setCurrentResult(result);
    setHistory(saveDiagnosticHistory(endpoint, result));
    // Same fill as a health-check snapshot: a single diagnostic run for
    // the latency or version method updates its metric from the result.
    if (method === defaultLatencyMethodForProfile(endpointProfile)) {
      setMetricsDetailed((prev) => ({ ...prev, latency: parseLatency(result) }));
    } else if (method === defaultClientVersionMethodForProfile(endpointProfile)) {
      setMetricsDetailed((prev) => ({ ...prev, clientVersion: parseClientVersion(result) }));
    }
    setIsLoading(false);
    return result;
  };

  // Keeps the RPC console's method fields in sync with runs triggered
  // from elsewhere (command palette, overview metric tests).
  const [consoleMethodSignal, setConsoleMethodSignal] = useState<{ method: string; nonce: number } | null>(null);
  const handleRunDiagnosticTracked = async (method: string, params: unknown[]) => {
    setConsoleMethodSignal({ method, nonce: Date.now() });
    return handleRunDiagnostic(method, params);
  };

  const latestHealthSnapshot = useMemo(() => {
    if (healthSnapshots.length === 0) return null;
    return healthSnapshots.reduce(
      (newest, s) => (s.timestamp > newest.timestamp ? s : newest),
      healthSnapshots[0]
    );
  }, [healthSnapshots]);

  const isConnected = connectionStatus === 'connected';
  // Session restore wrappers: a fresh run replaces restored data and is
  // saved for the next reload; a null (e.g. endpoint change clearing the
  // capability snapshot) only clears the restored label, not the store.
  const handleEndpointChange = (next: string) => {
    setEndpoint(next);
    setProbeRestoredAt(null);
    setCapabilityRestoredAt(null);
  };
  const handleWsProbeResultChange = (result: SubstrateWsProbeResult) => {
    setWsProbeResult(result);
    setProbeRestoredAt(null);
    saveWsProbe(endpoint, result);
  };
  const handleCapabilitySnapshotChange = (snapshot: CapabilitySnapshot | null) => {
    setCapabilitySnapshot(snapshot);
    setCapabilityRestoredAt(null);
    if (snapshot) saveCapability(snapshot);
  };
  const runDiagnosticAndShow = (method: string, params: unknown[] = []) => {
    handleSectionChange('diagnostics');
    void handleRunDiagnosticTracked(method, params);
  };
  const paletteCommands: PaletteCommand[] = [
    { id: 'nav-overview', label: 'Go to Overview', group: 'Navigate', hint: '01', keywords: 'home dashboard panels', run: () => handleSectionChange('overview') },
    {
      id: 'nav-trends',
      label: 'Go to Trends & Verdict',
      group: 'Navigate',
      hint: '05',
      keywords: 'trends verdict session drift stall latency progression health',
      run: () => {
        handleSectionChange('overview');
        window.setTimeout(() => {
          const el = document.getElementById('session-trends');
          if (!el) return;
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }, 60);
      },
    },
    { id: 'nav-diagnostics', label: 'Go to RPC Diagnostics', group: 'Navigate', hint: '02', keywords: 'console rpc run method', run: () => handleSectionChange('diagnostics') },
    { id: 'nav-history', label: 'Go to History', group: 'Navigate', hint: '03', keywords: 'report export ledger records', run: () => handleSectionChange('history') },
    { id: 'nav-fee-lab', label: 'Go to Fee Lab', group: 'Navigate', hint: '04', keywords: 'fee lab evm native revive estimate cost gas storage deposit', run: () => handleSectionChange('fee-lab') },
    {
      id: 'nav-combined',
      label: 'Go to Combined Verdict',
      group: 'Navigate',
      hint: '07',
      keywords: 'combined verdict evm substrate two transports',
      run: () => {
        handleSectionChange('overview');
        window.setTimeout(() => {
          const el = document.getElementById('combined-verdict');
          if (!el) return;
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }, 60);
      },
    },
    {
      id: 'nav-wss',
      label: 'Go to Substrate WS Probe',
      group: 'Navigate',
      hint: '06',
      keywords: 'substrate websocket probe wss node health',
      run: () => {
        handleSectionChange('overview');
        window.setTimeout(() => {
          const el = document.getElementById('substrate-ws-probe');
          if (!el) return;
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }, 60);
      },
    },
    {
      id: 'nav-capabilities',
      label: 'Go to Capabilities',
      group: 'Navigate',
      hint: '08',
      keywords: 'capabilities discovery rpc methods advertised',
      run: () => {
        handleSectionChange('overview');
        window.setTimeout(() => {
          const el = document.getElementById('capabilities');
          if (!el) return;
          const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }, 60);
      },
    },
    ...(isConnected
      ? [{ id: 'act-disconnect', label: 'Disconnect from endpoint', group: 'Actions', keywords: 'stop close session', run: () => handleDisconnect() } as PaletteCommand]
      : [{ id: 'act-connect', label: 'Connect & Test endpoint', group: 'Actions', keywords: 'start connect test rpc url', run: () => { void handleConnect(); } } as PaletteCommand]),
    {
      id: 'act-health',
      label: 'Run Health Check',
      group: 'Actions',
      keywords: 'health check snapshot node status',
      run: () => {
        handleSectionChange('overview');
        void handleRunHealthCheck();
      },
    },
    { id: 'run-block', label: 'Run eth_blockNumber', group: 'Run diagnostic', hint: 'RPC', keywords: 'block number height latest', run: () => runDiagnosticAndShow('eth_blockNumber') },
    { id: 'run-chain', label: 'Run eth_chainId', group: 'Run diagnostic', hint: 'RPC', keywords: 'chain id network', run: () => runDiagnosticAndShow('eth_chainId') },
    { id: 'run-net', label: 'Run net_version', group: 'Run diagnostic', hint: 'RPC', keywords: 'network version', run: () => runDiagnosticAndShow('net_version') },
    { id: 'run-client', label: 'Run web3_clientVersion', group: 'Run diagnostic', hint: 'RPC', keywords: 'client version node software', run: () => runDiagnosticAndShow('web3_clientVersion') },
    { id: 'copy-endpoint', label: 'Copy endpoint URL', group: 'Copy', keywords: 'clipboard url rpc address', run: () => { void navigator.clipboard.writeText(endpoint); } },
    ...(currentResult
      ? [{ id: 'copy-result', label: 'Copy latest result JSON', group: 'Copy', keywords: 'clipboard payload response json', run: () => { void navigator.clipboard.writeText(JSON.stringify(currentResult, null, 2)); } } as PaletteCommand]
      : []),
    { id: 'open-github', label: 'Open GitHub repository', group: 'Open', keywords: 'source code repo external', run: () => window.open('https://github.com/Firzadf/nodescope', '_blank', 'noreferrer') },
    { id: 'open-buidl', label: 'Open DoraHacks BUIDL', group: 'Open', keywords: 'hackathon submission external', run: () => window.open('https://dorahacks.io/build/50146', '_blank', 'noreferrer') },
    { id: 'open-demo', label: 'Open demo video', group: 'Open', keywords: 'youtube watch external', run: () => window.open('https://youtu.be/TyTudF3MUaI', '_blank', 'noreferrer') },
  ];

  return (
    <div className="min-h-screen bg-ink text-slate-200">
      <IntroSplash scope="app" />
      <Header
        connectionStatus={connectionStatus}
        liveBlock={extractEvmSide(latestHealthSnapshot)?.blockHeightDecimal ?? null}
      />
      <div className="flex">
        <Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} onOpenPalette={() => setPaletteOpen(true)} collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
        <main className="relative min-w-0 flex-1 p-6">
          <div className="relative max-w-7xl mx-auto space-y-6">
            {activeSection === 'overview' && (
              <div className="space-y-6 stagger">
                <div className="relative z-10 flex flex-wrap items-end justify-between gap-3 bg-ink pt-1">
                  <div>
                    <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">NodeScope / Overview</p>
                    <h2 className="text-3xl font-bold tracking-tight text-white mt-1.5 [text-decoration:none]">
                      Node health, proven over time.
                    </h2>
                  </div>
                  <p className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500 pb-1">Portaldot V3 EVM · Chain 420420777</p>
                </div>
                <FullDiagnosticRunner
                  endpoint={endpoint}
                  endpointProfile={endpointProfile}
                  onConnect={handleConnect}
                  onRunHealthCheck={doHealthCheck}
                  onProbeResult={handleWsProbeResultChange}
                  onCapabilitySnapshot={handleCapabilitySnapshotChange}
                  onGoHistory={() => handleSectionChange('history')}
                  onToast={pushToast}
                />
                <EndpointConfig
                  endpoint={endpoint}
                  onEndpointChange={handleEndpointChange}
                  connectionStatus={connectionStatus}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                  isLoading={isLoading}
                  endpointProfile={endpointProfile}
                  onProfileChange={setEndpointProfile}
                  evmConnectionDetails={evmConnectionDetails}
                />
                <Overview
                  endpoint={endpoint}
                  connectionStatus={connectionStatus}
                  metricsDetailed={metricsDetailed}
                  onUpdateMetricsDetailed={setMetricsDetailed}
                  onExecuteRpc={handleRunDiagnosticTracked}
                  endpointProfile={endpointProfile}
                  capabilitySnapshot={capabilitySnapshot} // Pass down snapshot
                  history={history} // Pass down history
                  onCapabilitySnapshotChange={handleCapabilitySnapshotChange}
                  latestHealthSnapshot={latestHealthSnapshot}
                  healthSnapshots={healthSnapshots}
                  onRunHealthCheck={handleRunHealthCheck}
                  isHealthChecking={isHealthChecking}
                  wsProbeResult={wsProbeResult}
                  onWsProbeResultChange={handleWsProbeResultChange}
                  probeRestoredAt={probeRestoredAt}
                  capabilityRestoredAt={capabilityRestoredAt}
                />
              </div>
            )}
            {activeSection === 'diagnostics' && (
              <div className="space-y-6 stagger">
                <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
                  <div>
                    <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">NodeScope / RPC Diagnostics</p>
                    <h2 className="text-3xl font-bold tracking-tight text-white mt-1.5">
                      Ask the node. Keep the receipt.
                    </h2>
                  </div>
                  <p className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500 pb-1">Manual JSON-RPC · User-triggered only</p>
                </div>
                <RpcConsole
                  endpoint={endpoint}
                  isConnected={connectionStatus === 'connected'}
                  onRunDiagnostic={handleRunDiagnosticTracked}
                  isLoading={isLoading}
                  capabilitySnapshot={capabilitySnapshot} // Pass down snapshot
                  history={history} // Pass down history
                  methodSignal={consoleMethodSignal}
                />
                <ResponseViewer result={currentResult} />
                {evmConnectionDetails && endpointProfile === 'portaldot_v3_evm' && (
                  <div className="bg-panel border border-line rounded-xl p-4 space-y-2">
                    <h4 className="text-sm font-medium text-slate-300">EVM Connection Check Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-data">
                      <div className="bg-black/25 border border-line rounded-lg p-3">
                        <div className="text-slate-400">eth_chainId</div>
                        <div className={evmConnectionDetails.validation.isPortaldotV3Testnet ? 'text-emerald-400 font-medium' : evmConnectionDetails.validation.chainId !== null ? 'text-amber-400 font-medium' : 'text-red-400 font-medium'}>
                          {evmConnectionDetails.validation.isPortaldotV3Testnet
                            ? `Pass — ${evmConnectionDetails.validation.chainIdHex} (${evmConnectionDetails.validation.chainId})`
                            : evmConnectionDetails.validation.error || `Fail — ${evmConnectionDetails.chainIdResult.error || 'Unknown'}`}
                        </div>
                        {evmConnectionDetails.validation.chainId !== null && !evmConnectionDetails.validation.isPortaldotV3Testnet && (
                          <div className="text-amber-300 mt-1">Wrong Chain ID: expected 420420777 (0x190f1ca9), got {String(evmConnectionDetails.validation.chainId)} ({String(evmConnectionDetails.validation.chainIdHex)}).</div>
                        )}
                        {evmConnectionDetails.chainIdResult.response?.error && (
                          <div className="text-slate-400 font-mono mt-1">RPC error [{String(evmConnectionDetails.chainIdResult.response.error.code)}]: {evmConnectionDetails.chainIdResult.response.error.message}</div>
                        )}
                      </div>
                      <div className="bg-black/25 border border-line rounded-lg p-3">
                        <div className="text-slate-400">eth_blockNumber</div>
                        <div className={evmConnectionDetails.blockResult.success ? 'text-emerald-400 font-medium' : evmConnectionDetails.blockResult.response?.error?.code === -32601 ? 'text-amber-400 font-medium' : 'text-red-400 font-medium'}>
                          {evmConnectionDetails.blockResult.success
                            ? `Pass — ${String(evmConnectionDetails.blockResult.response?.result)}`
                            : evmConnectionDetails.blockResult.response?.error
                              ? `Fail — RPC error [${String(evmConnectionDetails.blockResult.response.error.code)}]: ${evmConnectionDetails.blockResult.response.error.message}`
                              : `Fail — ${evmConnectionDetails.blockResult.error || 'Unknown'}`}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeSection === 'fee-lab' && (
              <div className="space-y-6 stagger">
                <Suspense fallback={<div className="empty-shell p-4"><p className="text-sm text-slate-400">Loading Fee Lab…</p></div>}>
                  <FeeLabPanel />
                </Suspense>
              </div>
            )}
            {activeSection === 'history' && (
              <div className="space-y-6 stagger">
                <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
                  <div>
                    <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">NodeScope / History</p>
                    <h2 className="text-3xl font-bold tracking-tight text-white mt-1.5">
                      Every check, on record.
                    </h2>
                  </div>
                  <p className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500 pb-1">Session ledger · Exportable JSON</p>
                </div>
                <DiagnosticReport history={history} healthSnapshots={healthSnapshots} wsProbeResult={wsProbeResult} onExported={() => pushToast('Report exported — verify it on /verify')} />
                <HistoryList
                  history={history}
                  onSelect={(item) => {
                    setCurrentResult(item);
                    handleSectionChange('diagnostics');
                  }}
                  onClear={() => {
                    clearDiagnosticHistory();
                    setHistory([]);
                  }}
                />
                <ReportVerifier />
                <AttestationPanel endpoint={endpoint} />
              </div>
            )}
          </div>
        </main>
      </div>
      <TerminalFeed history={history} />
      <footer className="border-t border-line">
        <div className="px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">
            NodeScope — Built for Portaldot Hacker House 2026
          </p>
          <p className="hidden lg:block font-data text-[11px] uppercase tracking-[0.18em] text-slate-600">
            Report schema · nodescope.diagnostic-report.v1
          </p>
          <div className="flex items-center gap-5 font-data text-[11px] uppercase tracking-[0.18em]">
            <a href="https://github.com/Firzadf/nodescope" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors">
              GitHub
            </a>
            <a href="https://dorahacks.io/build/50146" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors">
              DoraHacks BUIDL
            </a>
            <a href="https://youtu.be/TyTudF3MUaI" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors">
              Demo Video
            </a>
            <a href="/docs" className="text-slate-400 hover:text-white transition-colors">
              Docs
            </a>
            <a href="/judges" className="text-slate-400 hover:text-white transition-colors">
              For Judges
            </a>
          </div>
        </div>
      </footer>
      <CommandPalette open={paletteOpen} commands={paletteCommands} onClose={() => setPaletteOpen(false)} />
      <BackToTop label="Back to top" />
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
