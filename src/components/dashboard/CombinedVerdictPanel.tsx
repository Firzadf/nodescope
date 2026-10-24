import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import type { HealthCheckSnapshot } from '../../types/healthCheck';
import type { SubstrateWsProbeResult } from '../../services/substrateWsProbe';
import { CROSS_TRANSPORT_NOTE, computeCombinedVerdict, extractEvmSide } from '../../utils/combinedVerdict';

interface CombinedVerdictPanelProps {
  latestHealthSnapshot: HealthCheckSnapshot | null;
  wsProbeResult: SubstrateWsProbeResult | null;
}

const STATUS_LABEL: Record<string, string> = {
  complete: 'COMPLETE — BOTH TRANSPORTS ANSWERED',
  partial: 'PARTIAL — ONE TRANSPORT ONLY',
  unavailable: 'UNAVAILABLE — NO TRANSPORT YET',
};

export function CombinedVerdictPanel({ latestHealthSnapshot, wsProbeResult }: CombinedVerdictPanelProps) {
  const verdict = computeCombinedVerdict(extractEvmSide(latestHealthSnapshot), wsProbeResult);
  const evm = verdict.evm;
  const ws = verdict.substrate;

  return (
    <Card ticks>
      <div className="space-y-4">
        <PanelLabel index="07" label="COMBINED VERDICT" />
        <h3 className="text-lg font-semibold text-white">One node, two transports, one verdict</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          The EVM side comes from your latest health snapshot. The Substrate side comes from the
          WebSocket probe below. Run both, and this panel reads them together. It does not poll,
          and it does not invent a side that has not run yet.
        </p>
        <p className={`text-sm font-data font-semibold ${
          verdict.status === 'complete' ? 'text-emerald-400' : verdict.status === 'partial' ? 'text-amber-400' : 'text-slate-400'
        }`}>
          {STATUS_LABEL[verdict.status]}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-data">
          <div className="bg-black/25 border border-line rounded-lg p-4 space-y-1.5">
            <p className="text-slate-500 uppercase tracking-[0.14em]">EVM · HTTP</p>
            {evm ? (
              <>
                <p><span className="text-slate-500">Endpoint </span><span className="text-slate-200">{evm.endpointOrigin}</span></p>
                <p><span className="text-slate-500">Block </span><span className="text-slate-200">{evm.blockHeightDecimal ?? '—'}{evm.blockHeightHex ? ` (${evm.blockHeightHex})` : ''}</span></p>
                <p><span className="text-slate-500">Chain </span><span className="text-slate-200">{evm.chainIdDecimal ?? '—'}</span></p>
                <p><span className="text-slate-500">Checks </span><span className="text-slate-200">{evm.checksPassed}/{evm.checksTotal} passed</span></p>
                <p><span className="text-slate-500">Era </span><span className="text-slate-200">{evm.era}</span></p>
                <p><span className="text-slate-500">Observed </span><span className="text-slate-200">{evm.timestamp}</span></p>
              </>
            ) : (
              <p className="text-slate-400">No health snapshot yet.</p>
            )}
          </div>
          <div className="bg-black/25 border border-line rounded-lg p-4 space-y-1.5">
            <p className="text-slate-500 uppercase tracking-[0.14em]">Substrate · WebSocket</p>
            {ws ? (
              <>
                <p><span className="text-slate-500">Status </span><span className="text-slate-200">{ws.status === 'ok' ? 'Answered' : `Failed: ${ws.error ?? 'unknown error'}`}</span></p>
                <p><span className="text-slate-500">Chain </span><span className="text-slate-200">{ws.chain ?? '—'}</span></p>
                <p><span className="text-slate-500">Header </span><span className="text-slate-200">{ws.headerNumberDecimal ?? '—'}{ws.headerNumberHex ? ` (${ws.headerNumberHex})` : ''}</span></p>
                <p><span className="text-slate-500">Peers </span><span className="text-slate-200">{ws.peers ?? '—'}</span></p>
                <p><span className="text-slate-500">Syncing </span><span className="text-slate-200">{ws.isSyncing === null ? '—' : ws.isSyncing ? 'Yes' : 'No'}</span></p>
                <p><span className="text-slate-500">Version </span><span className="text-slate-200 break-all">{ws.version ?? '—'}</span></p>
              </>
            ) : (
              <p className="text-slate-400">No probe result yet.</p>
            )}
          </div>
        </div>
        {verdict.warnings.length > 0 && (
          <ul className="space-y-1 text-xs text-amber-300">
            {verdict.warnings.map((w) => (
              <li key={w}>· {w}</li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-500 leading-relaxed border-t border-line pt-3">{CROSS_TRANSPORT_NOTE}</p>
      </div>
    </Card>
  );
}
