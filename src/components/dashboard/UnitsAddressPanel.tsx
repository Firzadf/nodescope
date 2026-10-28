import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import { DEFAULT_SUBSTRATE_WS_URL } from '../../services/substrateWsProbe';
import { substrateRpc } from '../../services/substrateRpc';
import { confirmAddressOnRuntime } from '../../services/addressConfirm';
import type { AddressMapping } from '../../utils/addressMap';
import { ADDRESS_RULE_TEXT, unitsFromProperties, type UnitsSanity } from '../../utils/unitsSanity';

interface UnitsAddressPanelProps {
  initialUnits?: UnitsSanity | null;
  onUnits?: (units: UnitsSanity) => void;
}

export function UnitsAddressPanel({ initialUnits = null, onUnits }: UnitsAddressPanelProps) {
  const [wss, setWss] = useState(DEFAULT_SUBSTRATE_WS_URL);
  const [units, setUnits] = useState<UnitsSanity | null>(initialUnits);
  const [unitsError, setUnitsError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [input, setInput] = useState('');
  const [mapped, setMapped] = useState<AddressMapping | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [runtimeNote, setRuntimeNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const readUnits = async () => {
    setReading(true);
    setUnitsError(null);
    const res = await substrateRpc(wss.trim(), [{ method: 'system_properties', params: [] }]);
    setReading(false);
    if (!res.ok) {
      setUnitsError(res.error);
      return;
    }
    const props = res.results[0] && typeof res.results[0] === 'object' ? res.results[0] as { tokenDecimals?: unknown; tokenSymbol?: unknown; ss58Format?: unknown } : null;
    const next = unitsFromProperties(props);
    setUnits(next);
    onUnits?.(next);
  };

  const map = async () => {
    setRuntimeNote(null);
    try {
      const { mapAddress } = await import('../../utils/addressMap');
      setMapped(mapAddress(input, units?.ss58Format ?? 42));
      setMapError(null);
    } catch (err) {
      setMapped(null);
      setMapError(err instanceof Error ? err.message : 'Could not map that address.');
    }
  };

  const confirm = async () => {
    if (!mapped) return;
    setConfirming(true);
    setRuntimeNote(null);
    const runtime = await confirmAddressOnRuntime(wss.trim(), mapped.h160, mapped.fallbackAccountId);
    setConfirming(false);
    if (runtime.error) {
      setRuntimeNote(`Runtime call failed: ${runtime.error}`);
      return;
    }
    const accountMatch = runtime.accountId === mapped.fallbackAccountId.toLowerCase();
    const h160Match = runtime.h160 === mapped.h160.toLowerCase();
    if (accountMatch && h160Match) {
      setRuntimeNote('Runtime ReviveApi agrees with the stateless fallback. No OriginalAccount override on this address.');
    } else {
      setRuntimeNote(`Runtime differs from the fallback. ReviveApi_account_id → ${runtime.accountId ?? '—'}; ReviveApi_address → ${runtime.h160 ?? '—'}. The runtime value wins: an OriginalAccount entry is present, or the call could not be decoded.`);
    }
  };

  return (
    <Card ticks>
      <div className="space-y-4">
        <PanelLabel index="10" label="UNITS & ADDRESSES" />
        <h3 className="text-lg font-semibold text-white">Decimals and H160 ↔ AccountId32</h3>
        <p className="text-xs leading-relaxed text-slate-400">
          Reads <code className="font-data text-slate-300">system_properties</code> and maps addresses with the pallet-revive
          AccountId32Mapper. Nothing is signed. The runtime check is a <code className="font-data text-slate-300">state_call</code> of
          ReviveApi only.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input aria-label="Substrate WebSocket URL for units" value={wss} onChange={(e) => setWss(e.target.value)} spellCheck={false} className="flex-1 rounded-lg border border-line bg-black/25 px-3 py-2 font-data text-sm text-slate-200" />
          <button type="button" onClick={() => void readUnits()} disabled={reading} className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-300 disabled:opacity-50">
            {reading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Reading…</span> : 'Read chain units'}
          </button>
        </div>
        {unitsError && <p className="text-sm text-red-400">{unitsError}</p>}
        {units && (
          <div className={`rounded-lg border p-4 text-sm ${units.decimalTrap || units.mismatch ? 'border-amber-500/40 bg-amber-500/5' : 'border-line bg-black/25'}`}>
            <p className="font-medium text-slate-100">
              {units.symbol ?? 'Token'} · {units.nativeDecimals ?? '—'} decimals · ss58 {units.ss58Format ?? '—'} · EVM convention {units.evmDecimals}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{units.detail}</p>
            {units.trapFactor && <p className="mt-1 font-data text-xs text-amber-200">Trap factor {units.trapFactor}×</p>}
          </div>
        )}
        <div className="space-y-2 border-t border-line pt-4">
          <label htmlFor="address-map" className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">H160, AccountId32, or SS58</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="address-map" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} placeholder="0x… or 5…" className="flex-1 rounded-lg border border-line bg-black/25 px-3 py-2 font-data text-sm text-slate-200" />
            <button type="button" onClick={() => void map()} className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-graphite">Map</button>
          </div>
          {mapError && <p className="text-sm text-red-400">{mapError}</p>}
          {mapped && (
            <dl className="grid gap-2 font-data text-xs text-slate-300">
              <div><dt className="text-slate-500">H160</dt><dd className="break-all text-slate-100">{mapped.h160}</dd></div>
              <div><dt className="text-slate-500">Fallback AccountId32</dt><dd className="break-all text-slate-100">{mapped.fallbackAccountId}</dd></div>
              <div><dt className="text-slate-500">SS58 (prefix {mapped.ss58Prefix})</dt><dd className="break-all text-slate-100">{mapped.ss58}</dd></div>
              <div><dt className="text-slate-500">Rule</dt><dd>{mapped.rule}{mapped.ethDerived ? ' · eth-derived' : ''}</dd></div>
            </dl>
          )}
          {mapped && (
            <button type="button" onClick={() => void confirm()} disabled={confirming} className="rounded-lg border border-line px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50">
              {confirming ? 'Asking the runtime…' : 'Confirm with ReviveApi'}
            </button>
          )}
          {runtimeNote && <p className="text-xs leading-relaxed text-slate-300">{runtimeNote}</p>}
          <p className="text-[11px] leading-relaxed text-slate-500">{ADDRESS_RULE_TEXT}</p>
        </div>
      </div>
    </Card>
  );
}
