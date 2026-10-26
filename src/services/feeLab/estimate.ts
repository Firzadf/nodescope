import { DEFAULT_NETWORK, type NetworkConfig } from './constants';
import { quoteEvm, erc20TransferCalldata, type EvmTx } from './evm';
import { getApi, withTimeout, quoteNativeTransfer, quoteReviveCall, quoteReviveInstantiate, quoteAssetsTransfer } from './native';
import { compareLegs, evmLegFromQuote, nativeLegFromQuote, type Comparison, type EvmLeg, type NativeLeg, type Surface } from './compare';
import { h160ToAccountId32, isH160 } from './mapping';
import { planckToWei } from './units';
import type { ApiPromise } from '@polkadot/api';

export * from './constants';
export * from './units';
export * from './mapping';
export * from './evm';
export * from './native';
export * from './compare';
export * from './samples';
export * from './artifacts';

import type { DualTx, OpKind } from './types';
export type { DualTx, OpKind } from './types';

export type EstimateOptions = {
  network?: NetworkConfig;
  api?: ApiPromise;
  /** Passed to getApi when no api is supplied. Default 10000. */
  connectTimeoutMs?: number;
  /** Wall clock allowed for one native quote. Default 15000. */
  estimateTimeoutMs?: number;
};

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Map a DualTx to the Ethereum tx sent to eth_estimateGas. Returns null when there is no EVM equivalent. */
export function toEvmTx(tx: DualTx, net: NetworkConfig = DEFAULT_NETWORK): EvmTx | null {
  switch (tx.kind) {
    case 'nativeTransfer':
      return { from: tx.from, to: tx.to, value: planckToWei(tx.amountPlanck, net.nativeDecimals, net.evmDecimals) };
    case 'erc20Transfer':
      return { from: tx.from, to: tx.token, data: erc20TransferCalldata(tx.to, tx.amount) };
    case 'contractDeploy':
      return { from: tx.from, data: tx.bytecode + (tx.constructorData ?? '').replace(/^0x/, '') };
    case 'calldata':
      return { from: tx.from, to: tx.to, data: tx.data, value: tx.valuePlanck ? planckToWei(tx.valuePlanck, net.nativeDecimals, net.evmDecimals) : undefined };
    case 'assetsTransfer':
      return null;
  }
}

export function validateTx(tx: DualTx): void {
  if (!isH160(tx.from)) throw new Error('from must be a 0x… H160 address');
  if ('to' in tx && tx.to !== undefined && !isH160(tx.to)) throw new Error('to must be a 0x… H160 address');
  if (tx.kind === 'erc20Transfer' && !isH160(tx.token)) throw new Error('token must be a 0x… H160 address');
  if ((tx.kind === 'contractDeploy' && !/^0x[0-9a-fA-F]+$/.test(tx.bytecode)) || (tx.kind === 'calldata' && !/^0x[0-9a-fA-F]*$/.test(tx.data))) {
    throw new Error('bytecode/calldata must be 0x-prefixed hex');
  }
}

export async function estimateEvm(tx: DualTx, net: NetworkConfig = DEFAULT_NETWORK): Promise<EvmLeg> {
  const evmTx = toEvmTx(tx, net);
  const method = tx.kind === 'contractDeploy' || (tx.kind === 'calldata' && !tx.to) ? 'eth_estimateGas (create)' : 'eth_estimateGas';
  if (!evmTx) return { status: 'unavailable', method: 'n/a', reason: 'No verified EVM equivalent for this op on Portaldot V3 (ERC-20 precompile address for pallet-assets not confirmed).' };
  try {
    const q = await quoteEvm(net.evmRpc, evmTx);
    return evmLegFromQuote(method, q, net.evmDecimals, net.nativeDecimals);
  } catch (e) {
    return { status: 'unavailable', method, reason: msg(e) };
  }
}

/** The native extrinsic a DualTx is weighed as. Shared with the panel so a
 * natively-unavailable leg names the same method estimateNative would. */
export function nativeMethodFor(tx: DualTx): string {
  const methodFor: Record<OpKind, string> = {
    nativeTransfer: 'balances.transferKeepAlive',
    erc20Transfer: 'revive.call',
    contractDeploy: 'revive.instantiateWithCode',
    calldata: 'revive.call',
    assetsTransfer: 'assets.transferKeepAlive',
  };
  return tx.kind === 'calldata' && !tx.to ? 'revive.instantiateWithCode' : methodFor[tx.kind];
}

export async function estimateNative(tx: DualTx, opts: EstimateOptions = {}): Promise<NativeLeg> {
  const net = opts.network ?? DEFAULT_NETWORK;
  const method = nativeMethodFor(tx);
  try {
    const api = opts.api ?? (await getApi(net.substrateWss, opts.connectTimeoutMs));
    const origin = h160ToAccountId32(tx.from);
    const quote = async () => {
      switch (tx.kind) {
        case 'nativeTransfer':
          return quoteNativeTransfer(api, origin, h160ToAccountId32(tx.to), tx.amountPlanck);
        case 'erc20Transfer':
          return quoteReviveCall(api, origin, tx.token, 0n, erc20TransferCalldata(tx.to, tx.amount));
        case 'contractDeploy':
          return quoteReviveInstantiate(api, origin, tx.bytecode, tx.constructorData ?? '0x');
        case 'calldata':
          return tx.to
            ? quoteReviveCall(api, origin, tx.to, tx.valuePlanck ?? 0n, tx.data)
            : quoteReviveInstantiate(api, origin, tx.data, '0x', tx.valuePlanck ?? 0n);
        case 'assetsTransfer':
          return quoteAssetsTransfer(api, origin, tx.assetId, h160ToAccountId32(tx.to), tx.amount);
      }
    };
    // One hung dry-run or paymentInfo must not hang the comparison: the
    // 15s budget turns it into "unavailable: timed out" instead.
    const q = await withTimeout(quote(), opts.estimateTimeoutMs ?? 15000);
    return nativeLegFromQuote(q);
  } catch (e) {
    return { status: 'unavailable', method, reason: msg(e) };
  }
}

/** Estimate the same operation on both surfaces, in parallel, and compare all-in costs. */
export async function estimateBoth(tx: DualTx, opts: EstimateOptions = {}): Promise<Comparison> {
  validateTx(tx);
  const net = opts.network ?? DEFAULT_NETWORK;
  const [evm, native] = await Promise.all([estimateEvm(tx, net), estimateNative(tx, { ...opts, network: net })]);
  return compareLegs(evm, native);
}

/** Returns the surface to route to ('evm' | 'native'); on a tie prefers `tieBreak` (default 'evm' for wallet reach). */
export async function pickCheapest(tx: DualTx, opts: EstimateOptions & { tieBreak?: Surface } = {}): Promise<{ surface: Surface | null; comparison: Comparison }> {
  const comparison = await estimateBoth(tx, opts);
  const r = comparison.recommended;
  const surface = r === 'either' ? (opts.tieBreak ?? 'evm') : r;
  return { surface, comparison };
}
