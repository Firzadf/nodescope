import {
  REPORT_SCHEMA_VERSION,
  type DiagnosticReportExport,
  type ReportIntegrity,
} from './reportBuilder';

/**
 * Report integrity (stage 2): SHA-256 stamping and verification for
 * `nodescope.diagnostic-report.v1` exports.
 *
 * Design rules (blueprint: agent_notes/report-verification-blueprint.md):
 * - Pure and deterministic: canonicalization depends only on the parsed value,
 *   never on key insertion order or raw file text. A report whose keys were
 *   reordered by a JSON formatter still verifies; any value change does not.
 * - The hash covers the whole report EXCLUDING the root `integrity` block, so
 *   re-stamping a stamped report recomputes cleanly — a hash is never hashed.
 * - A stamp is tamper EVIDENCE, not authenticity: verification proves a file
 *   matches the stamp computed at export, never that the node data was true.
 */

export const INTEGRITY_SCOPE =
  'SHA-256 over the canonical JSON of this report, excluding the integrity block itself. ' +
  'Covers schemaVersion, exportedAt, recordCount, records, and findings, sessionTrends, substrateWsProbe, healthScore, and operatorSignals when present.';

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Canonical text form of any JSON-shaped value:
 * - object keys sorted by UTF-16 code-unit order, `undefined` values dropped;
 * - array order preserved;
 * - numbers exactly as `JSON.stringify` renders them, non-finite → `null`;
 * - strings via `JSON.stringify` (deterministic escaping).
 */
export function canonicalizeValue(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return Number.isFinite(value) ? JSON.stringify(value) : 'null';
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalizeValue(item)).join(',')}]`;
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort();
      const pairs = keys.map((key) => `${JSON.stringify(key)}:${canonicalizeValue(record[key])}`);
      return `{${pairs.join(',')}}`;
    }
    default:
      // undefined / function / symbol — unreachable for JSON.parse output.
      return 'null';
  }
}

/** Shallow copy of a report-shaped object with the root `integrity` key removed. */
export function withoutIntegrity(report: unknown): Record<string, unknown> {
  if (!isPlainObject(report)) return {};
  const copy: Record<string, unknown> = { ...report };
  delete copy.integrity;
  return copy;
}

/** Canonical form of a report: its canonical value with the root `integrity` excluded. */
export function canonicalizeReport(report: unknown): string {
  return canonicalizeValue(withoutIntegrity(report));
}

/** SHA-256 of the UTF-8 encoding of `text`, as lowercase hex. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Stamp a report with its integrity block. Returns a NEW object; the input is
 * never mutated. An existing stamp is stripped first (never hash a hash), so
 * re-exporting a stamped report recomputes over the content alone.
 */
export async function stampReportIntegrity(
  report: DiagnosticReportExport
): Promise<DiagnosticReportExport> {
  const unsigned = withoutIntegrity(report);
  const hash = await sha256Hex(canonicalizeValue(unsigned));
  const integrity: ReportIntegrity = { algorithm: 'SHA-256', hash, scope: INTEGRITY_SCOPE };
  return { ...(unsigned as unknown as DiagnosticReportExport), integrity };
}

export type ReportVerificationStatus =
  | 'verified'
  | 'mismatch'
  | 'no_integrity'
  | 'not_nodescope'
  | 'malformed';

export interface ReportVerification {
  status: ReportVerificationStatus;
  /** Plain-language explanation for the result banner. */
  detail: string;
  /** The parsed report, present whenever the file is NodeScope-shaped. */
  report?: DiagnosticReportExport;
  statedHash?: string;
  computedHash?: string;
}

/**
 * Verify an already-parsed value as a NodeScope report. Runs over the parsed
 * object, not raw text — key order in the file is irrelevant, values are not.
 */
export async function verifyReport(parsed: unknown): Promise<ReportVerification> {
  if (
    !isPlainObject(parsed) ||
    parsed.schemaVersion !== REPORT_SCHEMA_VERSION ||
    !Array.isArray(parsed.records) ||
    typeof parsed.recordCount !== 'number'
  ) {
    return {
      status: 'not_nodescope',
      detail: `This file is not a NodeScope diagnostic report (schema ${REPORT_SCHEMA_VERSION}).`,
    };
  }

  const report = parsed as unknown as DiagnosticReportExport;
  const integrity = parsed.integrity;

  if (integrity === undefined) {
    return {
      status: 'no_integrity',
      detail:
        'This is a NodeScope report without an integrity stamp. It predates integrity stamping, so its contents cannot be verified.',
      report,
    };
  }

  if (
    !isPlainObject(integrity) ||
    integrity.algorithm !== 'SHA-256' ||
    typeof integrity.hash !== 'string' ||
    !SHA256_HEX_PATTERN.test(integrity.hash)
  ) {
    return {
      status: 'no_integrity',
      detail:
        "This report's integrity stamp is malformed and cannot be checked, so its contents cannot be verified.",
      report,
    };
  }

  const statedHash = integrity.hash;
  const computedHash = await sha256Hex(canonicalizeReport(parsed));

  if (computedHash === statedHash) {
    return {
      status: 'verified',
      detail:
        'The contents of this file match the SHA-256 stamp computed when it was exported. Nothing in the covered content has been altered since export.',
      report,
      statedHash,
      computedHash,
    };
  }

  return {
    status: 'mismatch',
    detail:
      'This file was altered after export. Its contents no longer match the SHA-256 stamp its exporter computed — do not trust the contents below as exported evidence.',
    report,
    statedHash,
    computedHash,
  };
}

/** Verify raw file text: unparseable JSON is reported as MALFORMED, never thrown. */
export async function verifyReportText(text: string): Promise<ReportVerification> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      status: 'malformed',
      detail: 'This file is not valid JSON, so there is nothing to verify.',
    };
  }
  return verifyReport(parsed);
}
