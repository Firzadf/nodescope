import { hexToBigInt, toHex } from './units';

export type EvmTx = {
  from?: string;
  to?: string;
  data?: string;
  value?: bigint;
};

type RpcResponse<T> = { jsonrpc: '2.0'; id: number; result?: T; error?: { code: number; message: string; data?: unknown } };

let rpcId = 0;

export class EvmRpcError extends Error {
  method: string;
  code?: number;
  constructor(method: string, message: string, code?: number) {
    super(`${method}: ${message}`);
    this.method = method;
    this.code = code;
  }
}

export async function evmRpc<T = string>(url: string, method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  if (!res.ok) throw new EvmRpcError(method, `HTTP ${res.status}`);
  const json = (await res.json()) as RpcResponse<T>;
  if (json.error) throw new EvmRpcError(method, json.error.message, json.error.code);
  return json.result as T;
}

export function toRpcTx(tx: EvmTx): Record<string, string> {
  const o: Record<string, string> = {};
  if (tx.from) o.from = tx.from;
  if (tx.to) o.to = tx.to;
  if (tx.data && tx.data !== '0x') o.data = tx.data;
  if (tx.value !== undefined && tx.value > 0n) o.value = toHex(tx.value);
  return o;
}

export type EvmFeeQuote = {
  gas: bigint;
  gasPrice: bigint;
  /** gas * gasPrice, in wei (18 decimals). On pallet-revive this INCLUDES the storage deposit. */
  feeWei: bigint;
  blockNumber: number;
};

export async function quoteEvm(url: string, tx: EvmTx): Promise<EvmFeeQuote> {
  const [gasHex, priceHex, blockHex] = await Promise.all([
    evmRpc<string>(url, 'eth_estimateGas', [toRpcTx(tx)]),
    evmRpc<string>(url, 'eth_gasPrice'),
    evmRpc<string>(url, 'eth_blockNumber'),
  ]);
  const gas = hexToBigInt(gasHex);
  const gasPrice = hexToBigInt(priceHex);
  return { gas, gasPrice, feeWei: gas * gasPrice, blockNumber: Number(hexToBigInt(blockHex)) };
}

export async function evmChainId(url: string): Promise<number> {
  return Number(hexToBigInt(await evmRpc<string>(url, 'eth_chainId')));
}

/** ERC-20 transfer(address,uint256) calldata. */
export function erc20TransferCalldata(to: string, amount: bigint): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new Error(`invalid recipient: ${to}`);
  return '0xa9059cbb' + to.slice(2).toLowerCase().padStart(64, '0') + amount.toString(16).padStart(64, '0');
}
