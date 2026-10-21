import { describe, expect, it } from 'vitest';
import type { EvmConnectionDetails } from '../types/endpoint';
import type { DiagnosticHistoryItem } from '../types/rpc';
import {
  deduplicateFindings,
  evaluateChainIdMatch,
  evaluateDiagnosticResult,
  evaluateEvmConnectionFindings,
  evaluateHistoryFindings,
  evaluateInvalidResponse,
  evaluateJsonRpcError,
  evaluateLatencyThreshold,
  evaluateNetworkFailure,
} from './diagnosticRules';
import type { ChainIdValidationResult } from '../utils/chainIdValidator';

function baseItem(overrides: Partial<DiagnosticHistoryItem> = {}): DiagnosticHistoryItem {
  return {
    id: 'test-id',
    endpoint: 'https://test-evm-rpc-v3.portaldot.dev',
    timestamp: Date.now(),
    request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
    response: { jsonrpc: '2.0', result: '0x190f1ca9', id: 1 },
    latency: 125,
    error: null,
    success: true,
    ...overrides,
  };
}

describe('diagnosticRules', () => {
  describe('evaluateChainIdMatch', () => {
    it('returns verified finding for expected Portaldot chain ID', () => {
      const validation: ChainIdValidationResult = {
        isPortaldotV3Testnet: true,
        chainId: 420420777,
        chainIdHex: '0x190f1ca9',
        error: null,
      };
      const finding = evaluateChainIdMatch(validation);
      expect(finding).not.toBeNull();
      expect(finding?.ruleId).toBe('chain-id-verified');
      expect(finding?.severity).toBe('info');
      expect(finding?.evidence).toContain('420420777');
      expect(finding?.evidence).toContain('0x190f1ca9');
    });

    it('returns mismatch finding for wrong chain ID', () => {
      const validation: ChainIdValidationResult = {
        isPortaldotV3Testnet: false,
        chainId: 1,
        chainIdHex: '0x1',
        error: 'Chain ID mismatch: expected 420420777, got 1',
      };
      const finding = evaluateChainIdMatch(validation);
      expect(finding?.ruleId).toBe('chain-id-mismatch');
      expect(finding?.severity).toBe('error');
      expect(finding?.evidence).toContain('1');
      expect(finding?.evidence).toContain('420420777');
      expect(finding?.recommendation.toLowerCase()).toContain('endpoint');
    });

    it('reports invalid response for malformed chain ID response', () => {
      const validation: ChainIdValidationResult = {
        isPortaldotV3Testnet: false,
        chainId: null,
        chainIdHex: null,
        error: 'Chain ID response is not a valid hex string',
      };
      const finding = evaluateChainIdMatch(validation);
      expect(finding?.ruleId).toBe('chain-id-invalid-response');
      expect(finding?.severity).toBe('warning');
      expect(finding?.evidence).toContain('Chain ID response is not a valid hex string');
    });

    it('returns null when no validation result exists', () => {
      expect(evaluateChainIdMatch(null)).toBeNull();
    });
  });

  describe('evaluateJsonRpcError - -32601', () => {
    it('labels method unavailable on endpoint, not missing substrate support', () => {
      const item = baseItem({
        request: { jsonrpc: '2.0', method: 'system_health', params: [], id: 3 },
        response: { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 3 },
        error: 'JSON-RPC Error [-32601]: Method not found',
        success: false,
      });
      const finding = evaluateJsonRpcError(item, 'system_health');
      expect(finding?.ruleId).toBe('method-unsupported-on-endpoint');
      expect(finding?.evidence).toContain('-32601');
      expect(finding?.evidence).toContain('system_health');
      expect(finding?.explanation.toLowerCase()).toContain('endpoint');
      expect(finding?.explanation.toLowerCase()).not.toContain('node itself lacks substrate');
    });

    it('reports other JSON-RPC errors as rpc-error', () => {
      const item = baseItem({
        response: { jsonrpc: '2.0', error: { code: -32602, message: 'Invalid params' }, id: 3 },
        error: 'JSON-RPC Error [-32602]: Invalid params',
        success: false,
      });
      const finding = evaluateJsonRpcError(item, 'eth_chainId');
      expect(finding?.ruleId).toBe('rpc-error');
      expect(finding?.evidence).toContain('-32602');
    });

    it('returns null for successful result', () => {
      const item = baseItem();
      expect(evaluateJsonRpcError(item, 'eth_chainId')).toBeNull();
    });
  });

  describe('network vs malformed', () => {
    it('classifies network failure as network-failure', () => {
      const item = baseItem({
        response: null,
        success: false,
        error: 'Network or CORS Error: Could not connect to https://offline.example.com.',
      });
      expect(evaluateNetworkFailure(item)?.ruleId).toBe('network-failure');
      expect(evaluateInvalidResponse(item, 'eth_chainId')).toBeNull();
    });

    it('classifies malformed JSON response as malformed-response', () => {
      const item = baseItem({
        response: null,
        success: false,
        error: 'Invalid JSON response received from server: not-json',
        latency: 40,
      });
      expect(evaluateNetworkFailure(item)).toBeNull();
      expect(evaluateInvalidResponse(item, 'eth_chainId')?.ruleId).toBe('malformed-response');
    });
  });

  describe('latency thresholds', () => {
    it('ignores latency when not configured', () => {
      const item = baseItem({ latency: 5000 });
      expect(evaluateLatencyThreshold(item, {})).toBeNull();
      expect(evaluateDiagnosticResult(item, {})).toBeNull();
    });

    it('ignores latency when missing', () => {
      const item = baseItem({ latency: null });
      expect(evaluateLatencyThreshold(item, { latencyThresholdMs: 100 }) ).toBeNull();
    });

    it('reports breach with consistent units', () => {
      const item = baseItem({ latency: 480 });
      const finding = evaluateLatencyThreshold(item, { latencyThresholdMs: 200 });
      expect(finding?.ruleId).toBe('latency-exceeds-threshold');
      expect(finding?.severity).toBe('warning');
      expect(finding?.evidence).toContain('480ms');
      expect(finding?.evidence).toContain('200ms');
    });

    it('skips latency when measured exactly equals threshold', () => {
      const item = baseItem({ latency: 200 });
      expect(evaluateLatencyThreshold(item, { latencyThresholdMs: 200 })).toBeNull();
    });

    it('reports breach just beyond threshold', () => {
      const item = baseItem({ latency: 201 });
      expect(evaluateLatencyThreshold(item, { latencyThresholdMs: 200 })?.ruleId).toBe('latency-exceeds-threshold');
    });
  });

  describe('EVM connection findings', () => {
    function evmDetails(overrides: Partial<EvmConnectionDetails> = {}): EvmConnectionDetails {
      const chainIdResult = baseItem({
        request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
        response: { jsonrpc: '2.0', result: '0x190f1ca9', id: 1 },
        success: true,
        latency: 40,
      });
      const blockResult = baseItem({
        id: 'block',
        request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
        response: { jsonrpc: '2.0', result: '0x100', id: 2 },
        success: true,
        latency: 30,
      });
      const validation: ChainIdValidationResult = {
        isPortaldotV3Testnet: true,
        chainId: 420420777,
        chainIdHex: '0x190f1ca9',
        error: null,
      };
      return {
        chainIdResult,
        blockResult,
        validation,
        ...overrides,
      };
    }

    it('produces findings for successful Portaldot chain ID and retrieved block height', () => {
      const findings = evaluateEvmConnectionFindings(evmDetails());
      expect(findings.some((f) => f.ruleId === 'chain-id-verified')).toBe(true);
      expect(findings.some((f) => f.ruleId === 'block-height-retrieved')).toBe(true);
      const blockFinding = findings.find((f) => f.ruleId === 'block-height-retrieved');
      expect(blockFinding?.explanation.toLowerCase()).toContain('one measurement');
      expect(blockFinding?.evidence).toContain('eth_blockNumber');
    });

    it('reports chain mismatch and block failure distinctly', () => {
      const chainIdResult = baseItem({
        request: { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
        response: { jsonrpc: '2.0', result: '0x1', id: 1 },
      });
      const blockResult = baseItem({
        id: 'block',
        request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
        response: null,
        success: false,
        error: 'Network or CORS Error: Could not connect',
        latency: null,
      });
      const findings = evaluateEvmConnectionFindings({
        chainIdResult,
        blockResult,
        validation: {
          isPortaldotV3Testnet: false,
          chainId: 1,
          chainIdHex: '0x1',
          error: 'Chain ID mismatch: expected 420420777, got 1',
        },
      });
      expect(findings.some((f) => f.ruleId === 'chain-id-mismatch')).toBe(true);
      expect(findings.some((f) => f.ruleId === 'network-failure')).toBe(true);
      expect(findings.filter((f) => f.ruleId === 'invalid-response').length).toBe(0);
    });

    it('adds explicit latency breach on EVM connection checks only when configured', () => {
      const details = evmDetails({
        chainIdResult: baseItem({ latency: 500 }),
        blockResult: baseItem({
          id: 'block',
          request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
          response: { jsonrpc: '2.0', result: '0x10', id: 2 },
          latency: 500,
        }),
      });
      expect(evaluateEvmConnectionFindings(details)).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ ruleId: 'latency-exceeds-threshold' })])
      );
      expect(
        evaluateEvmConnectionFindings(details, { latencyThresholdMs: 200 }).some(
          (finding) => finding.ruleId === 'latency-exceeds-threshold'
        )
      ).toBe(true);
    });
  });

  describe('finding deduplication', () => {
    it('removes repeated findings with the same rule and evidence', () => {
      const finding = evaluateChainIdMatch({
        isPortaldotV3Testnet: true,
        chainId: 420420777,
        chainIdHex: '0x190f1ca9',
        error: null,
      });
      expect(finding).not.toBeNull();
      expect(deduplicateFindings([finding!, finding!])).toHaveLength(1);
    });
  });

  describe('deduplicateFindings (regression)', () => {
    it('removes exact duplicate finding by evidence', () => {
      const f = {
        ruleId: 'x',
        severity: 'info' as const,
        title: 'X',
        evidence: "Method 'eth_blockNumber' returned block height: 0x10",
        explanation: 'ex',
        recommendation: 'rec',
      };
      expect(deduplicateFindings([f, f])).toHaveLength(1);
    });
    it('keeps findings with same rule but different evidence', () => {
      const mk = (ev: string) => ({
        ruleId: 'x',
        severity: 'info' as const,
        title: 'X',
        evidence: ev,
        explanation: 'ex',
        recommendation: 'rec',
      });
      expect(deduplicateFindings([mk('a'), mk('b')])).toHaveLength(2);
    });
  });

  describe('history findings', () => {
    it('keeps only latest block-height finding per endpoint', () => {
      const history: DiagnosticHistoryItem[] = [
        baseItem({ id: 'h-old', endpoint: 'https://a.example', timestamp: 100, request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }, response: { jsonrpc: '2.0', result: '0x10', id: 1 }, success: true }),
        baseItem({ id: 'h-new', endpoint: 'https://a.example', timestamp: 200, request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }, response: { jsonrpc: '2.0', result: '0x11', id: 1 }, success: true }),
      ];
      const findings = evaluateHistoryFindings(history);
      const block = findings.filter((f) => f.ruleId === 'block-height-retrieved');
      expect(block).toHaveLength(1);
      expect(block[0].evidence).toContain('0x11');
    });
    it('keeps distinct block-height findings for distinct endpoints', () => {
      const history: DiagnosticHistoryItem[] = [
        baseItem({ id: 'h-a', endpoint: 'https://a.example', timestamp: 100, request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }, response: { jsonrpc: '2.0', result: '0x10', id: 1 }, success: true }),
        baseItem({ id: 'h-b', endpoint: 'https://b.example', timestamp: 110, request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }, response: { jsonrpc: '2.0', result: '0x20', id: 1 }, success: true }),
      ];
      expect(evaluateHistoryFindings(history).filter((f) => f.ruleId === 'block-height-retrieved')).toHaveLength(2);
    });
    it('preserves the latest finding even if history items arrive out of order', () => {
      const history: DiagnosticHistoryItem[] = [
        baseItem({ id: 'h-newer', endpoint: 'https://a.example', timestamp: 500, request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }, response: { jsonrpc: '2.0', result: '0x20', id: 1 }, success: true }),
        baseItem({ id: 'h-older', endpoint: 'https://a.example', timestamp: 100, request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }, response: { jsonrpc: '2.0', result: '0x10', id: 1 }, success: true }),
      ];
      const findings = evaluateHistoryFindings(history);
      const block = findings.filter((f) => f.ruleId === 'block-height-retrieved');
      expect(block).toHaveLength(1);
      expect(block[0].evidence).toContain('0x20');
    });
    it('deduplicates latency threshold breach by endpoint and retains latest observation', () => {
      const history: DiagnosticHistoryItem[] = [
        baseItem({ id: 'h-lat1', endpoint: 'https://a.example', timestamp: 100, latency: 400 }),
        baseItem({ id: 'h-lat2', endpoint: 'https://a.example', timestamp: 200, latency: 500 }),
        baseItem({ id: 'h-lat3', endpoint: 'https://b.example', timestamp: 150, latency: 600 }),
      ];
      const findings = evaluateHistoryFindings(history, { latencyThresholdMs: 250 });
      const latFindings = findings.filter((f) => f.ruleId === 'latency-exceeds-threshold');
      expect(latFindings).toHaveLength(2);
      const latA = latFindings.find((f) => f.evidence.includes('500ms'));
      expect(latA).toBeDefined();
    });
    it('combines connection and history evidence without duplicates', () => {
      const history: DiagnosticHistoryItem[] = [
        baseItem({
          id: 'h1',
          response: { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 1 },
          error: 'JSON-RPC Error [-32601]: Method not found',
          success: false,
          latency: 42,
        }),
        baseItem({
          id: 'h2',
          endpoint: 'https://offline.example.com',
          response: null,
          success: false,
          error: 'Network or CORS Error: Could not connect',
          latency: null,
        }),
        baseItem({
          id: 'h3',
          request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
          response: { jsonrpc: '2.0', result: '0x200', id: 2 },
          success: true,
          latency: 25,
        }),
      ];
      const findings = evaluateHistoryFindings(history);
      expect(findings.some((f) => f.ruleId === 'method-unsupported-on-endpoint')).toBe(true);
      expect(findings.some((f) => f.ruleId === 'network-failure')).toBe(true);
      expect(findings.some((f) => f.ruleId === 'block-height-retrieved')).toBe(true);
      const malformed = findings.filter((f) => f.ruleId === 'malformed-response');
      expect(malformed.length).toBe(0);
    });
  });
});
