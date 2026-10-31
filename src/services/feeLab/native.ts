import type { ApiPromise } from '@polkadot/api';
import type { WsProvider } from '@polkadot/api';
import { DRY_RUN_DEPOSIT_LIMIT } from './constants';
import { byteLengthOfHex, callDepositParts, splitReviveDeposit } from './deposits';

export type NativeFeeQuote = {
  /** Extrinsic that was weighed, e.g. "balances.transferKeepAlive". */
  method: string;
  /** TransactionPaymentApi partialFee (planck, 14 decimals). Burned/paid fee. */
  partialFee: bigint;
  /** Storage deposit charged by the dry-run (planck). Reserved, not burned. */
  storageDeposit: bigint;
  /**
   * Code-deposit portion when it could be estimated. Refunded when the
   * code is no longer referenced and the original uploader removes it.
   */
  codeDeposit?: bigint | null;
  /**
   * Item-storage portion. Refunded after contract termination, once
   * storage cleanup runs. Null when the dry-run total could not be split.
   */
  itemStorageDeposit?: bigint | null;
  weight: { refTime: bigint; proofSize: bigint };
  blockNumber: number;
};

/**
 * Race a promise against a timeout. On timeout the timer's callback runs
 * first (so the caller can tear down the underlying resource), then the
 * returned promise rejects with Error('timed out') — the exact reason the
 * Fee Lab surfaces as "unavailable: timed out" instead of hanging.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error('timed out'));
    }, ms);
  });
  return Promise.race([
    promise.then(
      (v) => {
        clearTimeout(timer);
        return v;
      },
      (e: unknown) => {
        clearTimeout(timer);
        throw e;
      },
    ),
    timeout,
  ]);
}

let apiPromise: Promise<ApiPromise> | null = null;
/** The live provider handle, kept separately so disconnectApi can close a
 * connection whose ApiPromise.create never settled (the old code awaited
 * the pending promise, so a silent endpoint leaked the socket forever). */
let apiProvider: WsProvider | null = null;
let apiSettled: ApiPromise | null = null;
let apiUrl = '';
let attempt = 0;

/**
 * Lazily connect (and memoise) an ApiPromise. Dynamic import keeps
 * @polkadot/api out of SSR bundles.
 *
 * Two hang guards, both deliberate:
 * - WsProvider with autoConnectMs=false: a dropped or silent endpoint never
 *   reconnects on its own (the old default retried every ~2.5s forever).
 * - A connect timeout (default 10s): if ApiPromise.create never settles
 *   (socket open but the node silent), the attempt is torn down and the
 *   call rejects with 'timed out' instead of hanging the Measure button.
 *
 * autoConnect=false also means the provider never connects on its own, and
 * ApiPromise.create waits on it forever — so connect() is called explicitly
 * here, still inside the 10s withTimeout below. Without this call the live
 * native leg timed out on every run even though the raw WSS endpoint was
 * healthy (independent QA, 26 Oct 2026). The flag stays false: one explicit
 * connection attempt, no reconnect loop.
 */
export async function getApi(url: string, timeoutMs = 10000): Promise<ApiPromise> {
  if (apiPromise && apiUrl === url) return apiPromise;
  const myAttempt = ++attempt;
  apiUrl = url;
  apiPromise = (async () => {
    const { ApiPromise, WsProvider } = await import('@polkadot/api');
    const provider = new WsProvider(url, false);
    if (myAttempt === attempt) apiProvider = provider;
    await provider.connect();
    const api = await ApiPromise.create({ provider, noInitWarn: true, throwOnConnect: true });
    if (myAttempt === attempt) apiSettled = api;
    return api;
  })();
  apiPromise.then(
    () => undefined,
    () => {
      if (myAttempt === attempt) {
        apiPromise = null;
        apiProvider = null;
        apiSettled = null;
      }
    },
  );
  return withTimeout(apiPromise, timeoutMs, () => {
    if (myAttempt === attempt) void disconnectApi();
  });
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
function reviveDepositPerByte(api: ApiPromise): bigint | null {
  try {
    const revive = (api.consts as { revive?: Record<string, { toBigInt?: () => bigint; toString?: () => string }> }).revive;
    const raw = revive?.depositPerByte;
    if (!raw) return null;
    const value = typeof raw.toBigInt === 'function' ? raw.toBigInt() : BigInt(raw.toString?.() ?? '');
    return value > 0n ? value : null;
  } catch {
    return null;
  }
}

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
  const parts = callDepositParts(sd);
  const tx = api.tx.revive.call(dest, valuePlanck, dry.weightRequired, sd > 0n ? sd : 1n, data);
  const [info, blockNumber] = await Promise.all([tx.paymentInfo(origin), head(api)]);
  return {
    method: 'revive.call',
    partialFee: info.partialFee.toBigInt(),
    storageDeposit: sd,
    codeDeposit: parts.codeDeposit,
    itemStorageDeposit: parts.itemStorageDeposit,
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
  const parts = splitReviveDeposit(sd, byteLengthOfHex(code), reviveDepositPerByte(api));
  const tx = api.tx.revive.instantiateWithCode(valuePlanck, dry.weightRequired, sd > 0n ? sd : 1n, code, data, null);
  const [info, blockNumber] = await Promise.all([tx.paymentInfo(origin), head(api)]);
  return {
    method: 'revive.instantiateWithCode',
    partialFee: info.partialFee.toBigInt(),
    storageDeposit: sd,
    codeDeposit: parts.codeDeposit,
    itemStorageDeposit: parts.itemStorageDeposit,
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
 * Close the memoized ApiPromise so the
 * Fee Lab leaves no live connection behind when its panel unmounts. Nothing
 * polls in NodeScope; this only tears down a connection that a
 * user-triggered measurement opened. A later measurement reconnects lazily.
 *
 * The provider handle is closed directly, without awaiting the pending
 * ApiPromise.create: when the endpoint is silent, that promise never
 * settles, and awaiting it is exactly how the old code leaked the socket.
 * Bumping the attempt invalidates any late settlement from the abandoned
 * attempt, so it can never resurrect a torn-down connection.
 */
export async function disconnectApi(): Promise<void> {
  attempt++;
  const provider = apiProvider;
  const settled = apiSettled;
  apiPromise = null;
  apiProvider = null;
  apiSettled = null;
  apiUrl = '';
  if (provider) {
    try {
      void provider.disconnect();
    } catch {
      // Already closed; nothing to tear down.
    }
  }
  if (settled) {
    try {
      await settled.disconnect();
    } catch {
      // The connection already failed; there is nothing to tear down.
    }
  }
}
