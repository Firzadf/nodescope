import type { EvmConnectionDetails } from '../types/endpoint';
import type { Finding } from '../types/diagnostic';
import type { DiagnosticHistoryItem, RpcDiagnosticResult } from '../types/rpc';
import type { ChainIdValidationResult } from '../utils/chainIdValidator';
import {
  validatePortaldotV3ChainId,
  PORTALDOT_V3_TESTNET_CHAIN_ID,
  PORTALDOT_V3_TESTNET_CHAIN_ID_HEX,
} from '../utils/chainIdValidator';

export interface DiagnosticRuleConfig {
  latencyThresholdMs?: number;
}

function createFinding(
  ruleId: string,
  severity: Finding['severity'],
  title: string,
  evidence: string,
  explanation: string,
  recommendation: string
): Finding {
  return { ruleId, severity, title, evidence, explanation, recommendation };
}

function hasResult(response: RpcDiagnosticResult['response']): boolean {
  return response !== null && Object.prototype.hasOwnProperty.call(response, 'result');
}

function isNetworkError(error: string): boolean {
  const normalized = error.toLowerCase();
  return (
    normalized.includes('network') ||
    normalized.includes('cors') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('timeout')
  );
}

function isHttpError(error: string): boolean {
  return error.toLowerCase().includes('http error');
}

function isMalformedResponseError(error: string): boolean {
  const normalized = error.toLowerCase();
  return (
    normalized.includes('invalid json') ||
    normalized.includes('malformed') ||
    normalized.includes('failed to read response body')
  );
}

export function evaluateNetworkFailure(result: RpcDiagnosticResult): Finding | null {
  if (result.success || !result.error) return null;

  if (isNetworkError(result.error)) {
    return createFinding(
      'network-failure',
      'error',
      'Network Error',
      `Network request failed: ${result.error}`,
      'The endpoint was unreachable or the request timed out.',
      'Verify the endpoint URL is accessible, the network connection is stable, and CORS is configured if calling from a browser.'
    );
  }

  if (isHttpError(result.error)) {
    return createFinding(
      'http-error',
      'error',
      'HTTP Error',
      `HTTP request failed: ${result.error}`,
      'The endpoint returned an HTTP error before a JSON-RPC response could be evaluated.',
      'Check the endpoint URL and verify that the server accepts JSON-RPC POST requests.'
    );
  }

  return null;
}

export function evaluateJsonRpcError(result: RpcDiagnosticResult, method: string): Finding | null {
  if (result.success || !result.response?.error) return null;

  const { code, message } = result.response.error;

  if (code === -32601) {
    return createFinding(
      'method-unsupported-on-endpoint',
      'warning',
      'Method Not Supported on This Endpoint',
      `Method '${method}' returned JSON-RPC error -32601: ${message}`,
      `The tested endpoint did not expose '${method}'. This observed endpoint behavior does not establish whether the underlying node supports the method through another interface.`,
      `Use an endpoint that exposes '${method}', or select a compatible endpoint profile for this method.`
    );
  }

  return createFinding(
    'rpc-error',
    'error',
    'JSON-RPC Error',
    `Method '${method}' returned JSON-RPC error [${code}]: ${message}`,
    'The RPC method returned a protocol-level error from the endpoint.',
    'Verify the method is supported, the parameters are correct, and the endpoint is functioning.'
  );
}

export function evaluateInvalidResponse(result: RpcDiagnosticResult, method: string): Finding | null {
  if (result.response?.error) return null;

  if (!result.success && result.error && isMalformedResponseError(result.error)) {
    return createFinding(
      'malformed-response',
      'error',
      'Malformed JSON-RPC Response',
      `Method '${method}' response could not be parsed: ${result.error}`,
      'The endpoint did not return valid JSON-RPC 2.0 data.',
      'Verify the endpoint returns a JSON-RPC 2.0 response with a result or error field.'
    );
  }

  if (!result.response) {
    if (result.success) {
      return createFinding(
        'invalid-response',
        'error',
        'Missing JSON-RPC Response',
        `Method '${method}' was marked successful but returned no response body`,
        'The request result is internally inconsistent and cannot be treated as a valid JSON-RPC response.',
        'Retry the request and verify the endpoint response handling.'
      );
    }

    if (!result.error) {
      return createFinding(
        'invalid-response',
        'error',
        'No Response from Endpoint',
        `Method '${method}' returned no response body`,
        'The endpoint did not return a valid JSON-RPC response.',
        'Check the endpoint URL and verify it is a valid JSON-RPC endpoint.'
      );
    }

    return null;
  }

  if (!hasResult(result.response)) {
    return createFinding(
      'malformed-response',
      'error',
      'Malformed JSON-RPC Response',
      `Method '${method}' returned a response without a result or error field`,
      'The response does not contain the JSON-RPC 2.0 payload field required for this outcome.',
      'Verify the endpoint implements JSON-RPC 2.0 correctly.'
    );
  }

  return null;
}

export function evaluateChainIdMatch(validation: ChainIdValidationResult | null): Finding | null {
  if (!validation) return null;

  if (validation.chainId !== null && !validation.isPortaldotV3Testnet) {
    return createFinding(
      'chain-id-mismatch',
      'error',
      'Chain ID Mismatch',
      `Observed chain ID: ${validation.chainId} (${validation.chainIdHex ?? 'hex value unavailable'}); expected: ${PORTALDOT_V3_TESTNET_CHAIN_ID} (${PORTALDOT_V3_TESTNET_CHAIN_ID_HEX})`,
      'The endpoint reports a different chain ID than expected for Portaldot V3 testnet.',
      'Check the endpoint and network configuration, then connect to the intended Portaldot V3 EVM network.'
    );
  }

  if (validation.error) {
    return createFinding(
      'chain-id-invalid-response',
      'warning',
      'Invalid Chain ID Response',
      `Chain ID validation failed: ${validation.error}`,
      'The eth_chainId response could not be parsed or validated.',
      'Verify the endpoint supports eth_chainId and returns a valid hexadecimal chain ID.'
    );
  }

  if (!validation.isPortaldotV3Testnet) return null;

  return createFinding(
    'chain-id-verified',
    'info',
    'Chain ID Observed',
    `Observed chain ID: ${PORTALDOT_V3_TESTNET_CHAIN_ID} (${PORTALDOT_V3_TESTNET_CHAIN_ID_HEX}); expected: ${PORTALDOT_V3_TESTNET_CHAIN_ID} (${PORTALDOT_V3_TESTNET_CHAIN_ID_HEX})`,
    'The endpoint reports the expected Portaldot V3 testnet chain ID.',
    'Chain ID check passed. Continue with independent endpoint and block-height checks.'
  );
}

export function evaluateBlockHeight(result: RpcDiagnosticResult, method: string): Finding | null {
  if (!result.success || !result.response || result.response.error) return null;
  if (method !== 'eth_blockNumber' && method !== 'chain_getBlock' && method !== 'chain_getHeader') return null;
  if (!hasResult(result.response)) return null;

  const blockResult = result.response.result;
  if (typeof blockResult !== 'string' && typeof blockResult !== 'number') return null;

  return createFinding(
    'block-height-retrieved',
    'info',
    'Block Height Retrieved',
    `Method '${method}' returned block height: ${String(blockResult)}`,
    `The ${method} method returned a block height from the endpoint. This confirms retrieval only; one measurement does not prove synchronization or continued block production.`,
    'Repeat the check over time to determine whether block height advances.'
  );
}

export function evaluateLatencyThreshold(
  result: RpcDiagnosticResult,
  config: DiagnosticRuleConfig
): Finding | null {
  const threshold = config.latencyThresholdMs;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0) return null;
  if (result.latency === null || !Number.isFinite(result.latency)) return null;
  if (result.latency <= threshold) return null;

  return createFinding(
    'latency-exceeds-threshold',
    'warning',
    'High Latency',
    `Measured latency: ${result.latency}ms; configured threshold: ${threshold}ms`,
    'The RPC response time exceeded the explicitly configured threshold.',
    'Monitor endpoint performance and investigate network conditions or endpoint load if high latency persists.'
  );
}

/**
 * Evaluates one result using precedence that prevents missing-response duplicates:
 * transport failures, protocol errors, malformed responses, then successful checks.
 */
export function evaluateDiagnosticResult(
  result: RpcDiagnosticResult,
  config: DiagnosticRuleConfig = {}
): Finding | null {
  const method = result.request.method;
  const networkFailure = evaluateNetworkFailure(result);
  if (networkFailure) return networkFailure;

  const rpcError = evaluateJsonRpcError(result, method);
  if (rpcError) return rpcError;

  const invalidResponse = evaluateInvalidResponse(result, method);
  if (invalidResponse) return invalidResponse;

  if (result.success) {
    const blockHeight = evaluateBlockHeight(result, method);
    if (blockHeight) return blockHeight;
    return evaluateLatencyThreshold(result, config);
  }

  return null;
}

export function evaluateChainIdValidation(
  chainIdResult: RpcDiagnosticResult | null,
  validation: ChainIdValidationResult | null,
  config: DiagnosticRuleConfig = {}
): Finding | null {
  if (chainIdResult && !chainIdResult.success) {
    const requestFinding = evaluateDiagnosticResult(chainIdResult, config);
    if (requestFinding) return requestFinding;
  }

  const chainFinding = evaluateChainIdMatch(validation);
  if (chainFinding) return chainFinding;
  return chainIdResult ? evaluateLatencyThreshold(chainIdResult, config) : null;
}

function addUniqueFinding(findings: Finding[], finding: Finding | null): void {
  if (!finding) return;
  const duplicate = findings.some(
    (existing) => existing.ruleId === finding.ruleId && existing.evidence === finding.evidence
  );
  if (!duplicate) findings.push(finding);
}

export function evaluateEvmConnectionFindings(
  details: EvmConnectionDetails,
  config: DiagnosticRuleConfig = {}
): Finding[] {
  const findings: Finding[] = [];
  addUniqueFinding(findings, evaluateChainIdValidation(details.chainIdResult, details.validation, config));
  addUniqueFinding(findings, evaluateDiagnosticResult(details.blockResult, config));
  addUniqueFinding(findings, evaluateLatencyThreshold(details.blockResult, config));
  return findings;
}

export function evaluateHistoryFindings(
  history: DiagnosticHistoryItem[],
  config: DiagnosticRuleConfig = {}
): Finding[] {
  // Track latest finding per (ruleId + endpoint) to avoid repeated block-height findings
  // while preserving all raw records in the export.
  const latest: Map<string, { finding: Finding; timestamp: number }> = new Map();

  history.forEach((item) => {
    const primary = item.request.method === 'eth_chainId'
      ? evaluateChainIdValidation(item, validatePortaldotV3ChainId(item), config)
      : evaluateDiagnosticResult(item, config);

    if (primary) {
      const key = `${primary.ruleId}:${item.endpoint}`;
      const existing = latest.get(key);
      // Keep finding with later timestamp (or first if timestamps equal, maintaining determinism)
      if (!existing || item.timestamp > existing.timestamp) {
        latest.set(key, { finding: primary, timestamp: item.timestamp });
      }
    }

    // Latency is independent evidence, so retain it alongside a successful block/chain check.
    const latencyFinding = evaluateLatencyThreshold(item, config);
    if (latencyFinding) {
      const key = `${latencyFinding.ruleId}:${item.endpoint}`;
      const existing = latest.get(key);
      if (!existing || item.timestamp > existing.timestamp) {
        latest.set(key, { finding: latencyFinding, timestamp: item.timestamp });
      }
    }
  });

  return Array.from(latest.values()).map(x => x.finding);
}

export function deduplicateFindings(findings: Finding[]): Finding[] {
  // Remove exact duplicates (same ruleId + evidence).
  // evaluateHistoryFindings already de-duplicates by endpoint, so this is a safety net.
  const seen: Map<string, Finding> = new Map();
  findings.forEach((f) => {
    const key = `${f.ruleId}:${f.evidence}`;
    if (!seen.has(key)) {
      seen.set(key, f);
    }
  });
  return Array.from(seen.values());
}
