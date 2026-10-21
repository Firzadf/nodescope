import { useState } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Overview } from './components/dashboard/Overview';
import { EndpointConfig } from './components/dashboard/EndpointConfig';
import { RpcConsole } from './components/diagnostics/RpcConsole';
import { ResponseViewer } from './components/diagnostics/ResponseViewer';
import { HistoryList } from './components/diagnostics/HistoryList';
import { DiagnosticReport } from './components/diagnostics/DiagnosticReport';
import type { ConnectionStatus, NodeMetricsDetailed } from './types/node';
import type { RpcDiagnosticResult, DiagnosticHistoryItem } from './types/rpc';
import type { EvmConnectionDetails, EndpointProfile } from './types/endpoint';
import type { CapabilitySnapshot } from './types/capability'; // Import new type
import type { HealthCheckSnapshot } from './types/healthCheck';
import { sendJsonRpcRequest } from './services/rpcClient';
import { testPortaldotV3EvmConnection, testGenericHttpConnection } from './services/connectionTester';
import { getDiagnosticHistory, saveDiagnosticHistory, clearDiagnosticHistory } from './services/historyStorage';
import { getHealthSnapshots, saveHealthSnapshot } from './services/healthSnapshotStorage';
import { runHealthCheck } from './services/healthCheckRunner';

const initialMetricsDetailed: NodeMetricsDetailed = {
  latency: { status: 'not_tested', value: null },
  clientVersion: { status: 'not_tested', value: null },
  peerCount: { status: 'not_tested', value: null },
  blockHeight: { status: 'not_tested', value: null },
};

function App() {
  const [activeSection, setActiveSection] = useState('overview');
  const [endpoint, setEndpoint] = useState('');
  const [endpointProfile, setEndpointProfile] = useState<EndpointProfile>('portaldot_v3_evm');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isLoading, setIsLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<RpcDiagnosticResult | null>(null);
  const [evmConnectionDetails, setEvmConnectionDetails] = useState<EvmConnectionDetails | null>(null);
  const [history, setHistory] = useState<DiagnosticHistoryItem[]>(() => getDiagnosticHistory());
  const [metricsDetailed, setMetricsDetailed] = useState<NodeMetricsDetailed>(initialMetricsDetailed);
  const [capabilitySnapshot, setCapabilitySnapshot] = useState<CapabilitySnapshot | null>(null); // Lift capability snapshot state
  const [healthSnapshots, setHealthSnapshots] = useState<HealthCheckSnapshot[]>(() => getHealthSnapshots());
  const [isHealthChecking, setIsHealthChecking] = useState(false);

  const handleRunHealthCheck = async () => {
    setIsHealthChecking(true);
    try {
      const snapshot = await runHealthCheck(endpoint, endpointProfile, {
        onRecordResult: (result) => {
          setHistory((_prev) => saveDiagnosticHistory(endpoint, result));
        },
      });
      saveHealthSnapshot(snapshot);
      setHealthSnapshots(getHealthSnapshots());
    } finally {
      setIsHealthChecking(false);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setConnectionStatus('connecting');
    setEvmConnectionDetails(null);

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

      let updated = saveDiagnosticHistory(endpoint, chainIdResult);
      updated = saveDiagnosticHistory(endpoint, blockResult);
      setHistory(updated);
    } else {
      const { result, status } = await testGenericHttpConnection(endpoint);
      setCurrentResult(result);
      setHistory(saveDiagnosticHistory(endpoint, result));
      setConnectionStatus(status);
    }

    setIsLoading(false);
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
    setIsLoading(false);
    return result;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Header connectionStatus={connectionStatus} />
      <div className="flex">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeSection === 'overview' && (
              <>
                <EndpointConfig
                  endpoint={endpoint}
                  onEndpointChange={setEndpoint}
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
                  onExecuteRpc={handleRunDiagnostic}
                  endpointProfile={endpointProfile}
                  capabilitySnapshot={capabilitySnapshot} // Pass down snapshot
                  history={history} // Pass down history
                  onCapabilitySnapshotChange={setCapabilitySnapshot}
                  latestHealthSnapshot={healthSnapshots.length > 0 ? healthSnapshots[healthSnapshots.length - 1] : null}
                  onRunHealthCheck={handleRunHealthCheck}
                  isHealthChecking={isHealthChecking}
                />
              </>
            )}
            {activeSection === 'diagnostics' && (
              <div className="space-y-6">
                <RpcConsole
                  endpoint={endpoint}
                  isConnected={connectionStatus === 'connected'}
                  onRunDiagnostic={handleRunDiagnostic}
                  isLoading={isLoading}
                  capabilitySnapshot={capabilitySnapshot} // Pass down snapshot
                  history={history} // Pass down history
                />
                <ResponseViewer result={currentResult} />
                {evmConnectionDetails && endpointProfile === 'portaldot_v3_evm' && (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-medium text-slate-300">EVM Connection Check Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-950 border border-slate-800 rounded p-3">
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
                      <div className="bg-slate-950 border border-slate-800 rounded p-3">
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
            {activeSection === 'history' && (
              <div className="space-y-6">
                <DiagnosticReport history={history} />
                <HistoryList
                  history={history}
                  onSelect={(item) => {
                    setCurrentResult(item);
                    setActiveSection('diagnostics');
                  }}
                  onClear={() => {
                    clearDiagnosticHistory();
                    setHistory([]);
                  }}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
