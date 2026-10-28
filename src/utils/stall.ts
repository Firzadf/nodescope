import type { HealthCheckSnapshot } from '../types/healthCheck';
import type { SubstrateWsProbeResult } from '../services/substrateWsProbe';
import { assessStall, parseHeight } from '../../shared/liveStatus.mjs';
import { parseBlockHeight } from './snapshotComparer';

export type StallState = 'stalled' | 'live' | 'unknown';
export type StallKind = 'best' | 'finalized' | 'both' | null;

export interface ChainMotion {
  observedAtMs: number;
  bestHeight: string | null;
  bestTimestampSec: number | null;
  finalizedHeight: string | null;
  finalizedTimestampSec: number | null;
}

export interface StallAssessment {
  state: StallState;
  kind: StallKind;
  reasons: string[];
  explanation: string;
  bestAgeSeconds: number | null;
  finalizedAgeSeconds: number | null;
  finalityLagBlocks: number | null;
  bestHeight: string | null;
  finalizedHeight: string | null;
}

function heightSamples(snapshots: HealthCheckSnapshot[], method: string): Array<{ height: string; atMs: number }> {
  return snapshots.flatMap((s) => {
    const check = s.checks.find((c) => c.method === method && c.success);
    const h = check ? parseBlockHeight(check.observedValue) : null;
    return h === null ? [] : [{ height: h.toString(), atMs: s.timestamp }];
  });
}

/**
 * Stall from the measurements a session already has. RPC "answered" when
 * any EVM check succeeded or the WSS probe did. Heights prefer the EVM
 * best head, then the Substrate header.
 */
export function stallFromSession(
  snapshots: HealthCheckSnapshot[],
  wsProbe: SubstrateWsProbeResult | null,
  motion: ChainMotion | null,
  nowMs = Date.now(),
): StallAssessment {
  const evmAnswered = snapshots.some((s) => s.checks.some((c) => c.success));
  const wsAnswered = wsProbe?.status === 'ok';
  const bestFromEvm = heightSamples(snapshots, 'eth_blockNumber');
  const bestHeight = motion?.bestHeight
    ?? (bestFromEvm.length ? [...bestFromEvm].sort((a, b) => b.atMs - a.atMs)[0].height : null)
    ?? wsProbe?.headerNumberDecimal
    ?? null;
  const finalizedHeight = motion?.finalizedHeight ?? wsProbe?.finalizedNumberDecimal ?? null;
  return assessStall({
    nowMs,
    rpcAnswered: evmAnswered || wsAnswered || motion !== null,
    bestSamples: bestFromEvm,
    finalizedSamples: [],
    bestTimestampSec: motion?.bestTimestampSec ?? null,
    finalizedTimestampSec: motion?.finalizedTimestampSec ?? null,
    bestHeight,
    finalizedHeight,
  }) as StallAssessment;
}

export function lagBlocks(best: string | null | undefined, finalized: string | null | undefined): number | null {
  const b = parseHeight(best ?? null);
  const f = parseHeight(finalized ?? null);
  if (b === null || f === null) return null;
  return Number(b - f);
}
