/**
 * Per-endpoint request spacing for official RPCs.
 *
 * Portaldot's guidance is under 5 requests per second per endpoint.
 * Starts are at least 250 ms apart, so a lane stays at 4/s. The first
 * request on a lane is not delayed. Different origins do not wait on
 * each other. The wait happens before a call is timed, so it is not
 * reported as node latency and it does not change the health-score formula.
 */

export const OFFICIAL_RPS_LIMIT = 5;
export const REQUEST_GAP_MS = 250;

let gapMs = REQUEST_GAP_MS;
const lanes = new Map();

export function setRequestGapMs(ms) {
  gapMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
}

export function resetRequestPacer() {
  lanes.clear();
}

export function requestLaneKey(url) {
  try {
    return new URL(url).origin;
  } catch {
    return String(url);
  }
}

/** Resolves when this origin is allowed to start its next request. */
export function paceRequest(url) {
  const key = requestLaneKey(url);
  const lane = lanes.get(key) ?? { chain: Promise.resolve(), lastAt: 0 };
  const run = lane.chain.then(async () => {
    const wait = Math.max(0, lane.lastAt + gapMs - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lane.lastAt = Date.now();
  });
  lane.chain = run.then(
    () => undefined,
    () => undefined,
  );
  lanes.set(key, lane);
  return run;
}
