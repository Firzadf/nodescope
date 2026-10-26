import type { RpcDiagnosticResult } from '../types/rpc';
import type { HealthCheckCheck } from '../types/healthCheck';
import type { MetricItem } from '../types/node';

function classifyFailure(res: RpcDiagnosticResult): { status: 'unsupported_method' | 'network_error' | 'invalid_response'; error: string } {
  const errMsg = res.error || 'Unknown error';

  if (res.response?.error) {
    const code = res.response.error.code;
    const msg = res.response.error.message || '';
    // JSON-RPC standard -32601 is Method not found
    if (code === -32601 || msg.toLowerCase().includes('method not found')) {
      return {
        status: 'unsupported_method',
        error: `Method unsupported by node (code ${code}): ${msg}`,
      };
    }
    return {
      status: 'invalid_response',
      error: `RPC Error (code ${code}): ${msg}`,
    };
  }

  if (errMsg.includes('Network') || errMsg.includes('CORS') || errMsg.includes('HTTP Error') || errMsg.includes('timeout') || errMsg.includes('Failed to fetch')) {
    return {
      status: 'network_error',
      error: errMsg,
    };
  }

  return {
    status: 'invalid_response',
    error: errMsg,
  };
}

export function parseLatency(res: RpcDiagnosticResult | null): MetricItem<number> {
  if (!res) {
    return { status: 'not_tested', value: null };
  }

  if (res.latency !== null && res.latency >= 0) {
    return {
      status: 'success',
      value: res.latency,
      sourceMethod: res.request.method,
      timestamp: res.timestamp,
    };
  }

  const failure = classifyFailure(res);
  return {
    status: failure.status,
    value: null,
    error: failure.error,
    sourceMethod: res.request.method,
    timestamp: res.timestamp,
  };
}

export function parseClientVersion(res: RpcDiagnosticResult | null): MetricItem<string> {
  if (!res) {
    return { status: 'not_tested', value: null };
  }

  if (res.success && res.response) {
    const val = res.response.result;
    if (typeof val === 'string' && val.trim().length > 0) {
      return {
        status: 'success',
        value: val.trim(),
        sourceMethod: res.request.method,
        timestamp: res.timestamp,
      };
    }
    return {
      status: 'invalid_response',
      value: null,
      error: 'Unexpected response format: result is not a non-empty string',
      sourceMethod: res.request.method,
      timestamp: res.timestamp,
    };
  }

  const failure = classifyFailure(res);
  return {
    status: failure.status,
    value: null,
    error: failure.error,
    sourceMethod: res.request.method,
    timestamp: res.timestamp,
  };
}

export function parsePeerCount(res: RpcDiagnosticResult | null): MetricItem<number> {
  if (!res) {
    return { status: 'not_tested', value: null };
  }

  if (res.success && res.response) {
    const val = res.response.result;
    if (typeof val === 'string' && /^0x[0-9a-fA-F]+$/.test(val)) {
      const parsed = parseInt(val, 16);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return {
          status: 'success',
          value: parsed,
          sourceMethod: res.request.method,
          timestamp: res.timestamp,
        };
      }
    }
    if (typeof val === 'object' && val !== null && 'peers' in val) {
      const peersVal = (val as Record<string, unknown>).peers;
      if (typeof peersVal === 'number' && Number.isFinite(peersVal) && peersVal >= 0) {
        return {
          status: 'success',
          value: peersVal,
          sourceMethod: res.request.method,
          timestamp: res.timestamp,
        };
      }
    }
    return {
      status: 'invalid_response',
      value: null,
      error: 'Health payload missing or invalid "peers" numeric field',
      sourceMethod: res.request.method,
      timestamp: res.timestamp,
    };
  }

  const failure = classifyFailure(res);
  return {
    status: failure.status,
    value: null,
    error: failure.error,
    sourceMethod: res.request.method,
    timestamp: res.timestamp,
  };
}

export function parseBlockHeight(res: RpcDiagnosticResult | null): MetricItem<number | string> {
  if (!res) {
    return { status: 'not_tested', value: null };
  }

  if (res.success && res.response) {
    const val = res.response.result;

    // Substrate chain_getHeader returns object with 'number' field (hex or number)
    if (typeof val === 'object' && val !== null && 'number' in val) {
      const numField = (val as Record<string, unknown>).number;
      if (typeof numField === 'string') {
        const parsed = numField.startsWith('0x') ? parseInt(numField, 16) : parseInt(numField, 10);
        if (!Number.isNaN(parsed)) {
          return {
            status: 'success',
            value: parsed,
            sourceMethod: res.request.method,
            timestamp: res.timestamp,
          };
        }
      } else if (typeof numField === 'number' && Number.isFinite(numField)) {
        return {
          status: 'success',
          value: numField,
          sourceMethod: res.request.method,
          timestamp: res.timestamp,
        };
      }
    }

    // Direct hex string like '0x1b4' or decimal number/string
    if (typeof val === 'string') {
      const parsed = val.startsWith('0x') ? parseInt(val, 16) : parseInt(val, 10);
      if (!Number.isNaN(parsed)) {
        return {
          status: 'success',
          value: parsed,
          sourceMethod: res.request.method,
          timestamp: res.timestamp,
        };
      }
      return {
        status: 'success',
        value: val,
        sourceMethod: res.request.method,
        timestamp: res.timestamp,
      };
    }

    if (typeof val === 'number' && Number.isFinite(val)) {
      return {
        status: 'success',
        value: val,
        sourceMethod: res.request.method,
        timestamp: res.timestamp,
      };
    }

    return {
      status: 'invalid_response',
      value: null,
      error: 'Unable to parse block height from response payload',
      sourceMethod: res.request.method,
      timestamp: res.timestamp,
    };
  }

  const failure = classifyFailure(res);
  return {
    status: failure.status,
    value: null,
    error: failure.error,
    sourceMethod: res.request.method,
    timestamp: res.timestamp,
  };
}

// Node Metrics values must come from results that actually ran. The
// inspector badge merges capability evidence, so without this a method
// seen succeeding before showed "Success" while its value stayed "—".
// These mirror parseLatency/parseClientVersion for health-check snapshots,
// whose checks carry latencyMs + observedValue instead of a full result.
// A successful check with no usable value returns null so the caller
// leaves the previous metric untouched rather than inventing one.
export function latencyFromCheck(check: HealthCheckCheck | undefined, timestamp: number): MetricItem<number> | null {
  if (!check) return null;
  if (check.success) {
    return check.latencyMs !== null
      ? { status: 'success', value: check.latencyMs, sourceMethod: check.method, timestamp }
      : null;
  }
  const status = check.outcome === 'unsupported_method' ? 'unsupported_method' : check.outcome === 'network_error' ? 'network_error' : 'invalid_response';
  return { status, value: null, error: check.error ?? undefined, sourceMethod: check.method, timestamp };
}

export function versionFromCheck(check: HealthCheckCheck | undefined, timestamp: number): MetricItem<string> | null {
  if (!check) return null;
  if (check.success) {
    return typeof check.observedValue === 'string' && check.observedValue.trim().length > 0
      ? { status: 'success', value: check.observedValue, sourceMethod: check.method, timestamp }
      : null;
  }
  const status = check.outcome === 'unsupported_method' ? 'unsupported_method' : check.outcome === 'network_error' ? 'network_error' : 'invalid_response';
  return { status, value: null, error: check.error ?? undefined, sourceMethod: check.method, timestamp };
}
