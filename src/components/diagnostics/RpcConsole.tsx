import { useState, useMemo } from 'react';
import type { RpcDiagnosticResult, RpcMethodPreset } from '../../types/rpc';
import type { CapabilitySnapshot } from '../../types/capability';
import type { DiagnosticHistoryItem } from '../../types/rpc';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import { Terminal, Send, RefreshCw } from 'lucide-react';
import { getMethodEvidenceStatus, formatEvidenceLabel, type MethodEvidenceStatus } from '../../utils/capabilityEvidence';

const PRESETS: RpcMethodPreset[] = [
  {
    name: 'Portaldot V3 EVM Chain ID',
    method: 'eth_chainId',
    description: 'EVM JSON-RPC. Live-verified on https://test-evm-rpc-v3.portaldot.dev (2026-10-19) → 0x190f1ca9 (420420777).',
  },
  {
    name: 'EVM Block Number',
    method: 'eth_blockNumber',
    description: 'EVM JSON-RPC. Live-verified on Portaldot V3 EVM endpoint (2026-10-19).',
  },
  {
    name: 'Net Version',
    method: 'net_version',
    description: 'EVM JSON-RPC. Live-verified on Portaldot V3 EVM endpoint (2026-10-19).',
  },
  {
    name: 'Web3 Client Version',
    method: 'web3_clientVersion',
    description: 'EVM JSON-RPC. Live-verified on Portaldot V3 EVM endpoint (2026-10-19).',
  },
  {
    name: 'Substrate System Health',
    method: 'system_health',
    description: 'Substrate JSON-RPC. Returns -32601 on Portaldot V3 EVM endpoint (2026-10-19); use generic_http profile / Substrate HTTP endpoint.',
  },
  {
    name: 'Client Version (Substrate)',
    method: 'system_version',
    description: 'Substrate JSON-RPC. Returns -32601 on Portaldot V3 EVM endpoint (2026-10-19); use generic_http profile.',
  },
  {
    name: 'Chain Header (Substrate)',
    method: 'chain_getHeader',
    description: 'Substrate JSON-RPC. Returns -32601 on Portaldot V3 EVM endpoint (2026-10-19); use generic_http profile.',
  },
  {
    name: 'Chain Name',
    method: 'system_chain',
    description: 'Substrate JSON-RPC. Compatibility on Portaldot V3 EVM endpoint not verified; test via generic_http profile.',
  },
  {
    name: 'Custom Method',
    method: '',
    description: 'Enter any arbitrary JSON-RPC 2.0 method string.',
  },
];

function getPresetEvidenceStatus(
  method: string | undefined,
  snapshot: CapabilitySnapshot | null,
  history: DiagnosticHistoryItem[],
  endpoint: string
): MethodEvidenceStatus {
  if (!method) return 'unknown';
  return getMethodEvidenceStatus(method, snapshot, history, endpoint);
}

interface RpcConsoleProps {
  endpoint: string;
  isConnected: boolean;
  onRunDiagnostic: (method: string, params: unknown[]) => Promise<RpcDiagnosticResult | null>;
  isLoading: boolean;
  capabilitySnapshot: CapabilitySnapshot | null;
  history: DiagnosticHistoryItem[];
}

export function RpcConsole({ endpoint, isConnected, onRunDiagnostic, isLoading, capabilitySnapshot, history }: RpcConsoleProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('eth_chainId');
  const [customMethod, setCustomMethod] = useState<string>('eth_chainId');
  const [paramsInput, setParamsInput] = useState<string>('[]');
  const [paramError, setParamError] = useState<string | null>(null);

  const activePreset = PRESETS.find((p) => p.method === selectedPreset);

  const presetEvidence = useMemo(
    () =>
      PRESETS.map((preset) => ({
        preset,
        status: getPresetEvidenceStatus(preset.method, capabilitySnapshot, history, endpoint),
      })),
    [capabilitySnapshot, history, endpoint]
  );

  const activeEvidenceStatus = getPresetEvidenceStatus(selectedPreset, capabilitySnapshot, history, endpoint);

  const handlePresetChange = (method: string) => {
    setSelectedPreset(method);
    if (method) {
      setCustomMethod(method);
    }
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setParamError(null);

    let parsedParams: unknown[] = [];
    if (paramsInput.trim()) {
      try {
        const parsed = JSON.parse(paramsInput);
        if (!Array.isArray(parsed)) {
          setParamError('Params must be a valid JSON array (e.g., [])');
          return;
        }
        parsedParams = parsed;
      } catch {
        setParamError('Invalid JSON format for parameters');
        return;
      }
    }

    await onRunDiagnostic(customMethod.trim(), parsedParams);
  };

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <PanelLabel index="01" label="RPC CONSOLE" />
            <div className="flex items-center gap-2 mt-2">
              <Terminal className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-semibold text-white">RPC Diagnostic Console</h3>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            Target: <code className="text-slate-200 font-data">{endpoint || 'None'}</code>
          </span>
        </div>

        {!isConnected && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
            Warning: Node is not connected. Diagnostics can be sent, but connection may fail if the endpoint is unreachable.
          </div>
        )}

        <form onSubmit={handleExecute} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Method Preset</label>
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {presetEvidence.map(({ preset, status }) => (
                  <option key={preset.method || 'custom'} value={preset.method}>
                    {preset.name} {preset.method ? `(${preset.method})` : ''} — {formatEvidenceLabel(status)}
                  </option>
                ))}
              </select>
              {activePreset && (
                <p className="text-[11px] text-slate-500 mt-1">{activePreset.description}</p>
              )}
              {selectedPreset && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Evidence: <span
                    className={
                      activeEvidenceStatus === 'confirmed'
                        ? 'text-emerald-400 font-medium'
                        : activeEvidenceStatus === 'advertised'
                          ? 'text-amber-400 font-medium'
                          : activeEvidenceStatus === 'unsupported'
                            ? 'text-red-400 font-medium'
                            : 'text-slate-400'
                    }
                  >
                    {formatEvidenceLabel(activeEvidenceStatus)}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">JSON-RPC Method</label>
              <input
                type="text"
                value={customMethod}
                onChange={(e) => setCustomMethod(e.target.value)}
                placeholder="e.g., eth_chainId"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Parameters (JSON Array)</label>
            <input
              type="text"
              value={paramsInput}
              onChange={(e) => setParamsInput(e.target.value)}
              placeholder="[]"
              className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 ${
                paramError ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-cyan-500'
              }`}
            />
            {paramError && <p className="text-xs text-red-400 mt-1">{paramError}</p>}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading || !customMethod.trim() || !endpoint.trim()}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm flex items-center gap-2 transition-colors"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isLoading ? 'Executing...' : 'Run Diagnostic'}
            </button>
          </div>
        </form>
      </div>
    </Card>
  );
}
