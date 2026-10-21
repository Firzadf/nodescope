import { describe, it, expect } from 'vitest';
import {
  parseLatency,
  parseClientVersion,
  parsePeerCount,
  parseBlockHeight,
} from './metricParsers';
import type { RpcDiagnosticResult } from '../types/rpc';

function createMockResult(overrides: Partial<RpcDiagnosticResult>): RpcDiagnosticResult {
  return {
    timestamp: 1700000000000,
    request: {
      jsonrpc: '2.0',
      method: 'test_method',
      params: [],
      id: 1,
    },
    response: null,
    latency: 50,
    error: null,
    success: true,
    ...overrides,
  };
}

describe('metricParsers', () => {
  describe('parseLatency', () => {
    it('returns not_tested when result is null', () => {
      const res = parseLatency(null);
      expect(res.status).toBe('not_tested');
      expect(res.value).toBeNull();
    });

    it('returns success with measured latency', () => {
      const res = parseLatency(createMockResult({ latency: 42 }));
      expect(res.status).toBe('success');
      expect(res.value).toBe(42);
    });

    it('classifies network failure when latency is null and error is present', () => {
      const res = parseLatency(
        createMockResult({
          latency: null,
          success: false,
          error: 'Network or CORS Error: Could not connect',
        })
      );
      expect(res.status).toBe('network_error');
      expect(res.value).toBeNull();
      expect(res.error).toContain('Network or CORS Error');
    });
  });

  describe('parseClientVersion', () => {
    it('returns not_tested when result is null', () => {
      const res = parseClientVersion(null);
      expect(res.status).toBe('not_tested');
    });

    it('parses valid string client version', () => {
      const res = parseClientVersion(
        createMockResult({
          response: { jsonrpc: '2.0', result: 'nodescope/v1.2.0-rust', id: 1 },
        })
      );
      expect(res.status).toBe('success');
      expect(res.value).toBe('nodescope/v1.2.0-rust');
    });

    it('flags invalid_response if result is not a string', () => {
      const res = parseClientVersion(
        createMockResult({
          response: { jsonrpc: '2.0', result: { nested: true }, id: 1 },
        })
      );
      expect(res.status).toBe('invalid_response');
      expect(res.value).toBeNull();
    });

    it('detects unsupported_method on JSON-RPC code -32601', () => {
      const res = parseClientVersion(
        createMockResult({
          success: false,
          error: 'JSON-RPC Error [-32601]: Method not found',
          response: {
            jsonrpc: '2.0',
            error: { code: -32601, message: 'Method not found' },
            id: 1,
          },
        })
      );
      expect(res.status).toBe('unsupported_method');
      expect(res.error).toContain('Method unsupported by node');
    });

    it('detects network_error on network failure', () => {
      const res = parseClientVersion(
        createMockResult({
          success: false,
          error: 'HTTP Error: 502 Bad Gateway',
        })
      );
      expect(res.status).toBe('network_error');
    });
  });

  describe('parsePeerCount', () => {
    it('returns not_tested when null', () => {
      expect(parsePeerCount(null).status).toBe('not_tested');
    });

    it('extracts peers number from system_health payload', () => {
      const res = parsePeerCount(
        createMockResult({
          response: {
            jsonrpc: '2.0',
            result: { isSyncing: false, peers: 18, shouldHavePeers: true },
            id: 1,
          },
        })
      );
      expect(res.status).toBe('success');
      expect(res.value).toBe(18);
    });

    it('handles payload missing peers field as invalid_response', () => {
      const res = parsePeerCount(
        createMockResult({
          response: {
            jsonrpc: '2.0',
            result: { isSyncing: false },
            id: 1,
          },
        })
      );
      expect(res.status).toBe('invalid_response');
      expect(res.value).toBeNull();
    });

    it('identifies unsupported method on code -32601', () => {
      const res = parsePeerCount(
        createMockResult({
          success: false,
          response: {
            jsonrpc: '2.0',
            error: { code: -32601, message: 'Method not found' },
            id: 1,
          },
        })
      );
      expect(res.status).toBe('unsupported_method');
    });
  });

  describe('parseBlockHeight', () => {
    it('returns not_tested when null', () => {
      expect(parseBlockHeight(null).status).toBe('not_tested');
    });

    it('parses Substrate chain_getHeader hex number', () => {
      const res = parseBlockHeight(
        createMockResult({
          response: {
            jsonrpc: '2.0',
            result: { number: '0x10', parentHash: '0xabc' },
            id: 1,
          },
        })
      );
      expect(res.status).toBe('success');
      expect(res.value).toBe(16);
    });

    it('parses Substrate chain_getHeader decimal number', () => {
      const res = parseBlockHeight(
        createMockResult({
          response: {
            jsonrpc: '2.0',
            result: { number: 42000 },
            id: 1,
          },
        })
      );
      expect(res.status).toBe('success');
      expect(res.value).toBe(42000);
    });

    it('parses direct hex string result', () => {
      const res = parseBlockHeight(
        createMockResult({
          response: {
            jsonrpc: '2.0',
            result: '0x2a',
            id: 1,
          },
        })
      );
      expect(res.status).toBe('success');
      expect(res.value).toBe(42);
    });

    it('handles unexpected object structure as invalid_response', () => {
      const res = parseBlockHeight(
        createMockResult({
          response: {
            jsonrpc: '2.0',
            result: { unrecognised: true },
            id: 1,
          },
        })
      );
      expect(res.status).toBe('invalid_response');
    });

    it('handles -32601 method not found as unsupported_method', () => {
      const res = parseBlockHeight(
        createMockResult({
          success: false,
          response: {
            jsonrpc: '2.0',
            error: { code: -32601, message: 'Method not found' },
            id: 1,
          },
        })
      );
      expect(res.status).toBe('unsupported_method');
    });
  });
});
