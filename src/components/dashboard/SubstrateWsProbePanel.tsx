import { useState } from 'react';
import { Radio, Loader2 } from 'lucide-react';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import {
  DEFAULT_SUBSTRATE_WS_URL,
  probeSubstrateWs,
  type SubstrateWsProbeResult,
} from '../../services/substrateWsProbe';

/**
 * One-click Substrate WebSocket probe. User-triggered only, like every other
 * check in NodeScope: no polling, no background connection.
 * The transport matters: this endpoint speaks Substrate methods, not eth_*.
 */
export function SubstrateWsProbePanel() {
  const [url, setUrl] = useState(DEFAULT_SUBSTRATE_WS_URL);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SubstrateWsProbeResult | null>(null);

  const run = async () => {
    setRunning(true);
    try {
      setResult(await probeSubstrateWs(url.trim() || DEFAULT_SUBSTRATE_WS_URL));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card ticks>
      <div className="space-y-4">
        <PanelLabel index="06" label="SUBSTRATE WS PROBE" />
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Radio className="w-5 h-5 text-slate-400" />
          Substrate Node, over WebSocket
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          The HTTP endpoint covers the EVM side. This probe covers the other transport: the Portaldot
          testnet node over WebSocket, with system_health, system_chain, system_version, and
          chain_getHeader. An eth_* call here correctly returns Method not found, that is the
          Substrate transport answering, not a broken node.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
            aria-label="Substrate WebSocket URL"
            className="flex-1 bg-black/25 border border-line rounded-lg px-3 py-2 text-sm font-data text-slate-200"
          />
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="px-4 py-2 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-sm font-medium disabled:opacity-50"
          >
            {running ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Probing…
              </span>
            ) : (
              'Probe WSS Node'
            )}
          </button>
        </div>
        {result && (
          <div className="bg-black/25 border border-line rounded-lg p-4 text-sm space-y-2">
            <p className={result.status === 'ok' ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
              {result.status === 'ok' ? 'Node answered over WebSocket' : `Probe failed: ${result.error ?? 'Unknown error'}`}
            </p>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-data">
              <div><dt className="text-slate-500">Chain</dt><dd className="text-slate-200 mt-0.5">{result.chain ?? '—'}</dd></div>
              <div><dt className="text-slate-500">Version</dt><dd className="text-slate-200 mt-0.5 break-all">{result.version ?? '—'}</dd></div>
              <div><dt className="text-slate-500">Peers</dt><dd className="text-slate-200 mt-0.5">{result.peers ?? '—'}</dd></div>
              <div><dt className="text-slate-500">Syncing</dt><dd className="text-slate-200 mt-0.5">{result.isSyncing === null ? '—' : result.isSyncing ? 'Yes' : 'No'}</dd></div>
              <div><dt className="text-slate-500">Header</dt><dd className="text-slate-200 mt-0.5">{result.headerNumberDecimal ?? '—'}</dd></div>
              <div><dt className="text-slate-500">Header (hex)</dt><dd className="text-slate-200 mt-0.5">{result.headerNumberHex ?? '—'}</dd></div>
              <div><dt className="text-slate-500">Handshake</dt><dd className="text-slate-200 mt-0.5">{result.handshakeMs === null ? '—' : `${result.handshakeMs} ms`}</dd></div>
              <div><dt className="text-slate-500">Total</dt><dd className="text-slate-200 mt-0.5">{result.totalMs === null ? '—' : `${result.totalMs} ms`}</dd></div>
            </dl>
            <p className="text-[11px] text-slate-500">
              One connection, closed after the answers arrive. Header numbers here are Substrate
              headers, not EVM block numbers, so they are never subtracted from an EVM height.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
