import type { EndpointProfile } from '../types/endpoint';
import type { Finding } from '../types/diagnostic';
import type {
  HealthCheckCheck,
  HealthCheckOutcome,
  HealthCheckSnapshot,
} from '../types/healthCheck';

/**
 * Read-only snapshot comparison.
 *
 * Design rules:
 * - Pure and deterministic: inputs are never mutated, output ordering is stable.
 * - Missing data (`null`) is never equated with `0`, `false`, or `''`.
 * - `unsupported_method` is kept distinct from real failures (rpc/network/http/invalid).
 * - Block-height deltas are only derived from the method the profile actually uses, are
 *   parsed without precision loss (BigInt), and are reported as unavailable with an
 *   explicit reason otherwise.
 */

export type CheckComparisonStatus = 'unchanged' | 'changed' | 'added' | 'removed';

export type FindingComparisonStatus = 'unchanged_finding' | 'new_finding' | 'resolved_finding';

export type BlockHeightDeltaStatus =
  | 'available'
  | 'unavailable_incompatible_snapshots'
  | 'unavailable_missing_check'
  | 'unavailable_unsupported_representation';

export interface CheckFieldChange {
  field: 'outcome' | 'success' | 'observedValue' | 'latencyMs' | 'error';
  a: string | number | boolean | null;
  b: string | number | boolean | null;
}

export interface LatencyDelta {
  status: 'available' | 'missing_in_a' | 'missing_in_b' | 'missing_in_both' | 'invalid';
  /** Milliseconds (b - a). Non-null only when `status === 'available'`. */
  value: number | null;
}

export interface ComparedCheck {
  method: string;
  status: CheckComparisonStatus;
  /** Original check from snapshot A, by reference. Null when the method is only in B. */
  a: HealthCheckCheck | null;
  /** Original check from snapshot B, by reference. Null when the method is only in A. */
  b: HealthCheckCheck | null;
  /** Field-level differences. Empty for `unchanged`, `added`, and `removed`. */
  fieldChanges: CheckFieldChange[];
  latencyDelta: LatencyDelta;
}

export interface FindingFieldChange {
  field: 'severity' | 'title' | 'explanation' | 'recommendation';
  a: string;
  b: string;
}

export interface ComparedFinding {
  /** `ruleId::normalizedEvidence` with an occurrence index for duplicates. */
  key: string;
  ruleId: string;
  status: FindingComparisonStatus;
  /** Original finding from snapshot A, by reference. Null when only in B. */
  a: Finding | null;
  /** Original finding from snapshot B, by reference. Null when only in A. */
  b: Finding | null;
  /** Set when the key matches but non-key fields differ. */
  fieldChanges: FindingFieldChange[];
}

export interface BlockHeightDelta {
  status: BlockHeightDeltaStatus;
  /** Method the block height was read from, when one applies. */
  method: string | null;
  /** Decimal string of `b - a`. Non-null only when `status === 'available'`. */
  delta: string | null;
  /** Decimal string of A's height. */
  a: string | null;
  /** Decimal string of B's height. */
  b: string | null;
}

export interface SnapshotMetadata {
  id: string;
  timestamp: number;
  exportedAt: string;
  endpointOrigin: string;
  endpointProfile: EndpointProfile;
  checkCount: number;
  findingCount: number;
}

/**
 * `like_for_like` — same endpoint origin and profile, so values are directly comparable.
 * `cross_endpoint` — different origin and/or profile. Diffs are still produced as a
 * descriptive listing of each side's own results, not as a time series.
 */
export type ComparisonMode = 'like_for_like' | 'cross_endpoint';

export interface SnapshotComparison {
  mode: ComparisonMode;
  comparable: boolean;
  incompatibilityReason: string | null;
  a: SnapshotMetadata;
  b: SnapshotMetadata;
  checks: ComparedCheck[];
  findings: ComparedFinding[];
  blockHeightDelta: BlockHeightDelta;
}

/** Block-height method by profile, matching `methodsForProfile` in healthCheckRunner. */
const BLOCK_HEIGHT_METHOD: Record<EndpointProfile, string> = {
  portaldot_v3_evm: 'eth_blockNumber',
  generic_http: 'chain_getHeader',
};

function toMetadata(snapshot: HealthCheckSnapshot): SnapshotMetadata {
  return {
    id: snapshot.id,
    timestamp: snapshot.timestamp,
    exportedAt: snapshot.exportedAt,
    endpointOrigin: snapshot.endpointOrigin,
    endpointProfile: snapshot.endpointProfile,
    checkCount: snapshot.checks.length,
    findingCount: snapshot.findings.length,
  };
}

function buildIncompatibilityReason(
  a: HealthCheckSnapshot,
  b: HealthCheckSnapshot
): string | null {
  const originDiffers = a.endpointOrigin !== b.endpointOrigin;
  const profileDiffers = a.endpointProfile !== b.endpointProfile;
  if (!originDiffers && !profileDiffers) return null;

  const parts: string[] = [];
  if (originDiffers) parts.push(`endpoint origin ("${a.endpointOrigin}" vs "${b.endpointOrigin}")`);
  if (profileDiffers) parts.push(`endpoint profile ("${a.endpointProfile}" vs "${b.endpointProfile}")`);
  return `Snapshots are not directly comparable: they differ by ${parts.join(' and ')}.`;
}

function describeValue(value: string | number | boolean | null): string | number | boolean | null {
  return value;
}

function compareChecks(
  a: HealthCheckSnapshot,
  b: HealthCheckSnapshot
): ComparedCheck[] {
  const byMethod = (snapshot: HealthCheckSnapshot): Map<string, HealthCheckCheck> => {
    const map = new Map<string, HealthCheckCheck>();
    for (const check of snapshot.checks) {
      // First occurrence wins. `runHealthCheck` already deduplicates methods per snapshot.
      if (!map.has(check.method)) map.set(check.method, check);
    }
    return map;
  };

  const checksA = byMethod(a);
  const checksB = byMethod(b);
  const methods = Array.from(new Set([...checksA.keys(), ...checksB.keys()])).sort();

  return methods.map((method): ComparedCheck => {
    const checkA = checksA.get(method) ?? null;
    const checkB = checksB.get(method) ?? null;

    if (checkA && !checkB) {
      return {
        method,
        status: 'removed',
        a: checkA,
        b: null,
        fieldChanges: [],
        latencyDelta: { status: 'missing_in_b', value: null },
      };
    }
    if (!checkA && checkB) {
      return {
        method,
        status: 'added',
        a: null,
        b: checkB,
        fieldChanges: [],
        latencyDelta: { status: 'missing_in_a', value: null },
      };
    }

    // Both present. `checkA`/`checkB` are non-null here by the branches above.
    const left = checkA as HealthCheckCheck;
    const right = checkB as HealthCheckCheck;
    const fieldChanges: CheckFieldChange[] = [];

    const pushIfChanged = (
      field: CheckFieldChange['field'],
      from: string | number | boolean | null,
      to: string | number | boolean | null
    ): void => {
      if (from !== to) {
        fieldChanges.push({ field, a: describeValue(from), b: describeValue(to) });
      }
    };

    pushIfChanged('outcome', left.outcome, right.outcome);
    pushIfChanged('success', left.success, right.success);
    pushIfChanged('observedValue', left.observedValue, right.observedValue);
    pushIfChanged('latencyMs', left.latencyMs, right.latencyMs);
    pushIfChanged('error', left.error, right.error);

    const isFunctionallyChanged =
      left.outcome !== right.outcome ||
      left.success !== right.success ||
      left.observedValue !== right.observedValue ||
      left.error !== right.error;

    return {
      method,
      status: isFunctionallyChanged ? 'changed' : 'unchanged',
      a: left,
      b: right,
      fieldChanges,
      latencyDelta: compareLatency(left.latencyMs, right.latencyMs),
    };
  });
}

/**
 * Numeric latency delta, only when both measurements are valid finite numbers.
 * No thresholds and no claims about significance: a raw difference or nothing.
 */
export function compareLatency(
  latencyA: number | null,
  latencyB: number | null
): LatencyDelta {
  const aMissing = latencyA === null || latencyA === undefined;
  const bMissing = latencyB === null || latencyB === undefined;

  if (aMissing && bMissing) return { status: 'missing_in_both', value: null };
  if (aMissing) return { status: 'missing_in_a', value: null };
  if (bMissing) return { status: 'missing_in_b', value: null };

  if (!Number.isFinite(latencyA) || !Number.isFinite(latencyB)) {
    return { status: 'invalid', value: null };
  }

  return { status: 'available', value: latencyB - latencyA };
}

/** Collapse whitespace so evidence that differs only by formatting still matches. */
function normalizeEvidence(evidence: string): string {
  return evidence.trim().replace(/\s+/g, ' ');
}

function indexFindings(findings: Finding[]): Map<string, { finding: Finding; duplicates: number }> {
  const seen = new Map<string, number>();
  const index = new Map<string, { finding: Finding; duplicates: number }>();

  for (const finding of findings) {
    const base = `${finding.ruleId}::${normalizeEvidence(finding.evidence)}`;
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);

    const key = occurrence === 0 ? base : `${base}#${occurrence}`;
    // Deterministic for duplicate ruleId+evidence pairs: occurrence order is array order.
    index.set(key, { finding, duplicates: occurrence });
  }

  return index;
}

function compareFindings(
  a: HealthCheckSnapshot,
  b: HealthCheckSnapshot
): ComparedFinding[] {
  const findingsA = indexFindings(a.findings);
  const findingsB = indexFindings(b.findings);
  const keys = Array.from(new Set([...findingsA.keys(), ...findingsB.keys()])).sort();

  return keys.map((key): ComparedFinding => {
    const entryA = findingsA.get(key);
    const entryB = findingsB.get(key);
    const ruleId = (entryB?.finding ?? (entryA as { finding: Finding }).finding).ruleId;

    if (entryA && !entryB) {
      return {
        key,
        ruleId,
        status: 'resolved_finding',
        a: entryA.finding,
        b: null,
        fieldChanges: [],
      };
    }
    if (!entryA && entryB) {
      return {
        key,
        ruleId,
        status: 'new_finding',
        a: null,
        b: entryB.finding,
        fieldChanges: [],
      };
    }

    // Key (ruleId + normalized evidence) matched: classified as unchanged, with any
    // non-key field drift reported explicitly so callers are not misled.
    const left = (entryA as { finding: Finding }).finding;
    const right = (entryB as { finding: Finding }).finding;
    const fieldChanges: FindingFieldChange[] = [];

    if (left.severity !== right.severity) {
      fieldChanges.push({ field: 'severity', a: left.severity, b: right.severity });
    }
    if (left.title !== right.title) {
      fieldChanges.push({ field: 'title', a: left.title, b: right.title });
    }
    if (left.explanation !== right.explanation) {
      fieldChanges.push({ field: 'explanation', a: left.explanation, b: right.explanation });
    }
    if (left.recommendation !== right.recommendation) {
      fieldChanges.push({ field: 'recommendation', a: left.recommendation, b: right.recommendation });
    }

    return {
      key,
      ruleId,
      status: 'unchanged_finding',
      a: left,
      b: right,
      fieldChanges,
    };
  });
}

/**
 * Parse an observed block-height value without precision loss.
 *
 * Supported representations (the ones the runner actually produces):
 * - `0x`-prefixed hexadecimal string (EVM `eth_blockNumber`, Substrate header `number`)
 * - a number that is a safe integer
 *
 * Anything else returns null. Arbitrary strings are never parsed as numbers.
 */
export function parseBlockHeight(value: string | number | null): bigint | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? BigInt(value) : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^0[xX][0-9a-fA-F]+$/.test(trimmed)) return null;
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

function compareBlockHeight(
  a: HealthCheckSnapshot,
  b: HealthCheckSnapshot,
  comparable: boolean
): BlockHeightDelta {
  if (!comparable) {
    return {
      status: 'unavailable_incompatible_snapshots',
      method: null,
      delta: null,
      a: null,
      b: null,
    };
  }

  const method = BLOCK_HEIGHT_METHOD[a.endpointProfile];
  const checkA = a.checks.find((c) => c.method === method) ?? null;
  const checkB = b.checks.find((c) => c.method === method) ?? null;

  if (!checkA || !checkB) {
    return { status: 'unavailable_missing_check', method, delta: null, a: null, b: null };
  }

  const heightA = parseBlockHeight(checkA.observedValue);
  const heightB = parseBlockHeight(checkB.observedValue);

  if (heightA === null || heightB === null) {
    return { status: 'unavailable_unsupported_representation', method, delta: null, a: null, b: null };
  }

  return {
    status: 'available',
    method,
    delta: (heightB - heightA).toString(),
    a: heightA.toString(),
    b: heightB.toString(),
  };
}

/**
 * Compare two health-check snapshots.
 *
 * Never mutates `a` or `b`; the returned entries hold references to the original
 * check and finding objects so callers can inspect the source data as recorded.
 */
export function compareSnapshots(
  a: HealthCheckSnapshot,
  b: HealthCheckSnapshot
): SnapshotComparison {
  const incompatibilityReason = buildIncompatibilityReason(a, b);
  const comparable = incompatibilityReason === null;

  return {
    mode: comparable ? 'like_for_like' : 'cross_endpoint',
    comparable,
    incompatibilityReason,
    a: toMetadata(a),
    b: toMetadata(b),
    checks: compareChecks(a, b),
    findings: compareFindings(a, b),
    blockHeightDelta: compareBlockHeight(a, b, comparable),
  };
}

/**
 * `unsupported_method` is the only outcome that means "this node does not implement the
 * method"; every other non-success outcome is an actual failure. Exposed so callers and
 * tests share one definition instead of re-deriving it.
 */
export function isRealFailure(outcome: HealthCheckOutcome): boolean {
  return (
    outcome === 'rpc_error' ||
    outcome === 'network_error' ||
    outcome === 'http_error' ||
    outcome === 'invalid_response'
  );
}

export function isUnsupportedMethod(outcome: HealthCheckOutcome): boolean {
  return outcome === 'unsupported_method';
}