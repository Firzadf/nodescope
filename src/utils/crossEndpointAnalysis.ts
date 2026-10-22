import type { EndpointProfile } from '../types/endpoint';
import type { Finding } from '../types/diagnostic';
import type { HealthCheckCheck, HealthCheckSnapshot } from '../types/healthCheck';
import { defaultBlockMethodForProfile } from './blockMethodDefaults';
import { isUnsupportedMethod, parseBlockHeight } from './snapshotComparer';

/**
 * Cross-endpoint comparison analysis.
 *
 * `compareSnapshots` classifies a pair from different endpoints (origin and/or
 * profile) as `cross_endpoint` and conservatively withholds the block-height
 * delta. This module adds the comparability discipline on top, as a wrapper:
 * `compareSnapshots` is not modified, and same-endpoint pairs are untouched —
 * this function returns `null` for exactly the pairs `compareSnapshots`
 * calls `like_for_like`.
 *
 * Design rules:
 * - Pure and deterministic: inputs are never mutated, findings are emitted in
 *   a fixed rule order (support differences sorted by method name).
 * - Chain identity comes only from what the snapshots themselves recorded
 *   (a successful `eth_chainId`, falling back to a successful `net_version`),
 *   never from the URL and never assumed from the profile.
 * - Block heights on different chains are unrelated quantities: their delta
 *   is `not_comparable` and is never computed, let alone shown as a number.
 * - A block-height gap between two endpoints mixes any real sync difference
 *   with the time elapsed between the two checks. The gap finding states the
 *   signed fact and names that confound instead of claiming proven lag.
 * - No finding fires on absence of evidence (unknown chain, missing checks,
 *   failed probes): absence stays visible in the diff table, unfabricated.
 */

export type CrossEndpointChainRelation = 'same_chain' | 'different_chain' | 'unknown';

export type CrossEndpointBlockDeltaStatus = 'available' | 'not_comparable' | 'unavailable';

export interface CrossEndpointBlockDelta {
  status: CrossEndpointBlockDeltaStatus;
  /** Block-height method recorded in snapshot A (per A's profile). */
  methodA: string;
  /** Block-height method recorded in snapshot B (per B's profile). */
  methodB: string;
  /** Decimal string of A's height. Non-null when A's height was recorded and parseable. */
  a: string | null;
  /** Decimal string of B's height. Non-null when B's height was recorded and parseable. */
  b: string | null;
  /** Decimal string of `b - a`. Non-null only when `status === 'available'`. */
  delta: string | null;
}

export interface CrossEndpointAnalysis {
  originA: string;
  profileA: EndpointProfile;
  originB: string;
  profileB: EndpointProfile;
  /** Normalized decimal chain ID reported by snapshot A, or null when not recorded. */
  chainIdA: string | null;
  /** Normalized decimal chain ID reported by snapshot B, or null when not recorded. */
  chainIdB: string | null;
  chainRelation: CrossEndpointChainRelation;
  blockDelta: CrossEndpointBlockDelta;
  findings: Finding[];
}

/**
 * Minimum absolute block-height gap (in blocks) between two endpoints on the
 * same chain before a gap finding fires. A heuristic tripwire in the house
 * style of `STALL_RULE_MIN_GAP_SECONDS`: manual checks are usually seconds to
 * a couple of minutes apart, so a triple-digit gap is worth a look — it is a
 * prompt to investigate, never proof on its own that an endpoint lags.
 */
export const HEIGHT_GAP_FINDING_THRESHOLD_BLOCKS = 100;

/** Client-version method per profile, matching `methodsForProfile` in healthCheckRunner. */
const CLIENT_VERSION_METHOD: Record<EndpointProfile, string> = {
  portaldot_v3_evm: 'web3_clientVersion',
  generic_http: 'system_version',
};

function firstCheck(snapshot: HealthCheckSnapshot, method: string): HealthCheckCheck | null {
  return snapshot.checks.find((c) => c.method === method) ?? null;
}

/**
 * Parse a recorded chain identity value without precision loss: `0x` hex or a
 * plain decimal string (via BigInt), or a safe-integer number. Anything else
 * is not a chain identity and returns null — arbitrary strings are never
 * parsed as numbers.
 */
function parseChainIdValue(value: string | number | null): string | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^0[xX][0-9a-fA-F]+$/.test(trimmed) || /^[0-9]+$/.test(trimmed)) {
      try {
        return BigInt(trimmed).toString();
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * The chain a snapshot was taken on, from its own recorded checks only:
 * a successful `eth_chainId` first, then a successful `net_version`.
 */
export function extractChainId(snapshot: HealthCheckSnapshot): string | null {
  const chainIdCheck = firstCheck(snapshot, 'eth_chainId');
  if (chainIdCheck && chainIdCheck.outcome === 'success') {
    const parsed = parseChainIdValue(chainIdCheck.observedValue);
    if (parsed !== null) return parsed;
  }
  const netVersionCheck = firstCheck(snapshot, 'net_version');
  if (netVersionCheck && netVersionCheck.outcome === 'success') {
    return parseChainIdValue(netVersionCheck.observedValue);
  }
  return null;
}

function extractBlockHeight(snapshot: HealthCheckSnapshot): bigint | null {
  const method = defaultBlockMethodForProfile(snapshot.endpointProfile);
  const check = firstCheck(snapshot, method);
  if (!check || check.outcome !== 'success') return null;
  return parseBlockHeight(check.observedValue);
}

function extractClientVersion(snapshot: HealthCheckSnapshot): string | null {
  const method = CLIENT_VERSION_METHOD[snapshot.endpointProfile];
  const check = firstCheck(snapshot, method);
  if (!check || check.outcome !== 'success') return null;
  return typeof check.observedValue === 'string' && check.observedValue !== ''
    ? check.observedValue
    : null;
}

function differentChainFinding(
  a: HealthCheckSnapshot,
  b: HealthCheckSnapshot,
  chainIdA: string,
  chainIdB: string
): Finding {
  return {
    ruleId: 'cross_endpoint_different_chain',
    severity: 'error',
    title: 'Endpoints are on different chains',
    evidence: `Snapshot A endpoint ${a.endpointOrigin} reported chain ID ${chainIdA}; snapshot B endpoint ${b.endpointOrigin} reported chain ID ${chainIdB}.`,
    explanation:
      'Block heights from different chains are unrelated quantities. Subtracting them would produce a number that looks like progress or lag but means neither, so the block-height delta is withheld and marked not comparable.',
    recommendation:
      'Compare snapshots whose endpoints report the same chain ID. Until then, treat each endpoint\u2019s checks and findings on their own terms.',
  };
}

function heightGapFinding(
  a: HealthCheckSnapshot,
  b: HealthCheckSnapshot,
  heightA: bigint,
  heightB: bigint,
  delta: bigint
): Finding {
  const gap = (delta < 0n ? -delta : delta).toString();
  const direction =
    delta < 0n
      ? `Endpoint B is ${gap} blocks behind endpoint A at check time`
      : `Endpoint B is ${gap} blocks ahead of endpoint A at check time`;
  const elapsedSeconds = Math.round(Math.abs(b.timestamp - a.timestamp) / 1000);
  return {
    ruleId: 'cross_endpoint_height_gap',
    severity: 'warning',
    title: 'Large block-height gap between endpoints',
    evidence: `${direction}: endpoint A (${a.endpointOrigin}) reported block ${heightA.toString()} at ${a.exportedAt}; endpoint B (${b.endpointOrigin}) reported block ${heightB.toString()} at ${b.exportedAt}.`,
    explanation: `The two snapshots were taken ${elapsedSeconds} seconds apart, so this gap combines any real sync difference between the endpoints with the chain progress made between the two checks. It flags a gap of at least ${HEIGHT_GAP_FINDING_THRESHOLD_BLOCKS} blocks as worth investigating; on its own it does not prove either endpoint is lagging.`,
    recommendation:
      'Run health checks against both endpoints close together in time and compare again. If a large gap persists, investigate the behind endpoint\u2019s sync state and peer count.',
  };
}

function supportDifferenceFindings(
  a: HealthCheckSnapshot,
  b: HealthCheckSnapshot
): Finding[] {
  const byMethod = (snapshot: HealthCheckSnapshot): Map<string, HealthCheckCheck> => {
    const map = new Map<string, HealthCheckCheck>();
    for (const check of snapshot.checks) {
      if (!map.has(check.method)) map.set(check.method, check);
    }
    return map;
  };

  const checksA = byMethod(a);
  const checksB = byMethod(b);
  // Only methods probed in BOTH snapshots: a method missing on one side is a
  // method-set difference (already shown in the diff table), not a support fact.
  const sharedMethods = [...checksA.keys()].filter((m) => checksB.has(m)).sort();

  const findings: Finding[] = [];
  for (const method of sharedMethods) {
    const checkA = checksA.get(method) as HealthCheckCheck;
    const checkB = checksB.get(method) as HealthCheckCheck;
    const aUnsupported = isUnsupportedMethod(checkA.outcome);
    const bUnsupported = isUnsupportedMethod(checkB.outcome);
    const aSuccess = checkA.outcome === 'success';
    const bSuccess = checkB.outcome === 'success';

    if (!((aSuccess && bUnsupported) || (aUnsupported && bSuccess))) continue;

    const supporting = aSuccess
      ? `endpoint A (${a.endpointOrigin})`
      : `endpoint B (${b.endpointOrigin})`;
    const unsupported = aSuccess
      ? `endpoint B (${b.endpointOrigin})`
      : `endpoint A (${a.endpointOrigin})`;

    findings.push({
      ruleId: 'cross_endpoint_method_support_diff',
      severity: 'warning',
      title: `Method support differs: ${method}`,
      evidence: `${method} succeeded on ${supporting} but was reported as unsupported (method not found) by ${unsupported}.`,
      explanation:
        'The same method was probed against both endpoints and only one implements it. The endpoints run different software or configurations, so this method\u2019s results exist for one endpoint only.',
      recommendation: `Treat ${method} as unavailable on the endpoint that does not support it, and do not compare its values across these endpoints.`,
    });
  }
  return findings;
}

function clientVersionFinding(
  a: HealthCheckSnapshot,
  b: HealthCheckSnapshot
): Finding | null {
  // Version strings are only comparable when both sides recorded them via the
  // same method, which requires the same profile. Across profiles the strings
  // come from different methods and are not relabeled as a version difference.
  if (a.endpointProfile !== b.endpointProfile) return null;
  const versionA = extractClientVersion(a);
  const versionB = extractClientVersion(b);
  if (versionA === null || versionB === null || versionA === versionB) return null;

  const method = CLIENT_VERSION_METHOD[a.endpointProfile];
  return {
    ruleId: 'cross_endpoint_client_version_diff',
    severity: 'info',
    title: 'Endpoints report different client versions',
    evidence: `${method} returned "${versionA}" from endpoint A (${a.endpointOrigin}) and "${versionB}" from endpoint B (${b.endpointOrigin}).`,
    explanation:
      'The endpoints run different client software or builds. Behavior, supported methods, and performance can differ between them even on the same chain.',
    recommendation:
      'Note the version difference when interpreting any other diff between these endpoints; align client versions if the endpoints are meant to be interchangeable.',
  };
}

/**
 * Analyze a snapshot pair from different endpoints.
 *
 * Returns `null` when the pair is like-for-like (same origin AND same
 * profile) — exactly the pairs `compareSnapshots` treats as directly
 * comparable, which keep today's behavior with no additions.
 */
export function analyzeCrossEndpoint(
  a: HealthCheckSnapshot,
  b: HealthCheckSnapshot
): CrossEndpointAnalysis | null {
  if (a.endpointOrigin === b.endpointOrigin && a.endpointProfile === b.endpointProfile) {
    return null;
  }

  const chainIdA = extractChainId(a);
  const chainIdB = extractChainId(b);
  const chainRelation: CrossEndpointChainRelation =
    chainIdA !== null && chainIdB !== null
      ? chainIdA === chainIdB
        ? 'same_chain'
        : 'different_chain'
      : 'unknown';

  const heightA = extractBlockHeight(a);
  const heightB = extractBlockHeight(b);
  const methodA = defaultBlockMethodForProfile(a.endpointProfile);
  const methodB = defaultBlockMethodForProfile(b.endpointProfile);

  const delta: bigint | null =
    chainRelation === 'same_chain' && heightA !== null && heightB !== null
      ? heightB - heightA
      : null;

  const blockDelta: CrossEndpointBlockDelta = {
    status:
      chainRelation === 'different_chain'
        ? 'not_comparable'
        : delta !== null
          ? 'available'
          : 'unavailable',
    methodA,
    methodB,
    a: heightA !== null ? heightA.toString() : null,
    b: heightB !== null ? heightB.toString() : null,
    delta: delta !== null ? delta.toString() : null,
  };

  const findings: Finding[] = [];
  if (chainRelation === 'different_chain') {
    findings.push(
      differentChainFinding(a, b, chainIdA as string, chainIdB as string)
    );
  }
  if (delta !== null && heightA !== null && heightB !== null) {
    const absDelta = delta < 0n ? -delta : delta;
    if (absDelta >= BigInt(HEIGHT_GAP_FINDING_THRESHOLD_BLOCKS)) {
      findings.push(heightGapFinding(a, b, heightA, heightB, delta));
    }
  }
  findings.push(...supportDifferenceFindings(a, b));
  const versionFinding = clientVersionFinding(a, b);
  if (versionFinding) findings.push(versionFinding);

  return {
    originA: a.endpointOrigin,
    profileA: a.endpointProfile,
    originB: b.endpointOrigin,
    profileB: b.endpointProfile,
    chainIdA,
    chainIdB,
    chainRelation,
    blockDelta,
    findings,
  };
}
