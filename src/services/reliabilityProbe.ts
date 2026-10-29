import { sendJsonRpcRequest } from './rpcClient';
import { classifyAdvertisedMethods, classifyHistory, presentExposedMethodNames, type FlaggedMethod, type HistoryClass } from '../utils/rpcSecurity';
import { percentileMs } from '../../shared/liveStatus.mjs';

export interface ReliabilityReport {
  samples: number;
  errors: number;
  http5xx: number;
  latenciesMs: number[];
  p50Ms: number | null;
  p95Ms: number | null;
  spreadMs: number | null;
  history: HistoryClass;
  historyDetail: string;
  historyBlock: string | null;
  unsafe: FlaggedMethod[];
  stateChanging: FlaggedMethod[];
  /** True on the published Portaldot hosts: names are omitted, note is set. */
  exposedMethodsWithheld: boolean;
  exposedMethodsNote: string | null;
  methodCount: number | null;
  discoveryError: string | null;
}

function is5xx(error: string | null): boolean {
  return !!error && /HTTP Error: 5\d\d/.test(error);
}

function parseMethods(result: unknown): string[] | null {
  const raw = Array.isArray(result)
    ? result
    : result && typeof result === 'object' && Array.isArray((result as { methods?: unknown }).methods)
      ? (result as { methods: unknown[] }).methods
      : null;
  if (!raw) return null;
  return raw.filter((m): m is string => typeof m === 'string');
}

/**
 * User-triggered, read-only. Repeated eth_blockNumber for the error rate
 * and latency spread, one old-block header + balance for history, and
 * rpc_methods for the unsafe-method list. No method outside the read-only
 * allowlist is sent.
 */
export async function runReliabilityProbe(
  endpoint: string,
  options: { samples?: number; timeoutMs?: number } = {},
): Promise<ReliabilityReport> {
  const samples = Math.min(20, Math.max(1, options.samples ?? 6));
  const timeoutMs = options.timeoutMs ?? 8000;
  const latencies: number[] = [];
  let errors = 0;
  let http5xx = 0;
  let head: bigint | null = null;
  for (let i = 0; i < samples; i++) {
    const res = await sendJsonRpcRequest(endpoint, 'eth_blockNumber', [], timeoutMs);
    if (!res.success) {
      errors += 1;
      if (is5xx(res.error)) http5xx += 1;
      continue;
    }
    if (typeof res.latency === 'number') latencies.push(res.latency);
    if (head === null && typeof res.response?.result === 'string' && /^0x[0-9a-fA-F]+$/.test(res.response.result)) {
      head = BigInt(res.response.result);
    }
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = percentileMs(sorted, 50);
  const p95 = percentileMs(sorted, 95);
  const spread = sorted.length >= 2 ? sorted[sorted.length - 1] - sorted[0] : sorted.length === 1 ? 0 : null;

  let history: HistoryClass = 'unknown';
  let historyDetail = 'No head, so history was not probed.';
  let historyBlock: string | null = null;
  if (head !== null && head > 1n) {
    const old = head > 10000n ? head - 10000n : 1n;
    historyBlock = old.toString();
    const hex = `0x${old.toString(16)}`;
    const header = await sendJsonRpcRequest(endpoint, 'eth_getBlockByNumber', [hex, false], timeoutMs);
    const balance = await sendJsonRpcRequest(
      endpoint,
      'eth_getBalance',
      ['0x0000000000000000000000000000000000000001', hex],
      timeoutMs,
    );
    const classified = classifyHistory({
      block: historyBlock,
      headerOk: header.success && header.response?.result != null,
      headerError: header.error,
      stateOk: balance.success && typeof balance.response?.result === 'string',
      stateError: balance.error,
    });
    history = classified.klass;
    historyDetail = classified.detail;
  }

  const methodsRes = await sendJsonRpcRequest(endpoint, 'rpc_methods', [], timeoutMs);
  const methods = methodsRes.success ? parseMethods(methodsRes.response?.result) : null;
  const flagged = classifyAdvertisedMethods(methods ?? []);
  const unsafePresented = presentExposedMethodNames(endpoint, flagged.unsafe.map((m) => m.method));
  const statePresented = presentExposedMethodNames(endpoint, flagged.stateChanging.map((m) => m.method));
  const withheld = unsafePresented.withheld || statePresented.withheld;
  return {
    samples,
    errors,
    http5xx,
    latenciesMs: latencies,
    p50Ms: p50,
    p95Ms: p95,
    spreadMs: spread,
    history,
    historyDetail,
    historyBlock,
    unsafe: withheld ? [] : flagged.unsafe,
    stateChanging: withheld ? [] : flagged.stateChanging,
    exposedMethodsWithheld: withheld,
    exposedMethodsNote: withheld ? unsafePresented.note : null,
    methodCount: methods ? methods.length : null,
    discoveryError: methods ? null : methodsRes.error,
  };
}
