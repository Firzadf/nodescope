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
  let lastNetworkError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    // 10s per attempt: a hung RPC must surface as a timeout, never as a
    // Measure button that spins forever. Aborts are not retried — a second
    // 10s wait would double the worst case for no new information.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new EvmRpcError(method, `HTTP ${res.status}`);
      const json = (await res.json()) as RpcResponse<T>;
      if (json.error) throw new EvmRpcError(method, json.error.message, json.error.code);
      return json.result as T;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof EvmRpcError) throw e;
      if (e instanceof Error && e.name === 'AbortError') {
        throw new EvmRpcError(method, 'request timed out (10s)');
      }
      // Network failure ("Failed to fetch" and friends): one retry, then a
      // plain-language error. The raw TypeError never reaches the UI.
      lastNetworkError = e;
      if (attempt === 0) continue;
      throw new EvmRpcError(method, 'network error after 1 retry');
    }
  }
  throw lastNetworkError instanceof Error ? lastNetworkError : new Error(String(lastNetworkError));
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

/**
 * Read a token's real decimals() via eth_call (read-only). The caller falls
 * back to the sample default when this throws (unreachable RPC, non-ERC-20
 * address, malformed response) — a failed decimals read must never block
 * the estimate. decimals() selector 0x313ce567, uint8 in the last byte.
 */
export async function erc20Decimals(url: string, token: string): Promise<number> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(token)) throw new Error(`invalid token address: ${token}`);
  const hex = await evmRpc<string>(url, 'eth_call', [{ to: token, data: '0x313ce567' }, 'latest']);
  const clean = hex.replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) throw new Error('malformed decimals() response');
  const decimals = Number.parseInt(clean.slice(-2), 16);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error('implausible decimals() value');
  }
  return decimals;
}
