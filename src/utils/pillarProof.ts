// One-shot live proof measurements for the landing pillar cards. Each
// measurement runs at most once per page view: either when its card scrolls
// into view or when the visitor presses Measure. Nothing here polls, and
// nothing opens a connection before that moment. Failures surface as an
// unavailable state the visitor can retry, never as a fabricated number.
import { sendJsonRpcRequest } from '../services/rpcClient';
import { DEFAULT_PORTALDOT_V3_EVM_RPC } from '../types/endpoint';

/** One eth_blockNumber call with the 10s EVM timeout. Throws on failure. */
export async function measureHealthBlock(rpcUrl: string = DEFAULT_PORTALDOT_V3_EVM_RPC): Promise<number> {
  const res = await sendJsonRpcRequest(rpcUrl, 'eth_blockNumber', [], 10000);
  const raw = res.response?.result;
  if (!res.success || typeof raw !== 'string') {
    throw new Error(res.error ?? 'no block number returned');
  }
  return parseInt(raw, 16);
}

/** Display string for the Health card proof, e.g. "Block #204,917". */
export async function measureHealthProof(): Promise<string> {
  const block = await measureHealthBlock();
  return `Block #${block.toLocaleString('en-US')}`;
}

export function formatRatio(r: number | null): string {
  if (r === null) return '—';
  if (r >= 100) return `${Math.round(r).toLocaleString('en-US')}×`;
  if (r >= 10) return `${r.toFixed(1)}×`;
  return `${r.toFixed(3)}×`;
}

/**
 * One full Fee Lab estimate of the default deploy operation, loaded lazily
 * so the @polkadot/api chunk stays out of the landing's first load. The
 * estimate module carries the same timeout doctrine as the panel (native
 * connect 10s, native estimate 15s, EVM request 10s with one network retry).
 * Throws when either surface is unavailable.
 */
export async function measureFeesProof(): Promise<string> {
  const { estimateBoth, SAMPLE, SampleTokenBytecode } = await import('../services/feeLab/estimate');
  const comparison = await estimateBoth({ kind: 'contractDeploy', from: SAMPLE.holder, bytecode: SampleTokenBytecode });
  if (comparison.evm.status !== 'ok' || comparison.native.status !== 'ok') {
    throw new Error('one surface unavailable');
  }
  return `${formatRatio(comparison.ratioAllIn)} all-in`;
}
