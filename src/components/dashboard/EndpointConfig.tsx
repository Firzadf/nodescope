import { useState } from 'react';
import { validateRpcUrl } from '../../utils/urlValidator';
import type { ConnectionStatus } from '../../types/node';
import type { EvmConnectionDetails, EndpointProfile } from '../../types/endpoint';
import { Card } from '../common/Card';
import { Globe, AlertCircle, RefreshCw } from 'lucide-react';

interface EndpointConfigProps {
  endpoint: string;
  onEndpointChange: (url: string) => void;
  connectionStatus: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  isLoading: boolean;
  endpointProfile: EndpointProfile;
  onProfileChange: (profile: EndpointProfile) => void;
  evmConnectionDetails: EvmConnectionDetails | null;
}

export function EndpointConfig({
  endpoint,
  onEndpointChange,
  connectionStatus,
  onConnect,
  onDisconnect,
  isLoading,
  endpointProfile,
  onProfileChange,
  evmConnectionDetails,
}: EndpointConfigProps) {
  const [inputUrl, setInputUrl] = useState(endpoint);
  // Validate the prefilled endpoint on mount so a valid URL enables "Connect & Test"
  // immediately and a genuinely invalid prefilled URL is rejected before any interaction.
  const [validationError, setValidationError] = useState<string | null>(() => {
    const trimmed = endpoint.trim();
    if (!trimmed) return null;
    const result = validateRpcUrl(trimmed);
    return result.isValid ? null : result.error || 'Invalid URL';
  });

  const handleUrlChange = (val: string) => {
    setInputUrl(val);
    onEndpointChange(val);
    const result = validateRpcUrl(val);
    if (!val.trim()) {
      setValidationError(null);
    } else if (!result.isValid) {
      setValidationError(result.error || 'Invalid URL');
    } else {
      setValidationError(null);
    }
  };

  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting' || isLoading;

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">RPC Endpoint Configuration</h3>
          </div>
          <div className="text-xs text-slate-400">
            Status:{' '}
            <span
              className={`font-medium ${
                isConnected
                  ? 'text-emerald-400'
                  : connectionStatus === 'error'
                  ? 'text-red-400'
                  : 'text-slate-400'
              }`}
            >
              {connectionStatus.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Endpoint Scope</label>
          <div className="flex gap-2 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="endpoint-profile"
                checked={endpointProfile === 'portaldot_v3_evm'}
                onChange={() => onProfileChange('portaldot_v3_evm')}
                className="accent-cyan-500"
              />
              <span className="text-slate-200">Portaldot V3 EVM (HTTP JSON-RPC)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer ml-4">
              <input
                type="radio"
                name="endpoint-profile"
                checked={endpointProfile === 'generic_http'}
                onChange={() => onProfileChange('generic_http')}
                className="accent-slate-400"
              />
              <span className="text-slate-400">Generic / Substrate HTTP JSON-RPC</span>
            </label>
          </div>
          <p className="text-[11px] text-slate-500">
            {endpointProfile === 'portaldot_v3_evm'
              ? 'Validates eth_chainId (420420777) + eth_blockNumber. Substrate methods are not used on this profile.'
              : 'Preserves generic Substrate HTTP behavior (system_health, etc.). No WebSocket support claimed.'}
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-300">Node JSON-RPC URL</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://test-evm-rpc-v3.portaldot.dev"
                disabled={isConnected || isConnecting}
                className={`w-full bg-slate-950 border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${
                  validationError
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-slate-700 focus:ring-cyan-500'
                } disabled:opacity-50`}
              />
            </div>
            {isConnected ? (
              <button
                type="button"
                onClick={onDisconnect}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnect}
                disabled={isConnecting || !!validationError || !inputUrl.trim()}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm flex items-center gap-2 transition-colors"
              >
                {isConnecting && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isConnecting ? 'Testing...' : 'Connect & Test'}
              </button>
            )}
          </div>
          {validationError && (
            <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {validationError}
            </p>
          )}
        </div>

        {evmConnectionDetails && endpointProfile === 'portaldot_v3_evm' && (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-slate-300">EVM Endpoint Checks (HTTP JSON-RPC — no WebSocket)</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-900/60 border border-slate-800 rounded p-2.5">
                <div className="text-slate-500">eth_chainId</div>
                <div className={evmConnectionDetails.validation.isPortaldotV3Testnet ? 'text-emerald-400 font-medium' : evmConnectionDetails.validation.chainId !== null ? 'text-amber-400 font-medium' : 'text-red-400 font-medium'}>
                  {evmConnectionDetails.validation.isPortaldotV3Testnet
                    ? `Pass — ${evmConnectionDetails.validation.chainIdHex} (${evmConnectionDetails.validation.chainId})`
                    : 'Fail'}
                </div>
                {evmConnectionDetails.validation.chainId !== null && !evmConnectionDetails.validation.isPortaldotV3Testnet && (
                  <div className="text-amber-300 mt-1">Wrong Chain ID: expected 420420777 (0x190f1ca9).</div>
                )}
                {evmConnectionDetails.chainIdResult.response?.error && (
                  <div className="text-slate-400 font-mono mt-1 text-[11px]">RPC error [{String(evmConnectionDetails.chainIdResult.response.error.code)}]: {evmConnectionDetails.chainIdResult.response.error.message}</div>
                )}
                {evmConnectionDetails.chainIdResult.error && !evmConnectionDetails.chainIdResult.response?.error && (
                  <div className="text-red-400 font-mono mt-1 text-[11px]">{evmConnectionDetails.chainIdResult.error}</div>
                )}
              </div>
              <div className="bg-slate-900/60 border border-slate-800 rounded p-2.5">
                <div className="text-slate-500">eth_blockNumber</div>
                <div className={evmConnectionDetails.blockResult.success ? 'text-emerald-400 font-medium' : evmConnectionDetails.blockResult.response?.error?.code === -32601 ? 'text-amber-400 font-medium' : 'text-red-400 font-medium'}>
                  {evmConnectionDetails.blockResult.success
                    ? `Pass — ${String(evmConnectionDetails.blockResult.response?.result)}`
                    : evmConnectionDetails.blockResult.response?.error
                      ? `Unsupported method [${String(evmConnectionDetails.blockResult.response.error.code)}]: ${evmConnectionDetails.blockResult.response.error.message}`
                      : evmConnectionDetails.blockResult.error || 'Failed — unknown error'}
                </div>
                {evmConnectionDetails.blockResult.response?.error && evmConnectionDetails.blockResult.response.error.code !== -32601 && (
                  <div className="text-slate-400 font-mono mt-1 text-[11px]">Code {String(evmConnectionDetails.blockResult.response.error.code)}</div>
                )}
              </div>
            </div>
            <div className="text-[11px] text-slate-500">A matching Chain ID alone does not prove testnet deployment. Debug payloads are redacted in exported reports.</div>
          </div>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-400 space-y-1">
          <p className="font-medium text-slate-300">CORS & Browser Security Notice:</p>
          <p>
            Direct browser-to-node requests require the target JSON-RPC node to enable CORS headers (e.g.{' '}
            <code className="text-slate-200">Access-Control-Allow-Origin: *</code>). If you encounter network errors, verify your
            node&apos;s CORS settings.
          </p>
        </div>
      </div>
    </Card>
  );
}
