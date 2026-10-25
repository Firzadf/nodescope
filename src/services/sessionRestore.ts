import type { SubstrateWsProbeResult } from './substrateWsProbe';
import type { CapabilitySnapshot, DiscoveryStatus } from '../types/capability';

/**
 * Session restore for the two App states that used to vanish on reload:
 * the Substrate WebSocket probe result and the capability discovery
 * snapshot. Snapshots and history already persisted; these two did not,
 * so a reload silently downgraded the combined verdict from COMPLETE to
 * PARTIAL. Stored data is scoped to the endpoint it was measured on, and
 * carries the time it was stored, so the UI can label it honestly as
 * restored from a previous session instead of presenting it as fresh.
 * sessionStorage only: closing the tab drops it, like everything else.
 */

const WS_PROBE_KEY = 'nodescope_ws_probe_v1';
const CAPABILITY_KEY = 'nodescope_capability_v1';

export interface StoredWsProbe {
  endpoint: string;
  result: SubstrateWsProbeResult;
  storedAt: number;
}

export interface StoredCapability {
  snapshot: CapabilitySnapshot;
  storedAt: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isNullOr<T>(v: unknown, check: (x: unknown) => boolean): v is T | null {
  return v === null || check(v);
}

export function isValidWsProbeResult(v: unknown): v is SubstrateWsProbeResult {
  if (!isRecord(v)) return false;
  return (
    typeof v.url === 'string' &&
    (v.status === 'ok' || v.status === 'error') &&
    isNullOr<number>(v.handshakeMs, (x) => typeof x === 'number') &&
    isNullOr<number>(v.totalMs, (x) => typeof x === 'number') &&
    isNullOr<string>(v.chain, (x) => typeof x === 'string') &&
    isNullOr<string>(v.version, (x) => typeof x === 'string') &&
    isNullOr<number>(v.peers, (x) => typeof x === 'number') &&
    isNullOr<boolean>(v.isSyncing, (x) => typeof x === 'boolean') &&
    isNullOr<boolean>(v.shouldHavePeers, (x) => typeof x === 'boolean') &&
    isNullOr<string>(v.headerNumberHex, (x) => typeof x === 'string') &&
    isNullOr<string>(v.headerNumberDecimal, (x) => typeof x === 'string') &&
    isNullOr<string>(v.error, (x) => typeof x === 'string')
  );
}

const DISCOVERY_STATUSES: DiscoveryStatus[] = [
  'success',
  'unsupported_method',
  'transport_error',
  'invalid_response',
  'not_attempted',
];

export function isValidCapabilitySnapshot(v: unknown): v is CapabilitySnapshot {
  if (!isRecord(v)) return false;
  return (
    typeof v.endpointOrigin === 'string' &&
    typeof v.discoveredAt === 'string' &&
    DISCOVERY_STATUSES.includes(v.discoveryStatus as DiscoveryStatus) &&
    Array.isArray(v.safeAdvertisedMethods) &&
    v.safeAdvertisedMethods.every(
      (m) => isRecord(m) && typeof m.method === 'string' && m.evidence === 'advertised',
    ) &&
    typeof v.rawMethodCount === 'number' &&
    isNullOr<number>(v.latencyMs, (x) => typeof x === 'number') &&
    isNullOr<string>(v.error, (x) => typeof x === 'string')
  );
}

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Session restore is best effort; the app still works without it.
  }
}

export function saveWsProbe(endpoint: string, result: SubstrateWsProbeResult): void {
  if (!isValidWsProbeResult(result)) return;
  write(WS_PROBE_KEY, { endpoint, result, storedAt: Date.now() });
}

export function loadWsProbe(endpoint: string): StoredWsProbe | null {
  const parsed = read<StoredWsProbe>(WS_PROBE_KEY);
  if (!parsed || parsed.endpoint !== endpoint) return null;
  if (typeof parsed.storedAt !== 'number' || !isValidWsProbeResult(parsed.result)) return null;
  return parsed;
}

export function endpointOrigin(endpoint: string): string {
  try {
    return new URL(endpoint).origin;
  } catch {
    return endpoint;
  }
}

export function saveCapability(snapshot: CapabilitySnapshot): void {
  if (!isValidCapabilitySnapshot(snapshot)) return;
  write(CAPABILITY_KEY, { snapshot, storedAt: Date.now() });
}

export function loadCapability(endpoint: string): StoredCapability | null {
  const parsed = read<StoredCapability>(CAPABILITY_KEY);
  if (!parsed) return null;
  if (typeof parsed.storedAt !== 'number' || !isValidCapabilitySnapshot(parsed.snapshot)) return null;
  if (parsed.snapshot.endpointOrigin !== endpointOrigin(endpoint)) return null;
  return parsed;
}
