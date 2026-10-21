import type { EndpointProfile } from './endpoint';
import type { Finding } from './diagnostic';

export const HEALTH_SNAPSHOT_SCHEMA_VERSION = 'nodescope.health-snapshot.v1';

export type HealthCheckOutcome =
  | 'success'
  | 'unsupported_method'
  | 'rpc_error'
  | 'network_error'
  | 'http_error'
  | 'invalid_response';

export interface HealthCheckCheck {
  method: string;
  outcome: HealthCheckOutcome;
  success: boolean;
  latencyMs: number | null;
  observedValue: string | number | null;
  error: string | null;
}

export interface HealthCheckSnapshot {
  schemaVersion: typeof HEALTH_SNAPSHOT_SCHEMA_VERSION;
  id: string;
  timestamp: number;
  exportedAt: string;
  endpointOrigin: string;
  endpointProfile: EndpointProfile;
  checks: HealthCheckCheck[];
  findings: Finding[];
}
