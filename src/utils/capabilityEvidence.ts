import type { CapabilitySnapshot } from '../types/capability';
import type { DiagnosticHistoryItem } from '../types/rpc';
import { sanitizeEndpointOrigin } from '../utils/reportBuilder';

export type MethodEvidenceStatus = 'confirmed' | 'advertised' | 'unsupported' | 'unknown';

/**
 * Orders history items for evidence resolution.
 *
 * History storage (`saveDiagnosticHistory`) prepends each new item, so the array is
 * newest-first by insertion. We do NOT rely on that ordering alone: items are ranked by
 * `timestamp` (milliseconds, set by the RPC transport at request time), and only when
 * timestamps are equal or missing do we fall back to array position (earlier index wins).
 * That gives a deterministic rule for every input, including legacy or hand-edited history.
 */
function isNewer(a: DiagnosticHistoryItem, aIndex: number, b: DiagnosticHistoryItem, bIndex: number): boolean {
  const aTs = typeof a.timestamp === 'number' && Number.isFinite(a.timestamp) ? a.timestamp : null;
  const bTs = typeof b.timestamp === 'number' && Number.isFinite(b.timestamp) ? b.timestamp : null;

  if (aTs !== null && bTs !== null) {
    if (aTs !== bTs) return aTs > bTs;
    // Equal timestamps: earlier array position wins (array is newest-first on write).
    return aIndex < bIndex;
  }
  if (aTs !== null) return true; // a has a usable timestamp, b does not
  if (bTs !== null) return false; // b has a usable timestamp, a does not
  return aIndex < bIndex; // neither has a timestamp: rely on insertion order
}

function findMostRecentForMethod(
  method: string,
  history: DiagnosticHistoryItem[],
  normalizedEndpoint: string
): DiagnosticHistoryItem | null {
  let best: DiagnosticHistoryItem | null = null;
  let bestIndex = -1;

  for (let index = 0; index < history.length; index += 1) {
    const item = history[index];
    if (!item || item.request?.method !== method) continue;
    if (sanitizeEndpointOrigin(item.endpoint) !== normalizedEndpoint) continue;
    if (best === null || isNewer(item, index, best, bestIndex)) {
      best = item;
      bestIndex = index;
    }
  }

  return best;
}

function isMethodNotFound(item: DiagnosticHistoryItem): boolean {
  // Strict: only a genuine JSON-RPC Method not found response counts.
  // Generic error strings (transport/HTTP/timeout or plain text) must never
  // confer `unsupported`. Require structured error code -32601.
  return item.response?.error?.code === -32601;
}

export function getMethodEvidenceStatus(
  method: string,
  snapshot: CapabilitySnapshot | null,
  history: DiagnosticHistoryItem[],
  currentEndpoint: string
): MethodEvidenceStatus {
  const normalizedEndpoint = sanitizeEndpointOrigin(currentEndpoint);

  // Conservative guard: with an unusable target endpoint we cannot attribute any historical
  // evidence to it, so we never report confirmed/unsupported from history.
  if (normalizedEndpoint === 'invalid-url') {
    return advertisedOrUnknown(method, snapshot, normalizedEndpoint);
  }

  const mostRecent = findMostRecentForMethod(method, history, normalizedEndpoint);

  if (mostRecent) {
    if (mostRecent.success === true) return 'confirmed';
    if (isMethodNotFound(mostRecent)) return 'unsupported';
  }

  return advertisedOrUnknown(method, snapshot, normalizedEndpoint);
}

function advertisedOrUnknown(
  method: string,
  snapshot: CapabilitySnapshot | null,
  normalizedEndpoint: string
): MethodEvidenceStatus {
  // Advertisement alone must never produce confirmed or unsupported.
  // Snapshot is scoped to its endpointOrigin — cross-endpoint advertisement must not leak.
  if (snapshot && snapshot.discoveryStatus === 'success') {
    if (sanitizeEndpointOrigin(snapshot.endpointOrigin) !== normalizedEndpoint) return 'unknown';
    const advertised = snapshot.safeAdvertisedMethods.some((m) => m.method === method);
    if (advertised) return 'advertised';
  }
  return 'unknown';
}

export function formatEvidenceLabel(status: MethodEvidenceStatus): string {
  switch (status) {
    case 'confirmed':
      return 'Confirmed (Tested Successfully)';
    case 'advertised':
      return 'Advertised — Not Yet Tested';
    case 'unsupported':
      return 'Unsupported (Method Not Found)';
    case 'unknown':
    default:
      return 'Status Unknown';
  }
}