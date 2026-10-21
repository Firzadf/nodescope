import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runHealthCheck,
  classifyCheck,
  methodsForProfile,
} from './healthCheckRunner';
import { sendJsonRpcRequest } from './rpcClient';
import type { RpcDiagnosticResult } from '../types/rpc';
import { HEALTH_SNAPSHOT_SCHEMA_VERSION } from '../types/healthCheck';

vi.mock('./rpcClient', () => ({
  sendJsonRpcRequest: vi.fn(),
}));

function mockResult(overrides: Partial<RpcDiagnosticResult> = {}): RpcDiagnosticResult {
  return {
    timestamp: 1700000000000,
    request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
    response: { jsonrpc: '2.0', result: '0x190f1ca9', id: 1 },
    latency: 35,
    error: null,
    success: true,
    ...overrides,
  };
}

describe('healthCheckRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('methodsForProfile', () => {
    it('returns EVM specific read-only methods for portaldot_v3_evm profile', () => {
      const methods = methodsForProfile('portaldot_v3_evm');
      expect(methods).toContain('eth_chainId');
      expect(methods).toContain('eth_blockNumber');
      expect(methods).toContain('web3_clientVersion');
      expect(methods).toContain('net_version');
      expect(methods).not.toContain('system_health');
    });

    it('returns Substrate specific methods for generic_http profile', () => {
      const methods = methodsForProfile('generic_http');
      expect(methods).toContain('system_health');
      expect(methods).toContain('system_version');
      expect(methods).toContain('chain_getHeader');
      expect(methods).toContain('eth_chainId');
      expect(methods).not.toContain('eth_blockNumber');
    });
  });

  describe('classifyCheck', () => {
    it('classifies genuine -32601 code as unsupported_method', () => {
      const res = mockResult({
        success: false,
        response: { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 1 },
        error: 'JSON-RPC Error [-32601]: Method not found',
      });
      const c = classifyCheck(res);
      expect(c.outcome).toBe('unsupported_method');
      expect(c.observedValue).toBeNull();
      expect(c.error).toContain('-32601');
    });

    it('classifies other JSON-RPC error as rpc_error', () => {
      const res = mockResult({
        success: false,
        response: { jsonrpc: '2.0', error: { code: -32602, message: 'Invalid params' }, id: 1 },
        error: 'JSON-RPC Error [-32602]: Invalid params',
      });
      const c = classifyCheck(res);
      expect(c.outcome).toBe('rpc_error');
      expect(c.observedValue).toBeNull();
      expect(c.error).toContain('-32602');
    });

    it('classifies network failure and CORS error as network_error', () => {
      const res = mockResult({
        success: false,
        response: null,
        error: 'Network or CORS Error: Could not connect to endpoint',
        latency: null,
      });
      const c = classifyCheck(res);
      expect(c.outcome).toBe('network_error');
      expect(c.observedValue).toBeNull();
    });

    it('classifies timeout as network_error', () => {
      const res = mockResult({
        success: false,
        response: null,
        error: 'Request timeout after 5000ms',
        latency: 5000,
      });
      const c = classifyCheck(res);
      expect(c.outcome).toBe('network_error');
    });

    it('classifies HTTP status failures as http_error', () => {
      const res = mockResult({
        success: false,
        response: null,
        error: 'HTTP Error: 502 Bad Gateway',
        latency: 50,
      });
      const c = classifyCheck(res);
      expect(c.outcome).toBe('http_error');
    });

    it('extracts peer count from Substrate health object', () => {
      const res = mockResult({
        request: { jsonrpc: '2.0', method: 'system_health', params: [], id: 1 },
        response: { jsonrpc: '2.0', result: { peers: 7, isSyncing: false }, id: 1 },
      });
      const c = classifyCheck(res);
      expect(c.outcome).toBe('success');
      expect(c.observedValue).toBe(7);
      expect(c.error).toBeNull();
    });

    it('extracts block number from header object', () => {
      const res = mockResult({
        request: { jsonrpc: '2.0', method: 'chain_getHeader', params: [], id: 1 },
        response: { jsonrpc: '2.0', result: { number: '0x100' }, id: 1 },
      });
      const c = classifyCheck(res);
      expect(c.outcome).toBe('success');
      expect(c.observedValue).toBe('0x100');
    });
  });

  describe('runHealthCheck', () => {
    it('executes user-triggered health check with all successful responses', async () => {
      vi.mocked(sendJsonRpcRequest)
        .mockResolvedValueOnce(
          mockResult({
            request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
            response: { jsonrpc: '2.0', result: '0x190f1ca9', id: 1 },
          })
        )
        .mockResolvedValueOnce(
          mockResult({
            request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
            response: { jsonrpc: '2.0', result: '0x12345', id: 2 },
          })
        )
        .mockResolvedValueOnce(
          mockResult({
            request: { jsonrpc: '2.0', method: 'web3_clientVersion', params: [], id: 3 },
            response: { jsonrpc: '2.0', result: 'Portaldot-Node/v3.0.0', id: 3 },
          })
        )
        .mockResolvedValueOnce(
          mockResult({
            request: { jsonrpc: '2.0', method: 'net_version', params: [], id: 4 },
            response: { jsonrpc: '2.0', result: '420420777', id: 4 },
          })
        );

      const recorded: RpcDiagnosticResult[] = [];
      const snapshot = await runHealthCheck(
        'https://test-evm-rpc-v3.portaldot.dev',
        'portaldot_v3_evm',
        {
          onRecordResult: (r) => recorded.push(r),
        }
      );

      expect(snapshot.schemaVersion).toBe(HEALTH_SNAPSHOT_SCHEMA_VERSION);
      expect(snapshot.endpointOrigin).toBe('https://test-evm-rpc-v3.portaldot.dev');
      expect(snapshot.endpointProfile).toBe('portaldot_v3_evm');
      expect(snapshot.checks).toHaveLength(4);
      expect(snapshot.checks.every((c) => c.success)).toBe(true);
      expect(recorded).toHaveLength(4);

      // Chain ID finding verified
      const chainFinding = snapshot.findings.find((f) => f.ruleId === 'chain-id-verified');
      expect(chainFinding).toBeDefined();

      // Block height finding verified
      const blockFinding = snapshot.findings.find((f) => f.ruleId === 'block-height-retrieved');
      expect(blockFinding).toBeDefined();
    });

    it('handles chain ID mismatch and creates chain-id-mismatch finding', async () => {
      vi.mocked(sendJsonRpcRequest)
        .mockResolvedValueOnce(
          mockResult({
            request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
            response: { jsonrpc: '2.0', result: '0x1', id: 1 }, // Ethereum Mainnet 1
          })
        )
        .mockResolvedValueOnce(
          mockResult({
            request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
            response: { jsonrpc: '2.0', result: '0x10', id: 2 },
          })
        )
        .mockResolvedValueOnce(
          mockResult({
            request: { jsonrpc: '2.0', method: 'web3_clientVersion', params: [], id: 3 },
            response: { jsonrpc: '2.0', result: 'geth/v1.10.0', id: 3 },
          })
        )
        .mockResolvedValueOnce(
          mockResult({
            request: { jsonrpc: '2.0', method: 'net_version', params: [], id: 4 },
            response: { jsonrpc: '2.0', result: '1', id: 4 },
          })
        );

      const snapshot = await runHealthCheck(
        'https://mainnet.infura.io/v3/key',
        'portaldot_v3_evm'
      );

      const mismatch = snapshot.findings.find((f) => f.ruleId === 'chain-id-mismatch');
      expect(mismatch).toBeDefined();
      expect(mismatch?.severity).toBe('error');
    });

    it('handles partially failed check run without crashing', async () => {
      vi.mocked(sendJsonRpcRequest)
        .mockResolvedValueOnce(
          mockResult({
            request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
            response: { jsonrpc: '2.0', result: '0x190f1ca9', id: 1 },
          })
        )
        .mockResolvedValueOnce(
          mockResult({
            request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
            response: { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 2 },
            success: false,
            error: 'JSON-RPC Error [-32601]: Method not found',
          })
        )
        .mockResolvedValueOnce(
          mockResult({
            request: { jsonrpc: '2.0', method: 'web3_clientVersion', params: [], id: 3 },
            response: null,
            latency: null,
            success: false,
            error: 'Network or CORS Error: timeout',
          })
        )
        .mockResolvedValueOnce(
          mockResult({
            request: { jsonrpc: '2.0', method: 'net_version', params: [], id: 4 },
            response: { jsonrpc: '2.0', result: '420420777', id: 4 },
          })
        );

      const snapshot = await runHealthCheck(
        'https://test-evm-rpc-v3.portaldot.dev',
        'portaldot_v3_evm'
      );

      expect(snapshot.checks).toHaveLength(4);
      expect(snapshot.checks[0].outcome).toBe('success');
      expect(snapshot.checks[1].outcome).toBe('unsupported_method');
      expect(snapshot.checks[2].outcome).toBe('network_error');
      expect(snapshot.checks[3].outcome).toBe('success');

      // Findings include unsupported method warning
      const unsupported = snapshot.findings.find(
        (f) => f.ruleId === 'method-unsupported-on-endpoint'
      );
      expect(unsupported).toBeDefined();
    });

    it('does not send duplicate requests for the same method', async () => {
      vi.mocked(sendJsonRpcRequest).mockResolvedValue(mockResult());

      await runHealthCheck('https://test-evm-rpc-v3.portaldot.dev', 'portaldot_v3_evm');

      const methodsCalled = vi.mocked(sendJsonRpcRequest).mock.calls.map((c) => c[1]);
      const uniqueMethods = new Set(methodsCalled);
      expect(methodsCalled.length).toBe(uniqueMethods.size);
    });
  });
});
