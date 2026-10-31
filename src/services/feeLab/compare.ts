import { weiToPlanck, ratio } from './units';
import { DEPOSIT_REASON_SUFFIX } from './deposits';

export type Surface = 'evm' | 'native';

export type EvmLeg =
  | { status: 'ok'; method: string; gas: bigint; gasPrice: bigint; feeWei: bigint; totalPlanck: bigint; blockNumber: number }
  | { status: 'unavailable'; method: string; reason: string };

export type NativeLeg =
  | {
      status: 'ok';
      method: string;
      partialFee: bigint;
      storageDeposit: bigint;
      /** Present when a read-only dry-run could separate the two refundable holds. */
      codeDeposit?: bigint | null;
      itemStorageDeposit?: bigint | null;
      totalPlanck: bigint;
      weight: { refTime: bigint; proofSize: bigint };
      blockNumber: number;
    }
  | { status: 'unavailable'; method: string; reason: string };

export type Recommendation = Surface | 'either' | null;

export type Comparison = {
  evm: EvmLeg;
  native: NativeLeg;
  /** EVM all-in cost / native all-in cost (fee + storage deposit). Apples to apples. */
  ratioAllIn: number | null;
  /** EVM all-in cost / native partialFee only. This is how an "~800x" headline is usually produced. */
  ratioVsNativeFeeOnly: number | null;
  recommended: Recommendation;
  /** Absolute difference of all-in costs, in planck (14 dp). */
  savingsPlanck: bigint;
  reason: string;
  measuredAt: string;
};

/** Costs within this relative band are reported as "either". */
export const TIE_BAND = 0.02;

export function evmLegFromQuote(method: string, q: { gas: bigint; gasPrice: bigint; feeWei: bigint; blockNumber: number }, evmDecimals = 18, nativeDecimals = 14): EvmLeg {
  return { status: 'ok', method, gas: q.gas, gasPrice: q.gasPrice, feeWei: q.feeWei, totalPlanck: weiToPlanck(q.feeWei, evmDecimals, nativeDecimals), blockNumber: q.blockNumber };
}

export function nativeLegFromQuote(q: { method: string; partialFee: bigint; storageDeposit: bigint; codeDeposit?: bigint | null; itemStorageDeposit?: bigint | null; weight: { refTime: bigint; proofSize: bigint }; blockNumber: number }): NativeLeg {
  const leg: Extract<NativeLeg, { status: 'ok' }> = {
    status: 'ok',
    method: q.method,
    partialFee: q.partialFee,
    storageDeposit: q.storageDeposit,
    totalPlanck: q.partialFee + q.storageDeposit,
    weight: q.weight,
    blockNumber: q.blockNumber,
  };
  if (q.codeDeposit != null) leg.codeDeposit = q.codeDeposit;
  if (q.itemStorageDeposit != null) leg.itemStorageDeposit = q.itemStorageDeposit;
  return leg;
}

export function compareLegs(evm: EvmLeg, native: NativeLeg, now: Date = new Date()): Comparison {
  const measuredAt = now.toISOString();
  if (evm.status !== 'ok' && native.status !== 'ok') {
    return { evm, native, ratioAllIn: null, ratioVsNativeFeeOnly: null, recommended: null, savingsPlanck: 0n, reason: 'Neither surface could be estimated.', measuredAt };
  }
  if (evm.status !== 'ok') {
    return { evm, native, ratioAllIn: null, ratioVsNativeFeeOnly: null, recommended: 'native', savingsPlanck: 0n, reason: `Only native is available (EVM: ${evm.reason}).`, measuredAt };
  }
  if (native.status !== 'ok') {
    return { evm, native, ratioAllIn: null, ratioVsNativeFeeOnly: null, recommended: 'evm', savingsPlanck: 0n, reason: `Only EVM is available (native: ${native.reason}).`, measuredAt };
  }
  const e = evm.totalPlanck;
  const n = native.totalPlanck;
  const r = ratio(e, n);
  const rFee = ratio(e, native.partialFee);
  const diff = e > n ? e - n : n - e;
  const bigger = e > n ? e : n;
  const rel = bigger === 0n ? 0 : Number((diff * 1_000_000n) / bigger) / 1_000_000;
  let recommended: Recommendation;
  let reason: string;
  if (rel <= TIE_BAND) {
    recommended = 'either';
    reason = `All-in costs are within ${(TIE_BAND * 100).toFixed(0)}% — pick by wallet/UX.`;
  } else if (e < n) {
    recommended = 'evm';
    reason = `EVM is cheaper all-in by ${(rel * 100).toFixed(1)}%.`;
  } else {
    recommended = 'native';
    reason = `Native is cheaper all-in by ${(rel * 100).toFixed(1)}%.`;
  }
  if (native.storageDeposit > 0n) {
    reason += DEPOSIT_REASON_SUFFIX;
  }
  return { evm, native, ratioAllIn: r, ratioVsNativeFeeOnly: rFee, recommended, savingsPlanck: diff, reason, measuredAt };
}

/** JSON-safe form (bigints -> decimal strings) for storage/hashing. */
export function serializeComparison(c: Comparison): string {
  return JSON.stringify(c, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
}
