import { describe, it, expect } from 'vitest';
import { validatePortaldotV3ChainId, PORTALDOT_V3_TESTNET_CHAIN_ID, PORTALDOT_V3_TESTNET_CHAIN_ID_HEX } from './chainIdValidator';
import type { RpcDiagnosticResult } from '../types/rpc';

describe('chainIdValidator', () => {
  it('returns unverified when result is null', () => {
    const result = validatePortaldotV3ChainId(null);
    expect(result.isPortaldotV3Testnet).toBe(false);
    expect(result.chainId).toBeNull();
    expect(result.error).toBe('No RPC result provided');
  });

  it('returns unverified when RPC request failed', () => {
    const res: RpcDiagnosticResult = {
      timestamp: Date.now(),
      request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
      response: null,
      latency: 100,
      error: 'Network timeout',
      success: false,
    };
    const result = validatePortaldotV3ChainId(res);
    expect(result.isPortaldotV3Testnet).toBe(false);
    expect(result.error).toBe('Network timeout');
  });

  it('returns unverified when response has JSON-RPC error', () => {
    const res: RpcDiagnosticResult = {
      timestamp: Date.now(),
      request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
      response: {
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32601, message: 'Method not found' },
      },
      latency: 100,
      error: 'JSON-RPC Error [-32601]: Method not found',
      success: false,
    };
    const result = validatePortaldotV3ChainId(res);
    expect(result.isPortaldotV3Testnet).toBe(false);
    expect(result.error).toBe('JSON-RPC Error [-32601]: Method not found');
  });

  it('returns unverified when result is not a hex string', () => {
    const res: RpcDiagnosticResult = {
      timestamp: Date.now(),
      request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
      response: {
        jsonrpc: '2.0',
        id: 1,
        result: 420420777, // number instead of hex string
      },
      latency: 100,
      error: null,
      success: true,
    };
    const result = validatePortaldotV3ChainId(res);
    expect(result.isPortaldotV3Testnet).toBe(false);
    expect(result.error).toBe('Chain ID response is not a valid hex string');
  });

  it('returns verified when chain ID matches Portaldot V3 testnet', () => {
    const res: RpcDiagnosticResult = {
      timestamp: Date.now(),
      request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
      response: {
        jsonrpc: '2.0',
        id: 1,
        result: PORTALDOT_V3_TESTNET_CHAIN_ID_HEX, // 0x190f1ca9
      },
      latency: 100,
      error: null,
      success: true,
    };
    const result = validatePortaldotV3ChainId(res);
    expect(result.isPortaldotV3Testnet).toBe(true);
    expect(result.chainId).toBe(PORTALDOT_V3_TESTNET_CHAIN_ID);
    expect(result.chainIdHex).toBe(PORTALDOT_V3_TESTNET_CHAIN_ID_HEX);
    expect(result.error).toBeNull();
  });

  it('returns unverified with mismatch when chain ID does not match', () => {
    const res: RpcDiagnosticResult = {
      timestamp: Date.now(),
      request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
      response: {
        jsonrpc: '2.0',
        id: 1,
        result: '0x1', // Different chain ID
      },
      latency: 100,
      error: null,
      success: true,
    };
    const result = validatePortaldotV3ChainId(res);
    expect(result.isPortaldotV3Testnet).toBe(false);
    expect(result.chainId).toBe(1);
    expect(result.chainIdHex).toBe('0x1');
    expect(result.error).toContain('Chain ID mismatch');
  });

  it('returns unverified when hex string cannot be parsed', () => {
    const res: RpcDiagnosticResult = {
      timestamp: Date.now(),
      request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
      response: {
        jsonrpc: '2.0',
        id: 1,
        result: '0xGGGG', // Invalid hex
      },
      latency: 100,
      error: null,
      success: true,
    };
    const result = validatePortaldotV3ChainId(res);
    expect(result.isPortaldotV3Testnet).toBe(false);
    expect(result.chainIdHex).toBeNull();
    expect(result.error).toBe('Chain ID response is not a valid hex string');
  });

  it('rejects a matching prefix with malformed trailing characters', () => {
    const res: RpcDiagnosticResult = {
      timestamp: Date.now(),
      request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
      response: {
        jsonrpc: '2.0',
        id: 1,
        result: '0x190f1ca9-not-hex',
      },
      latency: 100,
      error: null,
      success: true,
    };
    const result = validatePortaldotV3ChainId(res);
    expect(result.isPortaldotV3Testnet).toBe(false);
    expect(result.error).toBe('Chain ID response is not a valid hex string');
  });

  it('rejects a matching chain ID returned by a different RPC method', () => {
    const res: RpcDiagnosticResult = {
      timestamp: Date.now(),
      request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
      response: {
        jsonrpc: '2.0',
        id: 1,
        result: PORTALDOT_V3_TESTNET_CHAIN_ID_HEX,
      },
      latency: 100,
      error: null,
      success: true,
    };
    const result = validatePortaldotV3ChainId(res);
    expect(result.isPortaldotV3Testnet).toBe(false);
    expect(result.error).toBe('Chain ID verification requires an eth_chainId response');
  });

  it('preserves JSON-RPC error code and message when normalized error is absent', () => {
    const res: RpcDiagnosticResult = {
      timestamp: Date.now(),
      request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
      response: {
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32601, message: 'Method not found' },
      },
      latency: 100,
      error: null,
      success: false,
    };
    const result = validatePortaldotV3ChainId(res);
    expect(result.isPortaldotV3Testnet).toBe(false);
    expect(result.error).toBe('JSON-RPC Error [-32601]: Method not found');
  });
});
