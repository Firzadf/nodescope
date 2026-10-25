import { describe, it, expect } from 'vitest';
import { defaultPeerMethodForProfile, hasPeerCountSupport } from './metricMethodDefaults';
import { parsePeerCount } from './metricParsers';
import type { RpcDiagnosticResult } from '../types/rpc';

function peerResult(result: unknown): RpcDiagnosticResult {
  return {
    timestamp: 0,
    request: { jsonrpc: '2.0', id: 1, method: 'net_peerCount', params: [] },
    response: { jsonrpc: '2.0', id: 1, result },
    latency: 10,
    error: null,
    success: true,
  };
}

describe('EVM peer count', () => {
  it('uses net_peerCount for the EVM profile', () => {
    expect(hasPeerCountSupport('portaldot_v3_evm')).toBe(true);
    expect(defaultPeerMethodForProfile('portaldot_v3_evm')).toBe('net_peerCount');
    expect(defaultPeerMethodForProfile('generic_http')).toBe('system_health');
  });

  it('parses a hex peer count from net_peerCount', () => {
    const parsed = parsePeerCount(peerResult('0x1'));
    expect(parsed.status).toBe('success');
    expect(parsed.value).toBe(1);
  });

  it('still parses a numeric peers field from system_health', () => {
    const parsed = parsePeerCount(peerResult({ peers: 3 }));
    expect(parsed.status).toBe('success');
    expect(parsed.value).toBe(3);
  });
});
