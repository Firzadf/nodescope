/**
 * EVM block height versus the Substrate header.
 *
 * A gap of HEAD_GAP_TOLERANCE_BLOCKS (2) or less is acceptable. A larger
 * gap is flagged only when it has already appeared on an earlier check
 * (a persistent gap). One reading above the tolerance is reported and
 * is not yet an action.
 *
 * This is a recommendation. It is not an input to
 * nodescope.health-score.v2, so existing reports still verify.
 */

import { parseHeight } from './liveStatus.mjs';

export const HEAD_GAP_TOLERANCE_BLOCKS = 2;

function signed(delta) {
  return `${delta >= 0n ? '+' : ''}${delta.toString()}`;
}

/**
 * @param {{ evmHeight?: unknown, wssHeight?: unknown, priorAbsGaps?: number[] }} [input]
 */
export function assessTransportHeads(input = {}) {
  const evm = parseHeight(input.evmHeight);
  const wss = parseHeight(input.wssHeight);
  const prior = (input.priorAbsGaps ?? []).filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (evm === null || wss === null) {
    return {
      status: 'unmeasured',
      persistent: false,
      gap: null,
      summary: `Needs both an EVM block height and a Substrate header. A gap of ${HEAD_GAP_TOLERANCE_BLOCKS} blocks or less is acceptable. A larger gap is flagged only when it persists across checks. This does not change nodescope.health-score.v2.`,
    };
  }
  const delta = evm - wss;
  const abs = delta < 0n ? -delta : delta;
  const absN = Number(abs);
  const base = { gap: absN, persistent: false };
  if (abs <= BigInt(HEAD_GAP_TOLERANCE_BLOCKS)) {
    return {
      ...base,
      status: 'within_tolerance',
      summary: `EVM #${evm.toString()} and Substrate #${wss.toString()} differ by ${absN} block${absN === 1 ? '' : 's'} (Δ ${signed(delta)}). A gap of ${HEAD_GAP_TOLERANCE_BLOCKS} or less is acceptable. This comparison is not part of nodescope.health-score.v2.`,
    };
  }
  const priorOver = prior.filter((g) => g > HEAD_GAP_TOLERANCE_BLOCKS).length;
  if (priorOver === 0) {
    return {
      ...base,
      status: 'gap_once',
      summary: `EVM #${evm.toString()} and Substrate #${wss.toString()} differ by ${absN} blocks (Δ ${signed(delta)}), above the ${HEAD_GAP_TOLERANCE_BLOCKS}-block tolerance. One reading is not a persistent gap. Run the self-check again before you switch endpoints.`,
    };
  }
  return {
    status: 'persistent_gap',
    persistent: true,
    gap: absN,
    summary: `Persistent gap of ${absN} blocks between EVM #${evm.toString()} and Substrate #${wss.toString()} (Δ ${signed(delta)}). A gap above ${HEAD_GAP_TOLERANCE_BLOCKS} that remains across checks is not acceptable. Switch or compare endpoints. This recommendation does not change nodescope.health-score.v2.`,
  };
}

function newestHeight(snapshots) {
  const sorted = [...(snapshots ?? [])].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  for (const snapshot of sorted) {
    const check = snapshot.checks?.find((c) => c.method === 'eth_blockNumber' && (c.success === true || c.outcome === 'success'));
    const height = check ? parseHeight(check.observedValue) : null;
    if (height !== null) return height.toString();
  }
  return null;
}

/** Heights from the latest EVM snapshot and the Substrate probe header. */
export function assessEndpointParity(input = {}) {
  const wss = input.wssHeight ?? input.wsProbe?.headerNumberDecimal ?? input.wsProbe?.headerNumberHex ?? null;
  return assessTransportHeads({
    evmHeight: input.evmHeight ?? newestHeight(input.snapshots),
    wssHeight: wss,
    priorAbsGaps: input.priorAbsGaps,
  });
}
