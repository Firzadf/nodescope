/**
 * Deploy cost calculator for the /fees sub-landing.
 *
 * "How much does it cost to deploy MY contract?" Paste creation bytecode
 * or upload a solc artifact (or pick a bundled sample), press Estimate,
 * and NodeScope asks both Portaldot surfaces for a live deploy estimate
 * of that exact bytecode — the same read-only dry-run Fee Lab uses:
 * - EVM: eth_estimateGas x eth_gasPrice (the gas figure already folds
 *   the storage deposit in).
 * - Native: ReviveApi dry-run + TransactionPaymentApi.query_info,
 *   reported as partialFee + storage deposit separately.
 *
 * Deliberate constraints, matching Fee Lab doctrine:
 * - User-triggered only. Nothing connects until Estimate is pressed,
 *   nothing polls, and the native leg carries the same timeouts
 *   (connect 10s, estimate 15s) so a dead endpoint reports unavailable
 *   instead of hanging.
 * - The estimator module (which pulls in @polkadot/api) is loaded with a
 *   dynamic import on Estimate, so the /fees first load never pays for
 *   it. Only pure helpers (artifact parsing, fee-report building, unit
 *   formatting, sample bytecodes) are imported statically.
 * - Invalid input is rejected with a localized message, never priced:
 *   raw non-hex text, JSON without creation bytecode, and runtime-only
 *   (deployedBytecode) artifacts all fail before any estimate runs.
 * - A result for the user's own bytecode exports through the existing
 *   fee-report path (buildFeeReport + SHA-256 stamp), so it verifies on
 *   /verify and anchors with the same command as any other fee report.
 *   No schema change: the operation is 'deploy', like Fee Lab's.
 * - The storage-deposit explainer states the verified pallet-revive
 *   behavior: on contract termination the accumulated storage deposit is
 *   refunded to the origin, and removing stored code refunds its code
 *   deposit to the owner (pallet-revive meter.rs terminate() and
 *   remove_code). The refund itself is never executed here: this page
 *   only dry-runs.
 */
import { useState } from 'react';
import { ArtifactInputError, parseArtifactInput } from '../../utils/artifactInput';
import { buildFeeReport } from '../../utils/feeReport';
import { stampReportIntegrity } from '../../utils/reportIntegrity';
import { feesCopy, type FeesCalcCopy, type FeesPanelCopy } from '../../utils/feesLang';
import type { Lang } from '../../utils/landingLang';
import { DEFAULT_NETWORK } from '../../services/feeLab/constants';
import { FeeRegistryBytecode, SampleTokenBytecode } from '../../services/feeLab/artifacts';
import { SAMPLE } from '../../services/feeLab/samples';
import { formatUnits } from '../../services/feeLab/units';
import type { Comparison } from '../../services/feeLab/compare';

type Source = 'sample' | 'registry' | 'custom';

const tpot = (planck: bigint, decimals = DEFAULT_NETWORK.nativeDecimals, frac = 6) =>
  formatUnits(planck, decimals, frac);

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

function errMessage(e: ArtifactInputError, c: FeesCalcCopy): string {
  switch (e.code) {
    case 'invalid-json':
      return c.codeErrJson;
    case 'no-bytecode':
      return c.codeErrBytecode;
    case 'deployed-only':
      return c.codeErrDeployed;
    case 'bad-hex':
      return c.codeErrHex;
    case 'bad-args':
      return c.codeErrArgs;
  }
}

export function DeployCostCalculator({ lang }: { lang: Lang }) {
  const c = feesCopy[lang].calc;
  const p: FeesPanelCopy = feesCopy[lang].panel;
  const [source, setSource] = useState<Source>('sample');
  const [customText, setCustomText] = useState('');
  const [constructorData, setConstructorData] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Comparison | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const byteCount = (code: string) => (code.length - 2) / 2;

  /** Resolve the deploy bytecode or return a localized rejection. */
  function resolveBytecode(): { bytecode: string; args: string } | string {
    if (source === 'sample') return { bytecode: SampleTokenBytecode, args: '' };
    if (source === 'registry') return { bytecode: FeeRegistryBytecode, args: '' };
    try {
      const parsed = parseArtifactInput(customText);
      const args = constructorData.trim();
      if (args !== '' && !/^0x[0-9a-fA-F]*$/.test(args)) return c.codeErrArgs;
      return { bytecode: parsed.bytecode, args: parsed.constructorData || args };
    } catch (e) {
      if (e instanceof ArtifactInputError) return errMessage(e, c);
      return e instanceof Error ? e.message : String(e);
    }
  }

  async function run() {
    setInputError(null);
    setError(null);
    const resolved = resolveBytecode();
    if (typeof resolved === 'string') {
      setInputError(resolved);
      return;
    }
    setBusy(true);
    try {
      // Lazy: the estimator pulls in @polkadot/api, so it loads only
      // when the user actually estimates, never on /fees first paint.
      const { estimateBoth } = await import('../../services/feeLab/estimate');
      const comparison = await estimateBoth({
        kind: 'contractDeploy',
        from: SAMPLE.holder,
        bytecode: resolved.bytecode,
        constructorData: resolved.args || undefined,
      });
      setResult(comparison);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function exportReport() {
    if (!result) return;
    setExporting(true);
    setExportError(null);
    try {
      const report = await stampReportIntegrity(buildFeeReport(result, 'deploy'));
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
    setInputError(null);
    try {
      const parsed = parseArtifactInput(await file.text());
      setCustomText(parsed.bytecode);
      setConstructorData(parsed.constructorData);
      setResult(null);
    } catch (e) {
      if (e instanceof ArtifactInputError) setInputError(errMessage(e, c));
      else setInputError(e instanceof Error ? e.message : String(e));
    }
  }

  const rec =
    result == null
      ? null
      : result.recommended === 'evm'
        ? p.recEvm
        : result.recommended === 'native'
          ? p.recNative
          : result.recommended === 'either'
            ? p.recEither
            : p.recNone;

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-sm font-medium text-slate-300">{c.sourceLabel}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ['sample', c.sourceSample.replace('{bytes}', String(byteCount(SampleTokenBytecode)))],
              ['registry', c.sourceRegistry.replace('{bytes}', String(byteCount(FeeRegistryBytecode)))],
              ['custom', c.sourceCustom],
            ] as [Source, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setSource(id);
                setResult(null);
                setInputError(null);
              }}
              aria-pressed={source === id}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                source === id ? 'border-amber-400 text-white font-medium' : 'border-line text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {source === 'custom' && (
        <div className="grid gap-3">
          <div>
            <label htmlFor="calc-code" className="block text-sm font-medium text-slate-300">
              {c.codeLabel}
            </label>
            <textarea
              id="calc-code"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              spellCheck={false}
              placeholder={c.codePlaceholder}
              className="mt-1.5 h-28 w-full resize-y rounded-lg border border-line bg-black/30 px-4 py-2.5 font-data text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/70"
            />
            <p className="mt-1.5 text-xs text-slate-400">{c.codeHint}</p>
          </div>
          <div>
            <label htmlFor="calc-args" className="block text-sm font-medium text-slate-300">
              {c.argsLabel}
            </label>
            <input
              id="calc-args"
              type="text"
              value={constructorData}
              onChange={(e) => setConstructorData(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="mt-1.5 w-full rounded-lg border border-line bg-black/30 px-4 py-2.5 font-data text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/70"
            />
            <p className="mt-1.5 text-xs text-slate-400">{c.argsHint}</p>
          </div>
          <div>
            <label htmlFor="calc-upload" className="block text-sm font-medium text-slate-300">
              {c.uploadLabel}
            </label>
            <input
              id="calc-upload"
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
        </div>
      )}

      {inputError && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {inputError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="btn-primary px-6 py-3 text-[15px] font-semibold"
        >
          {busy ? c.measureBusy : c.measure}
        </button>
        <span className="text-xs text-slate-400">{c.methodNote}</span>
      </div>
      <p className="text-xs text-slate-400">{c.fromNote.replace('{from}', SAMPLE.holder)}</p>
      <p className="text-xs text-slate-400">{c.triggeredNote}</p>
      {error && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-black/25 p-4">
              <span className="text-sm font-semibold text-signal-ink">{p.evmSurface}</span>
              {result.evm.status === 'ok' ? (
                <>
                  <div className="mt-2 text-2xl font-semibold tabular-nums text-white">
                    {tpot(result.evm.totalPlanck)} <span className="text-sm text-slate-400">tPOT</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-400">
                    <dt>gas</dt>
                    <dd className="font-data text-slate-100">{result.evm.gas.toString()}</dd>
                    <dt>gasPrice</dt>
                    <dd className="font-data text-slate-100">{result.evm.gasPrice.toString()} wei</dd>
                    <dt>block</dt>
                    <dd className="font-data text-slate-100">#{result.evm.blockNumber}</dd>
                  </dl>
                </>
              ) : (
                <div className="mt-2">
                  <div className="text-2xl font-semibold text-slate-400">{p.unavailable}</div>
                  <p className="mt-2 text-xs text-slate-400">
                    <span className="font-data">{result.evm.method}</span>: {result.evm.reason}
                  </p>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-line bg-black/25 p-4">
              <span className="text-sm font-semibold text-emerald-300">{p.nativeSurface}</span>
              {result.native.status === 'ok' ? (
                <>
                  <div className="mt-2 text-2xl font-semibold tabular-nums text-white">
                    {tpot(result.native.totalPlanck)} <span className="text-sm text-slate-400">tPOT</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-400">
                    <dt>partialFee</dt>
                    <dd className="font-data text-slate-100">{tpot(result.native.partialFee, DEFAULT_NETWORK.nativeDecimals, 8)} tPOT</dd>
                    <dt>storage dep.</dt>
                    <dd className="font-data text-slate-100">{tpot(result.native.storageDeposit, DEFAULT_NETWORK.nativeDecimals, 8)} tPOT</dd>
                    <dt>block</dt>
                    <dd className="font-data text-slate-100">#{result.native.blockNumber}</dd>
                  </dl>
                </>
              ) : (
                <div className="mt-2">
                  <div className="text-2xl font-semibold text-slate-400">{p.unavailable}</div>
                  <p className="mt-2 text-xs text-slate-400">
                    <span className="font-data">{result.native.method}</span>: {result.native.reason}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-line bg-panel p-4 sm:grid-cols-3">
            <div>
              <div className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">{p.recPath}</div>
              <div className="text-lg font-semibold text-white">{rec}</div>
            </div>
            <div>
              <div className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">{p.ratioAllIn}</div>
              <div className="text-lg font-semibold tabular-nums text-white">{fmtRatio(result.ratioAllIn)}</div>
              <div className="text-[11px] text-slate-400">{p.ratioAllInNote}</div>
            </div>
            <div>
              <div className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">{p.ratioFeeOnly}</div>
              <div className="text-lg font-semibold tabular-nums text-white">{fmtRatio(result.ratioVsNativeFeeOnly)}</div>
              <div className="text-[11px] text-slate-400">{p.ratioFeeOnlyNote}</div>
            </div>
            <p className="text-xs text-slate-400 sm:col-span-3">
              {p.measured} {new Date(result.measuredAt).toLocaleString()}.
            </p>
          </div>

          {result.native.status === 'ok' && result.evm.status === 'ok' && (
            <div className="grid gap-4 rounded-xl border border-line bg-panel p-4">
              <div className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">{p.breakTitle}</div>
              <div className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-slate-400">{p.breakEvm}</span>
                  <span className="font-data text-sm text-slate-100">
                    {tpot(result.evm.totalPlanck, DEFAULT_NETWORK.nativeDecimals, 4)} <span className="text-slate-400">tPOT</span>
                  </span>
                </div>
                <div
                  className="flex h-4 w-full overflow-hidden rounded-md bg-white/[0.04]"
                  role="img"
                  aria-label={`${p.breakEvm}: ${tpot(result.evm.totalPlanck)} tPOT`}
                >
                  <div className="h-full bg-signal" style={{ width: '100%' }} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs text-slate-400">{p.breakNativeAllIn}</span>
                  <span className="font-data text-sm text-slate-100">
                    {tpot(result.native.totalPlanck, DEFAULT_NETWORK.nativeDecimals, 4)} <span className="text-slate-400">tPOT</span>
                  </span>
                </div>
                <div
                  className="flex h-4 w-full overflow-hidden rounded-md bg-white/[0.04]"
                  role="img"
                  aria-label={`${p.breakNativeAllIn}: ${p.breakNativeFeePart} ${tpot(result.native.partialFee)} tPOT, ${p.breakDepositPart} ${tpot(result.native.storageDeposit)} tPOT`}
                >
                  <div
                    className="h-full bg-emerald-400"
                    style={{ width: `${Math.max(result.native.partialFee > 0n ? 0.4 : 0, frac(result.native.partialFee, result.native.totalPlanck) * 100)}%` }}
                    title={`${p.breakNativeFeePart}: ${tpot(result.native.partialFee, DEFAULT_NETWORK.nativeDecimals, 8)} tPOT`}
                  />
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${Math.max(result.native.storageDeposit > 0n ? 0.4 : 0, frac(result.native.storageDeposit, result.native.totalPlanck) * 100)}%` }}
                    title={`${p.breakDepositPart}: ${tpot(result.native.storageDeposit, DEFAULT_NETWORK.nativeDecimals, 8)} tPOT`}
                  />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                  <span>
                    <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-400" />
                    {p.breakNativeFeePart}: {tpot(result.native.partialFee)} tPOT
                  </span>
                  <span>
                    <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400" />
                    {p.breakDepositPart}: {tpot(result.native.storageDeposit)} tPOT
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                {result.native.storageDeposit > 0n ? (
                  <>{p.breakDepositPct.replace('{pct}', (frac(result.native.storageDeposit, result.native.totalPlanck) * 100).toFixed(1))} </>
                ) : (
                  <>{p.breakNoDeposit} </>
                )}
                {p.breakExplain}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
            <h3 className="text-[15px] font-semibold text-white">{c.depositTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.depositBody}</p>
            <p className="mt-2 text-xs text-slate-400">{c.depositNote}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void exportReport()}
              disabled={exporting}
              className="rounded-lg border border-line px-4 py-2.5 text-sm text-slate-200 hover:text-white disabled:opacity-50"
            >
              {exporting ? p.exporting : p.exportReport}
            </button>
            <span className="text-xs text-slate-400">{p.exportNote}</span>
          </div>
          {exportError && (
            <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {p.exportError}
            </p>
          )}
        </div>
      )}

      {!result && !error && !inputError && (
        <p className="text-sm text-slate-400">{c.empty.replace('{measure}', c.measure)}</p>
      )}
    </div>
  );
}
