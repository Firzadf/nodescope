import {
  HEALTH_SNAPSHOT_SCHEMA_VERSION,
  type HealthCheckSnapshot,
  type HealthCheckCheck,
} from '../types/healthCheck';
import type { Finding } from '../types/diagnostic';

const HEALTH_SNAPSHOTS_STORAGE_KEY = 'nodescope_health_snapshots_v1';
const MAX_SNAPSHOTS = 20;

function isValidCheck(check: unknown): check is HealthCheckCheck {
  if (!check || typeof check !== 'object') return false;
  const c = check as Record<string, unknown>;
  const validOutcomes = [
    'success',
    'unsupported_method',
    'rpc_error',
    'network_error',
    'http_error',
    'invalid_response',
  ];
  return (
    typeof c.method === 'string' &&
    typeof c.success === 'boolean' &&
    validOutcomes.includes(c.outcome as string) &&
    (c.latencyMs === null || typeof c.latencyMs === 'number') &&
    (c.observedValue === null || typeof c.observedValue === 'string' || typeof c.observedValue === 'number') &&
    (c.error === null || typeof c.error === 'string')
  );
}

function isValidFinding(finding: unknown): finding is Finding {
  if (!finding || typeof finding !== 'object') return false;
  const f = finding as Record<string, unknown>;
  const validSeverities = ['info', 'warning', 'error'];
  return (
    typeof f.ruleId === 'string' &&
    validSeverities.includes(f.severity as string) &&
    typeof f.title === 'string' &&
    typeof f.evidence === 'string' &&
    typeof f.explanation === 'string' &&
    typeof f.recommendation === 'string'
  );
}

export function isValidHealthSnapshot(item: unknown): item is HealthCheckSnapshot {
  if (!item || typeof item !== 'object') return false;
  const s = item as Record<string, unknown>;
  if (s.schemaVersion !== HEALTH_SNAPSHOT_SCHEMA_VERSION) return false;
  if (typeof s.id !== 'string' || typeof s.timestamp !== 'number') return false;
  if (typeof s.exportedAt !== 'string' || typeof s.endpointOrigin !== 'string') return false;
  if (s.endpointProfile !== 'portaldot_v3_evm' && s.endpointProfile !== 'generic_http') return false;
  if (!Array.isArray(s.checks) || !s.checks.every(isValidCheck)) return false;
  if (!Array.isArray(s.findings) || !s.findings.every(isValidFinding)) return false;
  return true;
}

export function getHealthSnapshots(): HealthCheckSnapshot[] {
  try {
    const raw = sessionStorage.getItem(HEALTH_SNAPSHOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidHealthSnapshot);
  } catch (err) {
    console.error('Failed to read health snapshots from sessionStorage:', err);
    return [];
  }
}

export function saveHealthSnapshot(snapshot: HealthCheckSnapshot): HealthCheckSnapshot[] {
  try {
    if (!isValidHealthSnapshot(snapshot)) {
      return getHealthSnapshots();
    }
    const current = getHealthSnapshots();
    const updated = [snapshot, ...current.filter((s) => s.id !== snapshot.id)].slice(0, MAX_SNAPSHOTS);
    sessionStorage.setItem(HEALTH_SNAPSHOTS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save health snapshot to sessionStorage:', err);
    return [];
  }
}

export function clearHealthSnapshots(): void {
  try {
    sessionStorage.removeItem(HEALTH_SNAPSHOTS_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear health snapshots from sessionStorage:', err);
  }
}
