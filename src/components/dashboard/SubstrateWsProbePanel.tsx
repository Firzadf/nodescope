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
export function SubstrateWsProbePanel({ onResult, initialResult = null, restoredAt = null }: { onResult?: (result: SubstrateWsProbeResult) => void; initialResult?: SubstrateWsProbeResult | null; restoredAt?: number | null } = {}) {
  const [url, setUrl] = useState(DEFAULT_SUBSTRATE_WS_URL);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SubstrateWsProbeResult | null>(initialResult);

  const run = async () => {
    setRunning(true);
    try {
      const probeResult = await probeSubstrateWs(url.trim() || DEFAULT_SUBSTRATE_WS_URL);
      setResult(probeResult);
      onResult?.(probeResult);
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
          testnet node over WebSocket, with system_health, system_syncState, system_chain, system_version,
          chain_getHeader, and chain_getFinalizedHead. Finality lag is best head minus finalized head
          on this same WebSocket. It is never an EVM height minus a Substrate height.
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
            {restoredAt !== null && (
              <p className="text-[11px] text-slate-500">
                Restored from previous session · {new Date(restoredAt).toLocaleString()} · re-run Probe WSS Node for a fresh result.
              </p>
            )}
            <p className={result.status === 'ok' ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
              {result.status === 'ok' ? 'Node answered over WebSocket' : `Probe failed: ${result.error ?? 'Unknown error'}`}
            </p>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-data">
              <div><dt className="text-slate-500">Chain</dt><dd className="text-slate-200 mt-0.5">{result.chain ?? '—'}</dd></div>
              <div><dt className="text-slate-500">Version</dt><dd className="text-slate-200 mt-0.5 break-all">{result.version ?? '—'}</dd></div>
              <div><dt className="text-slate-500">Peers</dt><dd className="text-slate-200 mt-0.5">{result.peers ?? '—'}</dd></div>
              <div><dt className="text-slate-500">Syncing</dt><dd className="text-slate-200 mt-0.5">{result.isSyncing === null ? '—' : result.isSyncing ? 'Yes' : 'No'}</dd></div>
              <div><dt className="text-slate-500">Best head</dt><dd className="text-slate-200 mt-0.5">{result.headerNumberDecimal ?? '—'}</dd></div>
              <div><dt className="text-slate-500">Finalized</dt><dd className="text-slate-200 mt-0.5">{result.finalizedNumberDecimal ?? '—'}</dd></div>
              <div><dt className="text-slate-500">Finality lag</dt><dd className="text-slate-200 mt-0.5">{result.finalityLagBlocks == null ? '—' : `${result.finalityLagBlocks} blocks`}</dd></div>
              <div><dt className="text-slate-500">Sync</dt><dd className="text-slate-200 mt-0.5">{result.syncCurrentBlock == null ? '—' : `${result.syncCurrentBlock} / ${result.syncHighestBlock ?? '—'}`}</dd></div>
              <div><dt className="text-slate-500">Handshake</dt><dd className="text-slate-200 mt-0.5">{result.handshakeMs === null ? '—' : `${result.handshakeMs} ms`}</dd></div>
              <div><dt className="text-slate-500">Total</dt><dd className="text-slate-200 mt-0.5">{result.totalMs === null ? '—' : `${result.totalMs} ms`}</dd></div>
            </dl>
            {result.peers === 0 && result.shouldHavePeers !== false && (
              <p className="text-xs text-amber-300">No peers, and the node says it should have them.</p>
            )}
            {result.exposedMethodsWithheld ? (
              <p className="text-xs leading-relaxed text-slate-300">{result.exposedMethodsNote}</p>
            ) : result.advertisedUnsafeMethods && result.advertisedUnsafeMethods.length > 0 ? (
              <p className="text-xs text-red-300">
                Unsafe operator methods advertised, not called: {result.advertisedUnsafeMethods.join(', ')}
              </p>
            ) : null}
            <p className="text-[11px] text-slate-500">
              One connection, closed after the answers arrive. Finality lag subtracts two Substrate
              heads. An EVM block number is a different counter and is never subtracted from these.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
