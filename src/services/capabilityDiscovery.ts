import { sendJsonRpcRequest } from './rpcClient';
import { sanitizeEndpointOrigin } from '../utils/reportBuilder';
import type { CapabilitySnapshot, DiscoveryStatus } from '../types/capability';

const MAX_METHODS_PROCESSED = 400;

const SAFE_METHOD_ALLOWLIST = new Set<string>([
  'rpc_methods',
  'system_health',
  'system_syncState',
  'system_nodeRoles',
  'system_chain',
  'system_chainType',
  'system_properties',
  'system_version',
  'chain_getHeader',
  'chain_getBlock',
  'eth_chainId',
  'eth_blockNumber',
  'eth_syncing',
  'net_version',
  'web3_clientVersion',
]);

const UNSAFE_PREFIXES = ['author_', 'state_', 'eth_send', 'eth_sign', 'personal_'];

function isSafeAdvertisedMethod(method: string): boolean {
  if (!SAFE_METHOD_ALLOWLIST.has(method)) return false;
  return !UNSAFE_PREFIXES.some((prefix) => method.startsWith(prefix));
}

function isMethodNotFoundError(resultError: { code: number; message: string } | undefined, errorText: string | null): boolean {
  if (resultError?.code === -32601) return true;
  const msg = (resultError?.message || errorText || '').toLowerCase();
  return msg.includes('method not found');
}

function isTransportError(errorText: string | null): boolean {
  if (!errorText) return false;
  const lower = errorText.toLowerCase();
  return (
    lower.includes('network') ||
    lower.includes('cors') ||
    lower.includes('failed to fetch') ||
    lower.includes('http error') ||
    lower.includes('timeout')
  );
}

function sanitizeMethodName(entry: unknown): string | null {
  if (typeof entry !== 'string') return null;
  const trimmed = entry.trim();
  if (!trimmed) return null;
  if (trimmed.length > 80) return null;
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return null;
  return trimmed;
}

function parseRpcMethodsResult(rawResult: unknown): { methods: string[] } | { invalid: true } {
  let rawList: unknown = null;

  if (Array.isArray(rawResult)) {
    rawList = rawResult;
  } else if (
    rawResult !== null &&
    typeof rawResult === 'object' &&
    'methods' in (rawResult as Record<string, unknown>) &&
    Array.isArray((rawResult as Record<string, unknown>).methods)
  ) {
    rawList = (rawResult as Record<string, unknown>).methods;
  } else {
    return { invalid: true };
  }

  const arr = rawList as unknown[];
  const capped = arr.slice(0, MAX_METHODS_PROCESSED);
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const entry of capped) {
    const sanitized = sanitizeMethodName(entry);
    if (!sanitized) continue;
    if (seen.has(sanitized)) continue;
    seen.add(sanitized);
    cleaned.push(sanitized);
  }

  return { methods: cleaned };
}

function classifyDiscoveryStatus(
  transportSuccess: boolean,
  rpcError: { code: number; message: string } | undefined,
  errorText: string | null,
  parseOk: boolean
): DiscoveryStatus {
  if (transportSuccess && parseOk) return 'success';
  if (!transportSuccess) {
    if (isMethodNotFoundError(rpcError, errorText)) return 'unsupported_method';
    if (isTransportError(errorText)) return 'transport_error';
    if (rpcError) return 'invalid_response';
    if (errorText && errorText.toLowerCase().includes('invalid json')) return 'invalid_response';
    return 'invalid_response';
  }
  return 'invalid_response';
}

export async function discoverCapabilities(endpoint: string): Promise<CapabilitySnapshot> {
  const endpointOrigin = sanitizeEndpointOrigin(endpoint);
  const result = await sendJsonRpcRequest(endpoint, 'rpc_methods', [], 8000);

  if (result.success && result.response) {
    const parsed = parseRpcMethodsResult(result.response.result);
    if ('invalid' in parsed) {
      return {
        endpointOrigin,
        discoveredAt: new Date().toISOString(),
        discoveryStatus: 'invalid_response',
        safeAdvertisedMethods: [],
        rawMethodCount: 0,
        latencyMs: result.latency,
        error: 'rpc_methods returned an unexpected shape',
      };
    }

    const safeAdvertised = parsed.methods
      .filter(isSafeAdvertisedMethod)
      .map((method) => ({ method, evidence: 'advertised' as const }));

    return {
      endpointOrigin,
      discoveredAt: new Date().toISOString(),
      discoveryStatus: 'success',
      safeAdvertisedMethods: safeAdvertised,
      rawMethodCount: parsed.methods.length,
      latencyMs: result.latency,
      error: null,
    };
  }

  const rpcError = result.response?.error;
  const errorText = result.error;
  const discoveryStatus = classifyDiscoveryStatus(false, rpcError, errorText, false);

  return {
    endpointOrigin,
    discoveredAt: new Date().toISOString(),
    discoveryStatus,
    safeAdvertisedMethods: [],
    rawMethodCount: 0,
    latencyMs: result.latency,
    error: errorText || (rpcError ? `JSON-RPC Error [${rpcError.code}]: ${rpcError.message}` : 'Discovery failed'),
  };
}

export const __testOnly = {
  MAX_METHODS_PROCESSED,
  SAFE_METHOD_ALLOWLIST,
  sanitizeMethodName,
  parseRpcMethodsResult,
  isSafeAdvertisedMethod,
  isMethodNotFoundError,
  isTransportError,
};
