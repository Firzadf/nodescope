import { sendJsonRpcRequest } from './rpcClient';
import type { ChainMotion } from '../utils/stall';

function hexQuantity(value: unknown): string | null {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value) ? BigInt(value).toString(10) : null;
}

/**
 * One read-only eth_getBlockByNumber("latest"). The timestamp is what
 * makes a single check able to see a paused chain (the 232115 halt had
 * a timestamp hours behind wall clock while eth_blockNumber still answered).
 */
export async function observeChainMotion(endpoint: string, timeoutMs = 8000): Promise<ChainMotion> {
  const observedAtMs = Date.now();
  const result = await sendJsonRpcRequest(endpoint, 'eth_getBlockByNumber', ['latest', false], timeoutMs);
  const block = result.success ? (result.response?.result as { number?: unknown; timestamp?: unknown } | null) : null;
  return {
    observedAtMs,
    bestHeight: hexQuantity(block?.number),
    bestTimestampSec: hexQuantity(block?.timestamp) === null ? null : Number(hexQuantity(block?.timestamp)),
    finalizedHeight: null,
    finalizedTimestampSec: null,
  };
}
