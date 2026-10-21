import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testPortaldotV3EvmConnection, testGenericHttpConnection } from './connectionTester';
import { sendJsonRpcRequest } from './rpcClient';

vi.mock('./rpcClient', () => ({
  sendJsonRpcRequest: vi.fn(),
}));

describe('connectionTester', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('testPortaldotV3EvmConnection', () => {
    it('does not call system_health when testing EVM connection', async () => {
      vi.mocked(sendJsonRpcRequest)
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
          response: { jsonrpc: '2.0', result: '0x190f1ca9', id: 1 },
          latency: 45,
          error: null,
          success: true,
        })
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
          response: { jsonrpc: '2.0', result: '0x10', id: 2 },
          latency: 30,
          error: null,
          success: true,
        });

      await testPortaldotV3EvmConnection('https://test-evm-rpc-v3.portaldot.dev');

      const methodsCalled = vi.mocked(sendJsonRpcRequest).mock.calls.map((c) => c[1]);
      expect(methodsCalled).not.toContain('system_health');
      expect(methodsCalled).toEqual(['eth_chainId', 'eth_blockNumber']);
    });

    it('returns connected status for correct Portaldot V3 Chain ID', async () => {
      vi.mocked(sendJsonRpcRequest)
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
          response: { jsonrpc: '2.0', result: '0x190f1ca9', id: 1 },
          latency: 45,
          error: null,
          success: true,
        })
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
          response: { jsonrpc: '2.0', result: '0x100', id: 2 },
          latency: 30,
          error: null,
          success: true,
        });

      const res = await testPortaldotV3EvmConnection('https://test-evm-rpc-v3.portaldot.dev');

      expect(res.status).toBe('connected');
      expect(res.validation.isPortaldotV3Testnet).toBe(true);
      expect(res.validation.chainId).toBe(420420777);
      expect(res.validation.chainIdHex).toBe('0x190f1ca9');
      expect(res.validation.error).toBeNull();
      expect(res.blockResult.success).toBe(true);
    });

    it('returns connected status but reports mismatch for wrong Chain ID', async () => {
      vi.mocked(sendJsonRpcRequest)
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
          response: { jsonrpc: '2.0', result: '0x1', id: 1 }, // Ethereum Mainnet (Chain ID 1)
          latency: 50,
          error: null,
          success: true,
        })
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
          response: { jsonrpc: '2.0', result: '0x200', id: 2 },
          latency: 35,
          error: null,
          success: true,
        });

      const res = await testPortaldotV3EvmConnection('https://mainnet.infura.io/v3/fake');

      expect(res.status).toBe('connected');
      expect(res.validation.isPortaldotV3Testnet).toBe(false);
      expect(res.validation.chainId).toBe(1);
      expect(res.validation.error).toContain('Chain ID mismatch');
      expect(res.validation.error).toContain('420420777');
    });

    it('returns error status for malformed Chain ID response', async () => {
      vi.mocked(sendJsonRpcRequest)
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
          response: { jsonrpc: '2.0', result: 'not-a-hex-string', id: 1 },
          latency: 45,
          error: null,
          success: true,
        })
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
          response: null,
          latency: null,
          error: 'Connection aborted',
          success: false,
        });

      const res = await testPortaldotV3EvmConnection('https://broken-node.example.com');

      expect(res.status).toBe('error');
      expect(res.validation.isPortaldotV3Testnet).toBe(false);
      expect(res.validation.chainId).toBeNull();
      expect(res.validation.error).toBe('Chain ID response is not a valid hex string');
    });

    it('returns error status on JSON-RPC error response from eth_chainId', async () => {
      vi.mocked(sendJsonRpcRequest)
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
          response: {
            jsonrpc: '2.0',
            id: 1,
            error: { code: -32601, message: 'Method not found' },
          },
          latency: 60,
          error: 'JSON-RPC Error [-32601]: Method not found',
          success: false,
        })
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
          response: {
            jsonrpc: '2.0',
            id: 2,
            error: { code: -32601, message: 'Method not found' },
          },
          latency: 40,
          error: 'JSON-RPC Error [-32601]: Method not found',
          success: false,
        });

      const res = await testPortaldotV3EvmConnection('https://substrate-only-node.example.com');

      expect(res.status).toBe('error');
      expect(res.validation.isPortaldotV3Testnet).toBe(false);
      expect(res.validation.chainId).toBeNull();
      expect(res.validation.error).toContain('JSON-RPC Error [-32601]');
    });

    it('returns error status on network failure', async () => {
      vi.mocked(sendJsonRpcRequest)
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
          response: null,
          latency: null,
          error: 'Network or CORS Error: Could not connect to https://offline.example.com.',
          success: false,
        })
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
          response: null,
          latency: null,
          error: 'Network or CORS Error: Could not connect to https://offline.example.com.',
          success: false,
        });

      const res = await testPortaldotV3EvmConnection('https://offline.example.com');

      expect(res.status).toBe('error');
      expect(res.validation.isPortaldotV3Testnet).toBe(false);
      expect(res.validation.chainId).toBeNull();
      expect(res.validation.error).toContain('Network or CORS Error');
    });

    it('distinguishes wrong chain ID from network failure and unsupported method', async () => {
      // 1. Wrong chain ID: returns chainId but mismatch
      vi.mocked(sendJsonRpcRequest)
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
          response: { jsonrpc: '2.0', result: '0x5', id: 1 }, // Goerli (5)
          latency: 30,
          error: null,
          success: true,
        })
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
          response: { jsonrpc: '2.0', result: '0x123', id: 2 },
          latency: 30,
          error: null,
          success: true,
        });

      const wrongChainRes = await testPortaldotV3EvmConnection('https://other-chain.com');
      expect(wrongChainRes.validation.chainId).toBe(5);
      expect(wrongChainRes.validation.error).toContain('Chain ID mismatch');

      // 2. Network error: chainId is null, error contains Network
      vi.mocked(sendJsonRpcRequest)
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
          response: null,
          latency: null,
          error: 'Network error: Failed to fetch',
          success: false,
        })
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
          response: null,
          latency: null,
          error: 'Network error: Failed to fetch',
          success: false,
        });

      const networkRes = await testPortaldotV3EvmConnection('https://down.com');
      expect(networkRes.validation.chainId).toBeNull();
      expect(networkRes.validation.error).toContain('Network error');

      // 3. Unsupported method (-32601): preserves code
      vi.mocked(sendJsonRpcRequest)
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
          response: {
            jsonrpc: '2.0',
            id: 1,
            error: { code: -32601, message: 'Method not found' },
          },
          latency: 20,
          error: 'JSON-RPC Error [-32601]: Method not found',
          success: false,
        })
        .mockResolvedValueOnce({
          timestamp: Date.now(),
          request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
          response: null,
          latency: null,
          error: null,
          success: false,
        });

      const unsuppRes = await testPortaldotV3EvmConnection('https://substrate.com');
      expect(unsuppRes.validation.chainId).toBeNull();
      expect(unsuppRes.validation.error).toContain('-32601');
    });
  });

  describe('testGenericHttpConnection', () => {
    it('calls system_health for generic Substrate HTTP endpoints', async () => {
      vi.mocked(sendJsonRpcRequest).mockResolvedValueOnce({
        timestamp: Date.now(),
        request: { jsonrpc: '2.0', method: 'system_health', params: [], id: 1 },
        response: { jsonrpc: '2.0', result: { peers: 5, isSyncing: false }, id: 1 },
        latency: 25,
        error: null,
        success: true,
      });

      const res = await testGenericHttpConnection('http://127.0.0.1:9944');

      expect(vi.mocked(sendJsonRpcRequest)).toHaveBeenCalledWith(
        'http://127.0.0.1:9944',
        'system_health',
        [],
        5000
      );
      expect(res.status).toBe('connected');
      expect(res.result.success).toBe(true);
    });

    it('returns error status when system_health fails', async () => {
      vi.mocked(sendJsonRpcRequest).mockResolvedValueOnce({
        timestamp: Date.now(),
        request: { jsonrpc: '2.0', method: 'system_health', params: [], id: 1 },
        response: null,
        latency: null,
        error: 'Network or CORS Error: Could not connect',
        success: false,
      });

      const res = await testGenericHttpConnection('http://127.0.0.1:9944');

      expect(res.status).toBe('error');
      expect(res.result.success).toBe(false);
    });
  });
});
