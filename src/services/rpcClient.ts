import type { JsonRpcRequest, JsonRpcResponse, RpcDiagnosticResult } from '../types/rpc';
import { validateRpcUrl } from '../utils/urlValidator';
import { paceRequest } from '../../shared/requestPace.mjs';

let requestIdCounter = 1;

export async function sendJsonRpcRequest(
  url: string,
  method: string,
  params: unknown[] = [],
  timeoutMs: number = 8000
): Promise<RpcDiagnosticResult> {
  const timestamp = Date.now();
  const validation = validateRpcUrl(url);

  if (!validation.isValid) {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: requestIdCounter++,
    };
    return {
      timestamp,
      request,
      response: null,
      latency: null,
      error: validation.error || 'Invalid URL',
      success: false,
    };
  }

  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    method,
    params,
    id: requestIdCounter++,
  };

  // Space starts on this origin before the timer, so the gap is not latency.
  await paceRequest(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const startTime = performance.now();

  try {
    const res = await fetch(url.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        timestamp,
        request,
        response: null,
        latency,
        error: `HTTP Error: ${res.status} ${res.statusText}`,
        success: false,
      };
    }

    let rawText: string;
    try {
      rawText = await res.text();
    } catch (textErr: unknown) {
      const msg = textErr instanceof Error ? textErr.message : String(textErr);
      return {
        timestamp,
        request,
        response: null,
        latency,
        error: `Failed to read response body: ${msg}`,
        success: false,
      };
    }

    let jsonResponse: JsonRpcResponse;
    try {
      jsonResponse = JSON.parse(rawText);
    } catch {
      return {
        timestamp,
        request,
        response: null,
        latency,
        error: `Invalid JSON response received from server: ${rawText.slice(0, 100)}`,
        success: false,
      };
    }

    if (jsonResponse.error) {
      return {
        timestamp,
        request,
        response: jsonResponse,
        latency,
        error: `JSON-RPC Error [${jsonResponse.error.code}]: ${jsonResponse.error.message}`,
        success: false,
      };
    }

    return {
      timestamp,
      request,
      response: jsonResponse,
      latency,
      error: null,
      success: true,
    };
  } catch (err: unknown) {
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === 'AbortError') {
      return {
        timestamp,
        request,
        response: null,
        latency: timeoutMs,
        error: `Request timeout after ${timeoutMs}ms`,
        success: false,
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    const isNetworkOrCors = message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('CORS');
    const errorDetails = isNetworkOrCors
      ? `Network or CORS Error: Could not connect to ${url}. Ensure the endpoint is reachable and allows browser CORS requests.`
      : message;

    return {
      timestamp,
      request,
      response: null,
      latency: latency > 0 ? latency : null,
      error: errorDetails,
      success: false,
    };
  }
}
