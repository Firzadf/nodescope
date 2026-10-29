import { sendJsonRpcRequest } from './rpcClient';
import { probeSubstrateWs } from './substrateWsProbe';
import { computeHealthScoreV2 } from '../utils/healthScore';
import { stallFromSession, type ChainMotion } from '../utils/stall';
import { endpointVerdict, type FleetRow } from '../utils/fleet';
import type { HealthCheckSnapshot } from '../types/healthCheck';
import { DEFAULT_PORTALDOT_V3_EVM_RPC } from '../types/endpoint';
import { PORTALDOT_SUBSTRATE_WSS } from '../utils/siteConstants';

export interface FleetTarget {
  id: string;
  label: string;
  url: string;
  kind: 'evm' | 'wss';
}

export const DEFAULT_FLEET: FleetTarget[] = [
  { id: 'evm', label: 'Portaldot V3 EVM', url: DEFAULT_PORTALDOT_V3_EVM_RPC, kind: 'evm' },
  { id: 'wss', label: 'Portaldot V3 WSS', url: PORTALDOT_SUBSTRATE_WSS, kind: 'wss' },
];

function hexToDec(value: unknown): string | null {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value) ? BigInt(value).toString(10) : null;
}

function snapshot(url: string, chain: string | null, block: string | null, latencyMs: number | null): HealthCheckSnapshot {
  const check = (method: string, observedValue: string | null, success: boolean) => ({
    method,
    outcome: success ? 'success' as const : 'network_error' as const,
    success,
    latencyMs,
    observedValue,
    error: success ? null : 'no answer',
  });
  return {
    schemaVersion: 'nodescope.health-snapshot.v1',
    id: `fleet-${url}`,
    timestamp: Date.now(),
    exportedAt: new Date().toISOString(),
    endpointOrigin: url,
    endpointProfile: 'portaldot_v3_evm',
    checks: [
      check('eth_chainId', chain, chain !== null),
      check('eth_blockNumber', block, block !== null),
    ],
    findings: [],
  };
}

/** One read-only check of one endpoint. Nothing is signed and nothing is polled. */
export async function checkFleetTarget(target: FleetTarget): Promise<FleetRow> {
  const base = { id: target.id, label: target.label, url: target.url, kind: target.kind, behind: false };
  if (target.kind === 'wss') {
    const probe = await probeSubstrateWs(target.url);
    const score = computeHealthScoreV2({ snapshots: [], wsProbe: probe });
    const stall = stallFromSession([], probe, null);
    return {
      ...base,
      verdict: endpointVerdict(probe.status === 'ok', stall.state === 'stalled', score.band),
      score: score.score,
      block: probe.headerNumberDecimal,
      finalityLag: probe.finalityLagBlocks ?? null,
      peers: probe.peers,
      latencyMs: probe.totalMs,
      error: probe.status === 'ok' ? null : probe.error,
    };
  }
  const started = Date.now();
  const [chainRes, blockRes] = await Promise.all([
    sendJsonRpcRequest(target.url, 'eth_chainId', [], 8000),
    sendJsonRpcRequest(target.url, 'eth_blockNumber', [], 8000),
  ]);
  const latencyMs = Date.now() - started;
  const chain = chainRes.success ? (typeof chainRes.response?.result === 'string' ? chainRes.response.result : null) : null;
  const blockHex = blockRes.success && typeof blockRes.response?.result === 'string' ? blockRes.response.result : null;
  const block = hexToDec(blockHex);
  let motion: ChainMotion | null = null;
  if (blockRes.success) {
    const full = await sendJsonRpcRequest(target.url, 'eth_getBlockByNumber', ['latest', false], 8000);
    const body = full.success ? full.response?.result as { timestamp?: unknown } | null : null;
    const ts = hexToDec(body?.timestamp);
    motion = {
      observedAtMs: Date.now(),
      bestHeight: block,
      bestTimestampSec: ts === null ? null : Number(ts),
      finalizedHeight: null,
      finalizedTimestampSec: null,
    };
  }
  const snap = snapshot(target.url, chain, blockHex, blockRes.latency ?? latencyMs);
  const score = computeHealthScoreV2({ snapshots: [snap], wsProbe: null, motion });
  const stall = stallFromSession([snap], null, motion);
  const answered = chainRes.success || blockRes.success;
  return {
    ...base,
    verdict: endpointVerdict(answered, stall.state === 'stalled', score.band),
    score: score.score,
    block,
    finalityLag: null,
    peers: null,
    latencyMs: blockRes.latency ?? latencyMs,
    error: answered ? null : (blockRes.error ?? chainRes.error),
  };
}
