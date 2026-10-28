/**
 * Fee Lab.
 *
 * Measures the same operation on both Portaldot V3 surfaces, from the
 * browser, and compares the all-in cost:
 * - EVM: eth_estimateGas x eth_gasPrice (the gas figure already folds the
 *   storage deposit in).
 * - Native: ReviveApi dry-run + TransactionPaymentApi.query_info, reported
 *   as partialFee + storage deposit separately.
 *
 * Design rules, all deliberate:
 * - User-triggered only. This panel opens nothing until you press Measure,
 *   never polls, and closes the shared Substrate connection when it unmounts.
 * - No history recording: NodeScope's report schema is diagnostic records,
 *   and the comparison is shown, not stored.
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
  TIE_BAND,
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
import { feesCopy, type FeesPanelCopy } from '../../utils/feesLang';
import { buildFeeReport } from '../../utils/feeReport';
import { stampReportIntegrity } from '../../utils/reportIntegrity';
import { parseArtifactInput, ArtifactInputError } from '../../utils/artifactInput';
import { buildFeeLabShareParams, parseFeeLabShareParams } from '../../utils/feeLabShare';
import { LANGS, LANG_ARIA, LANG_HTML, LANG_LABEL, readStoredLang, storeLang, type Lang } from '../../utils/landingLang';
import { PORTALDOT_CHAIN_ID } from '../../utils/siteConstants';

type OpId = 'transfer' | 'erc20' | 'deploy' | 'calldata';

// The comparison reason is rendered from the comparison's structured fields
// (recommendation, savings, totals, deposit) rather than from the service's
// English reason string, so the panel can translate it. The raw leg error
// (e.g. "timed out") stays verbatim inside the parentheses: it is a
// technical detail, not prose.
function displayReason(c: Comparison, p: FeesPanelCopy): string {
  if (c.evm.status !== 'ok' && c.native.status !== 'ok') return p.reasonNeither;
  if (c.evm.status !== 'ok') return `${p.reasonOnlyNative} (EVM: ${c.evm.reason}).`;
  if (c.native.status !== 'ok') return `${p.reasonOnlyEvm} (native: ${c.native.reason}).`;
  const bigger = c.evm.totalPlanck > c.native.totalPlanck ? c.evm.totalPlanck : c.native.totalPlanck;
  const rel = bigger === 0n ? 0 : Number((c.savingsPlanck * 1_000_000n) / bigger) / 1_000_000;
  let r: string;
  if (c.recommended === 'either') r = p.reasonTie.replace('{pct}', (TIE_BAND * 100).toFixed(0));
  else if (c.recommended === 'evm') r = p.reasonEvmCheaper.replace('{pct}', (rel * 100).toFixed(1));
  else r = p.reasonNativeCheaper.replace('{pct}', (rel * 100).toFixed(1));
  if (c.native.storageDeposit > 0n) r += ` ${p.reasonDepositSuffix}`;
  return r;
}

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
        className="mt-1.5 w-full bg-black/30 border border-line rounded-lg px-4 py-2.5 text-sm text-white font-data placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-signal/70"
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
  const [lang, setLangState] = useState<Lang>(() => readStoredLang());
  const setLang = (l: Lang) => {
    setLangState(l);
    storeLang(l);
  };
  const p = feesCopy[lang].panel;
  const OPS: { id: OpId; label: string }[] = [
    { id: 'transfer', label: p.ops.transfer },
    { id: 'erc20', label: p.ops.erc20 },
    { id: 'deploy', label: p.ops.deploy },
    { id: 'calldata', label: p.ops.calldata },
  ];
  // A share link (?op=deploy&code=0x…&args=0x…&from=0x…) opens Fee Lab
  // with that contract already loaded. A malformed link parses to null
  // and the panel renders its default state instead of erroring. The
  // shared state seeds the initial values below (lazy initializers, not
  // an effect: the link is read once, at mount, like the stored language).
  const sharedOnLoad = parseFeeLabShareParams(window.location.search);
  const [op, setOp] = useState<OpId>('deploy');
  const [from, setFrom] = useState<string>(sharedOnLoad?.from ?? SAMPLE.holder);
  const [to, setTo] = useState<string>(SAMPLE.existingEoa);
  const [amount, setAmount] = useState('1');
  const [token, setToken] = useState<string>(SAMPLE.erc20Token);
  const [tokenTo, setTokenTo] = useState<string>(SAMPLE.existingRecipient);
  const [tokenAmount, setTokenAmount] = useState('1');
  const [codeChoice, setCodeChoice] = useState<CodeChoice>(sharedOnLoad ? 'custom' : 'sample');
  const [customCode, setCustomCode] = useState(sharedOnLoad?.code ?? '');
  const [constructorData, setConstructorData] = useState(sharedOnLoad?.args ?? '');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [callTo, setCallTo] = useState<string>(SAMPLE.erc20Token);
  const [callData, setCallData] = useState('0x18160ddd');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ c: Comparison; net: NetworkConfig } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
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
      if (!isH160(from)) return p.fromError;
      switch (op) {
        case 'transfer':
          return { kind: 'nativeTransfer', from, to, amountPlanck: parseUnits(amount, decimals) };
        case 'erc20':
          return { kind: 'erc20Transfer', from, token, to: tokenTo, amount: parseUnits(tokenAmount, tokenDecimals) };
        case 'deploy': {
          const code = codeOf(codeChoice, customCode);
          if (codeChoice === 'custom') {
            if (!/^0x[0-9a-fA-F]+$/.test(code)) return p.codeError;
            if (constructorData.trim() !== '' && !/^0x[0-9a-fA-F]*$/.test(constructorData.trim())) {
              return p.constructorError;
            }
          }
          return { kind: 'contractDeploy', from, bytecode: code, constructorData: codeChoice === 'custom' ? (constructorData.trim() || undefined) : undefined };
        }
        case 'calldata':
          return { kind: 'calldata', from, to: callTo.trim() || undefined, data: callData.trim() };
      }
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };

  async function run() {
    if (!isH160(from)) {
      setError(p.fromError);
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

  async function exportFeeReport() {
    if (!result) return;
    setExporting(true);
    setExportError(null);
    try {
      const report = await stampReportIntegrity(buildFeeReport(result.c, op));
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const localDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      link.download = `nodescope-fee-report-${localDate}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

  async function uploadArtifact(file: File) {
    setUploadError(null);
    try {
      const parsed = parseArtifactInput(await file.text());
      setCustomCode(parsed.bytecode);
      setConstructorData(parsed.constructorData);
      setResult(null);
    } catch (e) {
      if (e instanceof ArtifactInputError) {
        setUploadError(
          e.code === 'invalid-json' ? p.uploadErrorJson
          : e.code === 'no-bytecode' ? p.uploadErrorBytecode
          : e.code === 'deployed-only' ? p.uploadErrorDeployed
          : e.code === 'bad-args' ? p.constructorError
          : p.uploadErrorHex,
        );
      } else {
        setUploadError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  async function copyShareLink() {
    setShareNote(null);
    const code = codeOf(codeChoice, customCode);
    if (op !== 'deploy' || codeChoice !== 'custom' || !/^0x[0-9a-fA-F]+$/.test(code)) {
      setShareNote(p.codeError);
      return;
    }
    if (constructorData.trim() !== '' && !/^0x[0-9a-fA-F]*$/.test(constructorData.trim())) {
      setShareNote(p.constructorError);
      return;
    }
    const params = buildFeeLabShareParams({ from, code, args: constructorData.trim() || undefined });
    const url = `${window.location.origin}${window.location.pathname}?${params}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNote(p.shareCopied);
    } catch {
      setShareNote(p.shareFailed);
    }
  }

  const resultView = (c: Comparison, d: number) => {
    const rec = c.recommended === 'evm' ? p.recEvm : c.recommended === 'native' ? p.recNative : c.recommended === 'either' ? p.recEither : p.recNone;
    const max = c.evm.status === 'ok' && c.native.status === 'ok'
      ? [c.evm.totalPlanck, c.native.totalPlanck].reduce((a, b) => (a > b ? a : b), 0n)
      : 0n;
    const mk = (v: bigint, cls: string, name: string) => ({ v, cls, name, w: frac(v, max) });
    return (
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-black/25 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-signal-ink">{p.evmSurface}</span>
              {c.recommended === 'evm' && <span className="rounded-full bg-signal/15 px-2 py-0.5 text-[11px] font-semibold text-signal-ink">{p.cheaper}</span>}
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
                <div className="text-2xl font-semibold text-slate-500">{p.unavailable}</div>
                <p className="mt-2 text-xs text-slate-400"><span className="font-data">{c.evm.method}</span>: {c.evm.reason}</p>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-black/25 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-emerald-300">{p.nativeSurface}</span>
              {c.recommended === 'native' && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">{p.cheaper}</span>}
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
                <div className="text-2xl font-semibold text-slate-500">{p.unavailable}</div>
                <p className="mt-2 text-xs text-slate-400"><span className="font-data">{c.native.method}</span>: {c.native.reason}</p>
              </div>
            )}
          </div>
        </div>
        <div className="bg-panel border border-line rounded-xl p-4 grid gap-3 sm:grid-cols-3">
          <div>
            <div className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">{p.recPath}</div>
            <div className="text-lg font-semibold text-white">{rec}</div>
          </div>
          <div>
            <div className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">{p.ratioAllIn}</div>
            <div className="text-lg font-semibold tabular-nums text-white">{fmtRatio(c.ratioAllIn)}</div>
            <div className="text-[11px] text-slate-500">{p.ratioAllInNote}</div>
          </div>
          <div>
            <div className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">{p.ratioFeeOnly}</div>
            <div className="text-lg font-semibold tabular-nums text-white">{fmtRatio(c.ratioVsNativeFeeOnly)}</div>
            <div className="text-[11px] text-slate-500">{p.ratioFeeOnlyNote}</div>
          </div>
          <p className="text-xs text-slate-400 sm:col-span-3">{displayReason(c, p)} {p.measured} {new Date(c.measuredAt).toLocaleString()}.</p>
        </div>
        {c.evm.status === 'ok' && c.native.status === 'ok' && (
          <div className="bg-panel border border-line rounded-xl p-4 grid gap-4">
            <div className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">{p.breakTitle}</div>
            <BreakdownBar label={p.breakEvm} total={c.evm.totalPlanck} d={d} parts={[mk(c.evm.totalPlanck, 'bg-signal', p.breakEvmGas)]} />
            <BreakdownBar label={p.breakNativeFee} total={c.native.partialFee} d={d} parts={[mk(c.native.partialFee, 'bg-emerald-400', p.breakNativeFeePart)]} />
            <BreakdownBar label={p.breakNativeAllIn} total={c.native.totalPlanck} d={d} parts={[mk(c.native.partialFee, 'bg-emerald-400', p.breakNativeFeePart), mk(c.native.storageDeposit, 'bg-amber-400', p.breakDepositPart)]} />
            <p className="text-sm text-slate-400">
              {c.native.storageDeposit > 0n ? (
                <>{p.breakDepositPct.replace('{pct}', (frac(c.native.storageDeposit, c.native.totalPlanck) * 100).toFixed(1))} </>
              ) : (
                <>{p.breakNoDeposit} </>
              )}
              {p.breakExplain}
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
          <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">{p.kicker}</p>
          <h2 className="text-3xl font-bold tracking-tight text-white mt-1.5">
            {p.title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 pb-1">
          <p className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">Portaldot V3 · Chain {PORTALDOT_CHAIN_ID}</p>
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-black/30 p-1" role="group" aria-label={p.langGroupAria}>
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                aria-label={LANG_ARIA[l]}
                lang={LANG_HTML[l]}
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className={`cursor-pointer select-none rounded-full px-2.5 py-1 font-data text-[10px] ${l === 'zh' ? 'tracking-normal' : 'uppercase tracking-[0.14em]'} transition-[color,background-color,transform] duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-signal ${lang === l ? 'bg-signal text-graphite' : 'text-slate-400 hover:bg-signal/15 hover:text-graphite'}`}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </span>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-slate-400 max-w-3xl">
        {p.intro}
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
                op === o.id ? 'bg-signal font-semibold text-graphite' : 'border border-line text-slate-400 hover:text-slate-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Field label={p.fromLabel} value={from} onChange={setFrom} />
        {op === 'transfer' && (
          <div className="grid gap-4 sm:grid-cols-[1fr,10rem]">
            <Field label={p.toLabel} value={to} onChange={setTo} />
            <Field label={p.amountLabel} value={amount} onChange={setAmount} />
          </div>
        )}
        {op === 'erc20' && (
          <>
            <Field label={p.tokenLabel.replace('{symbol}', SAMPLE.erc20Symbol).replace('{decimals}', String(SAMPLE.erc20Decimals))} value={token} onChange={setToken} />
            <div className="grid gap-4 sm:grid-cols-[1fr,10rem]">
              <Field label={p.recipientLabel} value={tokenTo} onChange={setTokenTo} />
              <Field label={p.tokenAmountLabel} value={tokenAmount} onChange={setTokenAmount} />
            </div>
            <p className="text-xs text-slate-500">{p.tipPrefix}<button type="button" className="font-data underline" onClick={() => setTokenTo('0x2222222222222222222222222222222222222222')}>0x2222…2222</button>{p.tipSuffix}</p>
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
                    codeChoice === choice ? 'border-signal text-white font-medium' : 'border-line text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {choice === 'sample' ? p.codeSample.replace('{bytes}', String((SampleTokenBytecode.length - 2) / 2)) : choice === 'registry' ? p.codeRegistry.replace('{bytes}', String((FeeRegistryBytecode.length - 2) / 2)) : p.codeCustom}
                </button>
              ))}
            </div>
            {codeChoice === 'custom' ? (
              <div className="grid gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300">{p.codeLabel}</label>
                  <textarea
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    spellCheck={false}
                    placeholder="0x6080…"
                    className="mt-1.5 w-full h-28 resize-y bg-black/30 border border-line rounded-lg px-4 py-2.5 text-sm text-white font-data placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-signal/70"
                  />
                </div>
                <Field label={p.constructorLabel} value={constructorData} onChange={setConstructorData} />
                <p className="text-xs text-slate-500">{p.constructorHint}</p>
                <div>
                  <label className="block text-sm font-medium text-slate-300">{p.uploadLabel}</label>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadArtifact(f);
                      e.target.value = '';
                    }}
                    className="mt-1.5 w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border file:border-line file:bg-black/30 file:px-3 file:py-2 file:text-sm file:text-slate-200"
                  />
                </div>
                {uploadError && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{uploadError}</p>}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void copyShareLink()}
                    className="rounded-lg border border-line px-4 py-2 text-sm text-slate-200 hover:text-white"
                  >
                    {p.shareLabel}
                  </button>
                  {shareNote && <span className="text-xs text-slate-400">{shareNote}</span>}
                </div>
              </div>
            ) : (
              <pre className="font-data max-h-24 overflow-hidden rounded-xl border border-line bg-black/30 p-3 text-[11px] text-slate-500">{codeOf(codeChoice, '').slice(0, 400)}…</pre>
            )}
          </div>
        )}
        {op === 'calldata' && (
          <>
            <Field label={p.callToLabel} value={callTo} onChange={setCallTo} />
            <div>
              <label className="block text-sm font-medium text-slate-300">{p.callDataLabel}</label>
              <textarea
                value={callData}
                onChange={(e) => setCallData(e.target.value)}
                spellCheck={false}
                className="mt-1.5 w-full h-24 resize-y bg-black/30 border border-line rounded-lg px-4 py-2.5 text-sm text-white font-data placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-signal/70"
              />
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void run()} disabled={busy} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-medium">
            {busy ? p.measureBusy : p.measure}
          </button>
          <span className="text-xs text-slate-500">{p.methodNote}</span>
        </div>
        <p className="text-xs text-slate-500">{p.triggeredNote}</p>
        {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      </div>
      {result && resultView(result.c, result.net.nativeDecimals)}
      {result && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void exportFeeReport()}
            disabled={exporting}
            className="rounded-lg border border-line px-4 py-2.5 text-sm text-slate-200 hover:text-white disabled:opacity-50"
          >
            {exporting ? p.exporting : p.exportReport}
          </button>
          <span className="text-xs text-slate-500">{p.exportNote}</span>
        </div>
      )}
      {exportError && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{p.exportError}</p>}
      {!result && !error && (
        <div className="empty-shell p-4">
          <p className="text-sm text-slate-400">{p.empty.replace('{measure}', p.measure)}</p>
        </div>
      )}
    </div>
  );
}
