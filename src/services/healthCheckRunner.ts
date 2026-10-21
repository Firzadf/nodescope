import type { EndpointProfile } from '../types/endpoint';
import {
  HEALTH_SNAPSHOT_SCHEMA_VERSION,
  type HealthCheckCheck,
  type HealthCheckSnapshot,
  type HealthCheckOutcome,
} from '../types/healthCheck';
import type { RpcDiagnosticResult } from '../types/rpc';
import type { Finding } from '../types/diagnostic';
import { sendJsonRpcRequest } from './rpcClient';
import { validatePortaldotV3ChainId } from '../utils/chainIdValidator';
import {
  evaluateChainIdValidation,
  evaluateDiagnosticResult,
  evaluateLatencyThreshold,
  deduplicateFindings,
} from './diagnosticRules';
import { sanitizeEndpointOrigin } from '../utils/reportBuilder';

export function methodsForProfile(profile: EndpointProfile): string[] {
  if (profile === 'portaldot_v3_evm') {
    return ['eth_chainId', 'eth_blockNumber', 'web3_clientVersion', 'net_version'];
  }
  return ['system_health', 'system_version', 'chain_getHeader', 'eth_chainId'];
}

export function classifyCheck(result: RpcDiagnosticResult): {
  outcome: HealthCheckOutcome;
  observedValue: string | number | null;
  error: string | null;
} {
  const errMsg = result.error || null;

  // Genuine -32601 Method not found
  if (result.response?.error?.code === -32601) {
    return {
      outcome: 'unsupported_method',
      observedValue: null,
      error: `JSON-RPC Error [-32601]: ${result.response.error.message}`,
    };
  }

  // Other JSON-RPC error
  if (result.response?.error) {
    return {
      outcome: 'rpc_error',
      observedValue: null,
      error: `JSON-RPC Error [${result.response.error.code}]: ${result.response.error.message}`,
    };
  }

  // Network / Transport / HTTP failures
  if (!result.success || !result.response) {
    const norm = (errMsg || '').toLowerCase();
    if (norm.includes('http error')) {
      return { outcome: 'http_error', observedValue: null, error: errMsg };
    }
    if (
      norm.includes('network') ||
      norm.includes('cors') ||
      norm.includes('timeout') ||
      norm.includes('failed to fetch')
    ) {
      return { outcome: 'network_error', observedValue: null, error: errMsg };
    }
    return { outcome: 'invalid_response', observedValue: null, error: errMsg || 'No valid response received' };
  }

  // Success with valid response
  const val = result.response.result;
  let observedValue: string | number | null = null;

  if (typeof val === 'string' || typeof val === 'number') {
    observedValue = val;
  } else if (typeof val === 'object' && val !== null) {
    const record = val as Record<string, unknown>;
    if (typeof record.peers === 'number') {
      observedValue = record.peers;
    } else if (typeof record.number === 'string' || typeof record.number === 'number') {
      observedValue = record.number;
    } else {
      observedValue = JSON.stringify(val).slice(0, 50);
    }
  }

  return {
    outcome: 'success',
    observedValue,
    error: null,
  };
}

export interface RunHealthCheckOptions {
  latencyThresholdMs?: number;
  timeoutMs?: number;
  onRecordResult?: (result: RpcDiagnosticResult) => void;
}

export async function runHealthCheck(
  endpoint: string,
  profile: EndpointProfile,
  options: RunHealthCheckOptions = {}
): Promise<HealthCheckSnapshot> {
  const normalizedEndpoint = sanitizeEndpointOrigin(endpoint);
  const methods = methodsForProfile(profile);
  const config = options.latencyThresholdMs !== undefined ? { latencyThresholdMs: options.latencyThresholdMs } : {};
  const timeoutMs = options.timeoutMs ?? 5000;

  const checks: HealthCheckCheck[] = [];
  const rawFindings: Finding[] = [];
  const seenMethods = new Set<string>();

  for (const method of methods) {
    if (seenMethods.has(method)) continue;
    seenMethods.add(method);

    const result = await sendJsonRpcRequest(endpoint, method, [], timeoutMs);

    if (options.onRecordResult) {
      options.onRecordResult(result);
    }

    const { outcome, observedValue, error } = classifyCheck(result);

    checks.push({
      method,
      outcome,
      success: outcome === 'success',
      latencyMs: result.latency,
      observedValue,
      error,
    });

    // Derive findings from actual evidence
    if (method === 'eth_chainId') {
      const validation = validatePortaldotV3ChainId(result);
      const chainFinding = evaluateChainIdValidation(result, validation, config);
      if (chainFinding) rawFindings.push(chainFinding);
    } else {
      const diagFinding = evaluateDiagnosticResult(result, config);
      if (diagFinding) rawFindings.push(diagFinding);
    }

    const latencyFinding = evaluateLatencyThreshold(result, config);
    if (latencyFinding) rawFindings.push(latencyFinding);
  }

  const findings = deduplicateFindings(rawFindings);
  const now = Date.now();

  return {
    schemaVersion: HEALTH_SNAPSHOT_SCHEMA_VERSION,
    id: `health-${now}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    exportedAt: new Date(now).toISOString(),
    endpointOrigin: normalizedEndpoint,
    endpointProfile: profile,
    checks,
    findings,
  };
}
