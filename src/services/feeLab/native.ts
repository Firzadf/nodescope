import type { ApiPromise } from '@polkadot/api';
import { DRY_RUN_DEPOSIT_LIMIT } from './constants';

export type NativeFeeQuote = {
  /** Extrinsic that was weighed, e.g. "balances.transferKeepAlive". */
  method: string;
  /** TransactionPaymentApi partialFee (planck, 14 decimals). Burned/paid fee. */
  partialFee: bigint;
  /** Storage deposit charged by the dry-run (planck). Reserved, not burned; refundable when storage is freed. */
  storageDeposit: bigint;
  weight: { refTime: bigint; proofSize: bigint };
  blockNumber: number;
};

let apiPromise: Promise<ApiPromise> | null = null;
let apiUrl = '';

/** Lazily connect (and memoise) an ApiPromise. Dynamic import keeps @polkadot/api out of SSR bundles. */
export async function getApi(url: string): Promise<ApiPromise> {
  if (apiPromise && apiUrl === url) return apiPromise;
  apiUrl = url;
  apiPromise = (async () => {
    const { ApiPromise, WsProvider } = await import('@polkadot/api');
    return ApiPromise.create({ provider: new WsProvider(url), noInitWarn: true, throwOnConnect: true });
  })();
  apiPromise.catch(() => { apiPromise = null; });
  return apiPromise;
}

async function head(api: ApiPromise): Promise<number> {
  const h = await api.rpc.chain.getHeader();
  return h.number.toNumber();
}

export async function nativeDecimalsFromChain(api: ApiPromise): Promise<number> {
  const d = api.registry.chainDecimals;
  return d[0] ?? 14;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function depositOf(sd: any): bigint {
  if (!sd) return 0n;
  if (sd.isCharge) return sd.asCharge.toBigInt();
  return 0n; // Refund -> no charge
}

function dryRunError(api: ApiPromise, result: any): string | null {
  if (result.isOk) {
    const ok = result.asOk;
    const flags = ok.result ? ok.result.flags : ok.flags;
    if (flags && flags.bits && flags.bits.toNumber && (flags.bits.toNumber() & 1) === 1) return 'contract reverted';
    return null;
  }
  const err = result.asErr;
  if (err.isModule) {
    try {
      const meta = api.registry.findMetaError(err.asModule);
      return `${meta.section}.${meta.name}`;
    } catch { /* fallthrough */ }
  }
  return err.toString();
}

/** Native balances transfer, weighed by TransactionPaymentApi.query_info. */
export async function quoteNativeTransfer(api: ApiPromise, origin: string, dest: string, amountPlanck: bigint): Promise<NativeFeeQuote> {
  const tx = api.tx.balances.transferKeepAlive(dest, amountPlanck);
  const [info, blockNumber] = await Promise.all([tx.paymentInfo(origin), head(api)]);
  return {
    method: 'balances.transferKeepAlive',
    partialFee: info.partialFee.toBigInt(),
    storageDeposit: 0n,
    weight: { refTime: info.weight.refTime.toBigInt(), proofSize: info.weight.proofSize.toBigInt() },
    blockNumber,
  };
}

/** pallet-assets transfer (the native equivalent of an ERC-20 transfer for a Substrate asset). */
export async function quoteAssetsTransfer(api: ApiPromise, origin: string, assetId: number, dest: string, amount: bigint): Promise<NativeFeeQuote> {
  const tx = api.tx.assets.transferKeepAlive(assetId, dest, amount);
  const [info, blockNumber] = await Promise.all([tx.paymentInfo(origin), head(api)]);
  return {
    method: 'assets.transferKeepAlive',
    partialFee: info.partialFee.toBigInt(),
    storageDeposit: 0n,
    weight: { refTime: info.weight.refTime.toBigInt(), proofSize: info.weight.proofSize.toBigInt() },
    blockNumber,
  };
}

/**
 * Same contract call, dispatched natively as `revive.call` (Substrate extrinsic) instead of an Ethereum tx.
 * Dry-run via ReviveApi.call (storage deposit limit must be > 0), then weigh the real extrinsic.
 */
export async function quoteReviveCall(api: ApiPromise, origin: string, dest: string, valuePlanck: bigint, data: string): Promise<NativeFeeQuote> {
  const dry: any = await (api.call as any).reviveApi.call(origin, dest, valuePlanck, null, DRY_RUN_DEPOSIT_LIMIT, data);
  const err = dryRunError(api, dry.result);
  if (err) throw new Error(`revive dry-run failed: ${err}`);
  const sd = depositOf(dry.storageDeposit);
  const tx = api.tx.revive.call(dest, valuePlanck, dry.weightRequired, sd > 0n ? sd : 1n, data);
  const [info, blockNumber] = await Promise.all([tx.paymentInfo(origin), head(api)]);
  return {
    method: 'revive.call',
    partialFee: info.partialFee.toBigInt(),
    storageDeposit: sd,
    weight: { refTime: dry.weightRequired.refTime.toBigInt(), proofSize: dry.weightRequired.proofSize.toBigInt() },
    blockNumber,
  };
}

/** Same deployment, dispatched natively as `revive.instantiateWithCode` (EVM bytecode is allowed on this runtime). */
export async function quoteReviveInstantiate(api: ApiPromise, origin: string, code: string, data = '0x', valuePlanck = 0n): Promise<NativeFeeQuote> {
  const dry: any = await (api.call as any).reviveApi.instantiate(origin, valuePlanck, null, DRY_RUN_DEPOSIT_LIMIT, { Upload: code }, data, null);
  const err = dryRunError(api, dry.result);
  if (err) throw new Error(`revive dry-run failed: ${err}`);
  const sd = depositOf(dry.storageDeposit);
  const tx = api.tx.revive.instantiateWithCode(valuePlanck, dry.weightRequired, sd > 0n ? sd : 1n, code, data, null);
  const [info, blockNumber] = await Promise.all([tx.paymentInfo(origin), head(api)]);
  return {
    method: 'revive.instantiateWithCode',
    partialFee: info.partialFee.toBigInt(),
    storageDeposit: sd,
    weight: { refTime: dry.weightRequired.refTime.toBigInt(), proofSize: dry.weightRequired.proofSize.toBigInt() },
    blockNumber,
  };
}

export type LiveDecimals = {
  nativeDecimals: number;
  symbol: string;
  /** revive.nativeToEthRatio constant (wei per planck). */
  nativeToEthRatio: bigint | null;
  /** nativeDecimals + log10(nativeToEthRatio), i.e. the decimals the EVM RPC uses. */
  evmDecimals: number | null;
};

/** Read token decimals from runtime chain properties and the revive pallet constant, instead of assuming them. */
export async function liveDecimals(api: ApiPromise): Promise<LiveDecimals> {
  const nativeDecimals = api.registry.chainDecimals[0] ?? 14;
  const symbol = api.registry.chainTokens[0] ?? 'tPOT';
  let nativeToEthRatio: bigint | null = null;
  let evmDecimals: number | null = null;
  const c = (api.consts as any).revive?.nativeToEthRatio;
  if (c) {
    nativeToEthRatio = BigInt(c.toString());
    const digits = nativeToEthRatio.toString();
    if (/^10*$/.test(digits)) evmDecimals = nativeDecimals + digits.length - 1;
  }
  return { nativeDecimals, symbol, nativeToEthRatio, evmDecimals };
}

/**
 * NodeScope adaptation (not in DualFee): close the memoized ApiPromise so the
 * Fee Lab leaves no live connection behind when its panel unmounts. Nothing
 * polls in NodeScope; this only tears down a connection that a
 * user-triggered measurement opened. A later measurement reconnects lazily.
 */
export async function disconnectApi(): Promise<void> {
  const pending = apiPromise;
  apiPromise = null;
  apiUrl = '';
  if (!pending) return;
  try {
    const api = await pending;
    await api.disconnect();
  } catch {
    // The connection already failed; there is nothing to tear down.
  }
}
