/**
 * Fee Lab (ported from DualFee, phase 1 of the merge).
 *
 * Measures the same operation on both Portaldot V3 surfaces, from the
 * browser, and compares the all-in cost:
 * - EVM: eth_estimateGas x eth_gasPrice (the gas figure already folds the
 *   storage deposit in).
 * - Native: ReviveApi dry-run + TransactionPaymentApi.query_info, reported
 *   as partialFee + storage deposit separately.
 *
 * NodeScope adaptations, all deliberate:
 * - User-triggered only. DualFee opened both connections at boot and polled
 *   them every 12s; this panel opens nothing until you press Measure, never
 *   polls, and closes the shared Substrate connection when it unmounts.
 * - No share URL and no DualFee history recording in phase 1: NodeScope's
 *   report schema is diagnostic records, and DualFee's history format does
 *   not belong in it. The comparison is shown, not stored.
 * - No framer-motion: plain divs, NodeScope tokens (bg-panel, border-line,
 *   font-data, btn-primary).
 * - Timeouts, so a dead endpoint can never hang Measure: native connect
 *   10s with no auto-reconnect, native estimate 15s, EVM request 10s with
 *   one retry on network failure. A timed-out leg reports unavailable and
 *   the EVM leg starts without waiting on the native connection.
 * - The From address is only a dry-run origin. Nothing here signs, sends,
 *   or asks for a wallet.
 */
import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_NETWORK,
  FeeRegistryBytecode,
  SampleTokenBytecode,
  compareLegs,
  disconnectApi,
  erc20Decimals,
  estimateEvm,
  estimateNative,
  formatUnits,
  getApi,
  isH160,
  liveDecimals,
  nativeMethodFor,
  parseUnits,
  SAMPLE,
  type Comparison,
  type DualTx,
  type EvmLeg,
  type NativeLeg,
  type NetworkConfig,
} from '../../services/feeLab/estimate';
import { PORTALDOT_CHAIN_ID } from '../../utils/siteConstants';

type OpId = 'transfer' | 'erc20' | 'deploy' | 'calldata';

const OPS: { id: OpId; label: string }[] = [
  { id: 'transfer', label: 'Native transfer' },
  { id: 'erc20', label: 'ERC-20 transfer' },
  { id: 'deploy', label: 'Contract deploy' },
  { id: 'calldata', label: 'Paste calldata' },
];

type CodeChoice = 'sample' | 'registry' | 'custom';

const codeOf = (c: CodeChoice, custom: string) =>
  c === 'sample' ? SampleTokenBytecode : c === 'registry' ? FeeRegistryBytecode : custom.trim();

const tpot = (planck: bigint, decimals = 14, frac = 6) => formatUnits(planck, decimals, frac);

function fmtRatio(r: number | null): string {
  if (r === null) return '—';
  if (r >= 100) return `${Math.round(r).toLocaleString('en-US')}×`;
  if (r >= 10) return `${r.toFixed(1)}×`;
  return `${r.toFixed(3)}×`;
}

function frac(x: bigint, max: bigint): number {
  if (max === 0n) return 0;
  return Number((x * 1_000_000n) / max) / 1_000_000;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        className="mt-1.5 w-full bg-black/30 border border-line rounded-lg px-4 py-2.5 text-sm text-white font-data placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0181FB]/70"
      />
    </div>
  );
}

function BreakdownBar({ label, total, parts, d }: { label: string; total: bigint; parts: { v: bigint; cls: string; name: string; w: number }[]; d: number }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="font-data text-sm text-slate-100">{tpot(total, d, 4)} <span className="text-slate-500">tPOT</span></span>
      </div>
      <div
        className="flex h-4 w-full overflow-hidden rounded-md bg-white/[0.04]"
        role="img"
        aria-label={`${label}: ${parts.map((p) => `${p.name} ${tpot(p.v, d, 6)} tPOT`).join(', ')}`}
      >
        {parts.map((p) => (
          <div
            key={p.name}
            className={`${p.cls} h-full`}
            style={{ width: `${Math.max(p.v > 0n ? 0.4 : 0, p.w * 100)}%` }}
            title={`${p.name}: ${tpot(p.v, d, 8)} tPOT`}
          />
        ))}
      </div>
    </div>
  );
}

export function FeeLabPanel() {
  const [op, setOp] = useState<OpId>('deploy');
  const [from, setFrom] = useState<string>(SAMPLE.holder);
  const [to, setTo] = useState<string>(SAMPLE.existingEoa);
  const [amount, setAmount] = useState('1');
  const [token, setToken] = useState<string>(SAMPLE.erc20Token);
  const [tokenTo, setTokenTo] = useState<string>(SAMPLE.existingRecipient);
  const [tokenAmount, setTokenAmount] = useState('1');
  const [codeChoice, setCodeChoice] = useState<CodeChoice>('sample');
  const [customCode, setCustomCode] = useState('');
  const [callTo, setCallTo] = useState<string>(SAMPLE.erc20Token);
  const [callData, setCallData] = useState('0x18160ddd');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ c: Comparison; net: NetworkConfig } | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      void disconnectApi();
    };
  }, []);

  const buildTx = (decimals: number, tokenDecimals: number): DualTx | string => {
    try {
      if (!isH160(from)) return 'From must be a 0x… EVM address (used only as the dry-run origin; nothing is signed).';
      switch (op) {
        case 'transfer':
          return { kind: 'nativeTransfer', from, to, amountPlanck: parseUnits(amount, decimals) };
        case 'erc20':
          return { kind: 'erc20Transfer', from, token, to: tokenTo, amount: parseUnits(tokenAmount, tokenDecimals) };
        case 'deploy':
          return { kind: 'contractDeploy', from, bytecode: codeOf(codeChoice, customCode) };
        case 'calldata':
          return { kind: 'calldata', from, to: callTo.trim() || undefined, data: callData.trim() };
      }
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };

  async function run() {
    if (!isH160(from)) {
      setError('From must be a 0x… EVM address (used only as the dry-run origin; nothing is signed).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Native setup and (for ERC-20 ops) the token decimals read start
      // immediately, on their own clocks. The EVM leg never waits on the
      // native connection: the old code awaited getApi first, so one
      // silent WSS endpoint stalled the whole Measure past 60s while the
      // EVM leg — which needs no native connection at all — sat idle.
      // getApi itself times out after 10s and never auto-reconnects.
      const nativeSetupPromise = (async () => {
        try {
          const api = await getApi(DEFAULT_NETWORK.substrateWss);
          const d = await liveDecimals(api);
          return {
            api,
            net: { ...DEFAULT_NETWORK, nativeDecimals: d.nativeDecimals, evmDecimals: d.evmDecimals ?? DEFAULT_NETWORK.evmDecimals },
            error: null as string | null,
          };
        } catch (e) {
          return { api: null, net: DEFAULT_NETWORK, error: e instanceof Error ? e.message : String(e) };
        }
      })();
      const tokenDecimalsPromise =
        op === 'erc20'
          ? erc20Decimals(DEFAULT_NETWORK.evmRpc, token).catch(() => SAMPLE.erc20Decimals)
          : Promise.resolve(SAMPLE.erc20Decimals);
      const tokenDecimals = await tokenDecimalsPromise;
      const defaultTx = buildTx(DEFAULT_NETWORK.nativeDecimals, tokenDecimals);
      if (typeof defaultTx === 'string') {
        setError(defaultTx);
        return;
      }
      const evmPromise = estimateEvm(defaultTx, DEFAULT_NETWORK);
      const setup = await nativeSetupPromise;
      let net = setup.net;
      let tx = defaultTx;
      let evm: EvmLeg = await evmPromise;
      // Live chain decimals shape the transfer amount. If they differ from
      // the defaults the EVM leg used, rebuild and re-run the EVM leg once
      // so both legs still price the same operation.
      if (setup.api && (net.nativeDecimals !== DEFAULT_NETWORK.nativeDecimals || net.evmDecimals !== DEFAULT_NETWORK.evmDecimals)) {
        const liveTx = buildTx(net.nativeDecimals, tokenDecimals);
        if (typeof liveTx === 'string') {
          setError(liveTx);
          return;
        }
        tx = liveTx;
        evm = await estimateEvm(liveTx, net);
      }
      // A failed native setup never reconnects and never blocks the EVM
      // result: it surfaces as an unavailable leg with the setup error
      // (usually "timed out") instead of a second connect attempt.
      const native: NativeLeg = setup.api
        ? await estimateNative(tx, { network: net, api: setup.api })
        : { status: 'unavailable', method: nativeMethodFor(tx), reason: setup.error ?? 'native connection unavailable' };
      if (!aliveRef.current) return;
      setResult({ c: compareLegs(evm, native), net });
    } catch (e) {
      if (aliveRef.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }

  const resultView = (c: Comparison, d: number) => {
    const rec = c.recommended === 'evm' ? 'EVM' : c.recommended === 'native' ? 'Native' : c.recommended === 'either' ? 'Either (tie)' : 'No recommendation';
    const max = c.evm.status === 'ok' && c.native.status === 'ok'
      ? [c.evm.totalPlanck, c.native.totalPlanck].reduce((a, b) => (a > b ? a : b), 0n)
      : 0n;
    const mk = (v: bigint, cls: string, name: string) => ({ v, cls, name, w: frac(v, max) });
    return (
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-black/25 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[#7DB4FF]">EVM surface</span>
              {c.recommended === 'evm' && <span className="rounded-full bg-[#0181FB]/15 px-2 py-0.5 text-[11px] font-semibold text-[#7DB4FF]">cheaper</span>}
            </div>
            {c.evm.status === 'ok' ? (
              <>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-white">{tpot(c.evm.totalPlanck, d)} <span className="text-sm text-slate-400">tPOT</span></div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-400">
                  <dt>method</dt><dd className="font-data text-slate-100">{c.evm.method}</dd>
                  <dt>gas</dt><dd className="font-data text-slate-100">{c.evm.gas.toString()}</dd>
                  <dt>gasPrice</dt><dd className="font-data text-slate-100">{c.evm.gasPrice.toString()} wei</dd>
                  <dt>fee</dt><dd className="font-data text-slate-100">{c.evm.feeWei.toString()} wei</dd>
                  <dt>block</dt><dd className="font-data text-slate-100">#{c.evm.blockNumber}</dd>
                </dl>
              </>
            ) : (
              <div className="mt-2">
                <div className="text-2xl font-semibold text-slate-500">unavailable</div>
                <p className="mt-2 text-xs text-slate-400"><span className="font-data">{c.evm.method}</span>: {c.evm.reason}</p>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-black/25 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-emerald-300">Native surface</span>
              {c.recommended === 'native' && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">cheaper</span>}
            </div>
            {c.native.status === 'ok' ? (
              <>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-white">{tpot(c.native.totalPlanck, d)} <span className="text-sm text-slate-400">tPOT</span></div>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-400">
                  <dt>method</dt><dd className="font-data text-slate-100">{c.native.method}</dd>
                  <dt>partialFee</dt><dd className="font-data text-slate-100">{tpot(c.native.partialFee, d, 8)} tPOT</dd>
                  <dt>storage dep.</dt><dd className="font-data text-slate-100">{tpot(c.native.storageDeposit, d, 8)} tPOT</dd>
                  <dt>weight</dt><dd className="font-data text-slate-100">{c.native.weight.refTime.toString()} / {c.native.weight.proofSize.toString()}</dd>
                  <dt>block</dt><dd className="font-data text-slate-100">#{c.native.blockNumber}</dd>
                </dl>
              </>
            ) : (
              <div className="mt-2">
                <div className="text-2xl font-semibold text-slate-500">unavailable</div>
                <p className="mt-2 text-xs text-slate-400"><span className="font-data">{c.native.method}</span>: {c.native.reason}</p>
              </div>
            )}
          </div>
        </div>
        <div className="bg-panel border border-line rounded-xl p-4 grid gap-3 sm:grid-cols-3">
          <div>
            <div className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">Recommended path</div>
            <div className="text-lg font-semibold text-white">{rec}</div>
          </div>
          <div>
            <div className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">EVM ÷ native, all-in</div>
            <div className="text-lg font-semibold tabular-nums text-white">{fmtRatio(c.ratioAllIn)}</div>
            <div className="text-[11px] text-slate-500">native fee + storage deposit</div>
          </div>
          <div>
            <div className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">EVM ÷ native fee only</div>
            <div className="text-lg font-semibold tabular-nums text-white">{fmtRatio(c.ratioVsNativeFeeOnly)}</div>
            <div className="text-[11px] text-slate-500">how headline multiples are usually measured</div>
          </div>
          <p className="text-xs text-slate-400 sm:col-span-3">{c.reason} Measured {new Date(c.measuredAt).toLocaleString()}.</p>
        </div>
        {c.evm.status === 'ok' && c.native.status === 'ok' && (
          <div className="bg-panel border border-line rounded-xl p-4 grid gap-4">
            <div className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">Fee breakdown</div>
            <BreakdownBar label="EVM · gas × gasPrice" total={c.evm.totalPlanck} d={d} parts={[mk(c.evm.totalPlanck, 'bg-[#0181FB]', 'EVM gas cost')]} />
            <BreakdownBar label="Native · partialFee only (the headline denominator)" total={c.native.partialFee} d={d} parts={[mk(c.native.partialFee, 'bg-emerald-400', 'native fee')]} />
            <BreakdownBar label="Native · fee + storage deposit (all-in)" total={c.native.totalPlanck} d={d} parts={[mk(c.native.partialFee, 'bg-emerald-400', 'native fee'), mk(c.native.storageDeposit, 'bg-amber-400', 'storage deposit')]} />
            <p className="text-sm text-slate-400">
              {c.native.storageDeposit > 0n ? (
                <>The storage deposit is <b className="text-amber-300">{(frac(c.native.storageDeposit, c.native.totalPlanck) * 100).toFixed(1)}%</b> of the native all-in cost here. </>
              ) : (
                <>This op adds no new storage, so the native side has no deposit and the comparison is fee vs fee. </>
              )}
              pallet-revive charges a deposit for every byte and item a call leaves in state. A deploy
              stores the whole contract code, so the deposit dwarfs the weight fee. The EVM gas
              estimate already folds that deposit in; the native path reports it separately as a hold.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div>
          <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">NodeScope / Fee Lab</p>
          <h2 className="text-3xl font-bold tracking-tight text-white mt-1.5">
            Same operation. Two surfaces. One honest fee.
          </h2>
        </div>
        <p className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500 pb-1">Portaldot V3 · Chain {PORTALDOT_CHAIN_ID}</p>
      </div>
      <p className="text-sm leading-relaxed text-slate-400 max-w-3xl">
        Pick an operation. NodeScope asks both surfaces for a live estimate of the same thing, in
        parallel, from your browser. The EVM figure already includes the storage deposit; the
        native figure reports it separately as a refundable hold. That is why a fee-only
        comparison can read ~800× while the all-in comparison lands near 1×.
      </p>
      <div className="bg-panel border border-line rounded-xl p-4 grid gap-4">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault();
            const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
            const current = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
            const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
            const next = tabs[(current + delta + tabs.length) % tabs.length];
            if (!next) return;
            next.focus();
            next.click();
          }}
        >
          {OPS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="tab"
              aria-selected={op === o.id}
              tabIndex={op === o.id ? 0 : -1}
              onClick={() => { setOp(o.id); setResult(null); }}
              className={`rounded-xl px-3 py-2 text-sm transition ${
                op === o.id ? 'bg-[#0181FB] font-semibold text-white' : 'border border-line text-slate-400 hover:text-slate-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Field label="From (dry-run origin, never signs)" value={from} onChange={setFrom} />
        {op === 'transfer' && (
          <div className="grid gap-4 sm:grid-cols-[1fr,10rem]">
            <Field label="To" value={to} onChange={setTo} />
            <Field label="Amount (tPOT)" value={amount} onChange={setAmount} />
          </div>
        )}
        {op === 'erc20' && (
          <>
            <Field label={`Token (default: ${SAMPLE.erc20Symbol}, ${SAMPLE.erc20Decimals} dp)`} value={token} onChange={setToken} />
            <div className="grid gap-4 sm:grid-cols-[1fr,10rem]">
              <Field label="Recipient" value={tokenTo} onChange={setTokenTo} />
              <Field label="Amount (tokens)" value={tokenAmount} onChange={setTokenAmount} />
            </div>
            <p className="text-xs text-slate-500">Tip: a recipient that never held the token (e.g. <button type="button" className="font-data underline" onClick={() => setTokenTo('0x2222222222222222222222222222222222222222')}>0x2222…2222</button>) creates a new storage slot, so a storage deposit appears.</p>
          </>
        )}
        {op === 'deploy' && (
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              {(['sample', 'registry', 'custom'] as CodeChoice[]).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => { setCodeChoice(choice); setResult(null); }}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    codeChoice === choice ? 'border-[#0181FB] text-white font-medium' : 'border-line text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {choice === 'sample' ? `SampleToken.sol · ${(SampleTokenBytecode.length - 2) / 2} B` : choice === 'registry' ? `FeeRegistry.sol · ${(FeeRegistryBytecode.length - 2) / 2} B` : 'Custom bytecode'}
                </button>
              ))}
            </div>
            {codeChoice === 'custom' ? (
              <div>
                <label className="block text-sm font-medium text-slate-300">Creation bytecode (0x…)</label>
                <textarea
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  spellCheck={false}
                  placeholder="0x6080…"
                  className="mt-1.5 w-full h-28 resize-y bg-black/30 border border-line rounded-lg px-4 py-2.5 text-sm text-white font-data placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0181FB]/70"
                />
              </div>
            ) : (
              <pre className="font-data max-h-24 overflow-hidden rounded-xl border border-line bg-black/30 p-3 text-[11px] text-slate-500">{codeOf(codeChoice, '').slice(0, 400)}…</pre>
            )}
          </div>
        )}
        {op === 'calldata' && (
          <>
            <Field label="To (leave empty for a create)" value={callTo} onChange={setCallTo} />
            <div>
              <label className="block text-sm font-medium text-slate-300">Calldata</label>
              <textarea
                value={callData}
                onChange={(e) => setCallData(e.target.value)}
                spellCheck={false}
                className="mt-1.5 w-full h-24 resize-y bg-black/30 border border-line rounded-lg px-4 py-2.5 text-sm text-white font-data placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0181FB]/70"
              />
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void run()} disabled={busy} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-medium">
            {busy ? 'Estimating on both surfaces…' : 'Estimate on both surfaces'}
          </button>
          <span className="text-xs text-slate-500">EVM: eth_estimateGas × eth_gasPrice. Native: ReviveApi dry-run + TransactionPaymentApi.query_info.</span>
        </div>
        <p className="text-xs text-slate-500">User-triggered only. No connection opens until you measure, nothing polls in the background, and the Substrate connection closes when you leave this section.</p>
        {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      </div>
      {result && resultView(result.c, result.net.nativeDecimals)}
      {!result && !error && (
        <div className="empty-shell p-4">
          <p className="text-sm text-slate-400">No measurement yet. Press “Estimate on both surfaces” to ask both surfaces for a live estimate of the operation above.</p>
        </div>
      )}
    </div>
  );
}
