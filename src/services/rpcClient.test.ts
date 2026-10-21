import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendJsonRpcRequest } from './rpcClient';

describe('sendJsonRpcRequest', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('handles successful JSON-RPC responses with latency', async () => {
    const mockResponse = {
      jsonrpc: '2.0',
      result: { health: true },
      id: 1,
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await sendJsonRpcRequest('http://localhost:9933', 'system_health');

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.response).toEqual(mockResponse);
    expect(result.latency).toBeTypeOf('number');
  });

  it('handles JSON-RPC error responses', async () => {
    const mockErrorResponse = {
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not found' },
      id: 1,
    };

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockErrorResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await sendJsonRpcRequest('http://localhost:9933', 'unknown_method');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Method not found');
    expect(result.response).toEqual(mockErrorResponse);
  });

  it('handles HTTP non-200 failures', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      })
    );

    const result = await sendJsonRpcRequest('http://localhost:9933', 'system_health');

    expect(result.success).toBe(false);
    expect(result.error).toContain('HTTP Error: 500');
    expect(result.response).toBeNull();
  });

  it('handles invalid JSON responses', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Not a JSON string', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    const result = await sendJsonRpcRequest('http://localhost:9933', 'system_health');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid JSON response');
  });

  it('handles network failure or CORS block', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await sendJsonRpcRequest('http://localhost:9933', 'system_health');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network or CORS Error');
  });

  it('handles request timeout', async () => {
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 50);
        })
    );

    const result = await sendJsonRpcRequest('http://localhost:9933', 'system_health', [], 10);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Request timeout');
  });

  it('validates URL before sending request', async () => {
    const result = await sendJsonRpcRequest('invalid-url', 'system_health');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid URL format');
    expect(fetch).not.toHaveBeenCalled();
  });
});
