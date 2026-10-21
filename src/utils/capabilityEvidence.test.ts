import { describe, it, expect } from 'vitest';
import type { CapabilitySnapshot } from '../types/capability';
import type { DiagnosticHistoryItem } from '../types/rpc';
import { getMethodEvidenceStatus, formatEvidenceLabel } from './capabilityEvidence';
import { defaultBlockMethodForProfile } from './blockMethodDefaults';
import {
  defaultLatencyMethodForProfile,
  defaultClientVersionMethodForProfile,
  defaultPeerMethodForProfile,
  hasPeerCountSupport,
} from './metricMethodDefaults';

const mockSnapshotSuccessAdvertised: CapabilitySnapshot = {
  endpointOrigin: 'http://localhost:8545',
  discoveredAt: '2026-10-19T12:00:00Z',
  discoveryStatus: 'success',
  safeAdvertisedMethods: [
    { method: 'eth_chainId', evidence: 'advertised' },
    { method: 'eth_blockNumber', evidence: 'advertised' },
    { method: 'system_health', evidence: 'advertised' },
  ],
  rawMethodCount: 3,
  latencyMs: 10,
  error: null,
};

const mockSnapshotUnknown: CapabilitySnapshot = {
  endpointOrigin: 'http://localhost:8545',
  discoveredAt: '2026-10-19T12:00:00Z',
  discoveryStatus: 'success',
  safeAdvertisedMethods: [],
  rawMethodCount: 0,
  latencyMs: 10,
  error: null,
};

const fixedTimestamp = 1729339200000;

describe('getMethodEvidenceStatus', () => {
  const historySuccess: DiagnosticHistoryItem[] = [
    {
      id: '1',
      endpoint: 'http://localhost:8545',
      timestamp: fixedTimestamp,
      request: { jsonrpc: '2.0', method: 'eth_chainId', id: 1 },
      response: { jsonrpc: '2.0', result: '0x539', id: 1 },
      latency: 5,
      error: null,
      success: true,
    },
    {
      id: '2',
      endpoint: 'http://localhost:8545',
      timestamp: fixedTimestamp,
      request: { jsonrpc: '2.0', method: 'system_health', id: 2 },
      response: { jsonrpc: '2.0', result: { health: 'ok' }, id: 2 },
      latency: 15,
      error: null,
      success: true,
    },
  ];

  const historyUnsupported: DiagnosticHistoryItem[] = [
    {
      id: '3',
      endpoint: 'http://localhost:8545',
      timestamp: fixedTimestamp,
      request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 3 },
      response: { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 3 },
      latency: 12,
      error: 'Method not found',
      success: false,
    },
    {
      id: '4',
      endpoint: 'http://localhost:8545',
      timestamp: fixedTimestamp,
      request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 4 },
      response: null,
      latency: 12,
      error: 'Method not found',
      success: false,
    },
  ];

  const historyInvalidResponse: DiagnosticHistoryItem[] = [
    {
      id: '5',
      endpoint: 'http://localhost:8545',
      timestamp: fixedTimestamp,
      request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 5 },
      response: { jsonrpc: '2.0', error: { code: -32602, message: 'Invalid params' }, id: 5 },
      latency: 10,
      error: 'Invalid params',
      success: false,
    },
    {
      id: '6',
      endpoint: 'http://localhost:8545',
      timestamp: fixedTimestamp,
      request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 6 },
      response: null,
      latency: 10,
      error: 'Invalid JSON',
      success: false,
    },
  ];

  it('prioritizes confirmed over advertised and unknown', () => {
    expect(getMethodEvidenceStatus('eth_chainId', mockSnapshotSuccessAdvertised, historySuccess, 'http://localhost:8545')).toBe('confirmed');
    expect(getMethodEvidenceStatus('system_health', mockSnapshotSuccessAdvertised, historySuccess, 'http://localhost:8545')).toBe('confirmed');
  });

  it('prioritizes confirmed over unsupported', () => {
    expect(getMethodEvidenceStatus('eth_chainId', null, historySuccess, 'http://localhost:8545')).toBe('confirmed');
  });

  it('prioritizes unsupported over advertised', () => {
    expect(getMethodEvidenceStatus('eth_getBalance', mockSnapshotSuccessAdvertised, historyUnsupported, 'http://localhost:8545')).toBe('unsupported');
  });

  it('prioritizes unsupported over unknown', () => {
    expect(getMethodEvidenceStatus('eth_getBalance', null, historyUnsupported, 'http://localhost:8545')).toBe('unsupported');
  });

  it('uses advertised if not confirmed or unsupported', () => {
    expect(getMethodEvidenceStatus('eth_blockNumber', mockSnapshotSuccessAdvertised, [], 'http://localhost:8545')).toBe('advertised');
  });

  it('never marks advertised method as confirmed without successful history', () => {
    // Crucial requirement: advertisement alone MUST NOT infer confirmed
    expect(mockSnapshotSuccessAdvertised.safeAdvertisedMethods.some((m) => m.method === 'system_health')).toBe(true);
    expect(getMethodEvidenceStatus('system_health', mockSnapshotSuccessAdvertised, [], 'http://localhost:8545')).toBe('advertised');
    expect(getMethodEvidenceStatus('system_health', mockSnapshotSuccessAdvertised, [], 'http://localhost:8545')).not.toBe('confirmed');
  });

  it('returns unknown if no evidence found', () => {
    expect(getMethodEvidenceStatus('non_existent_method', null, [], 'http://localhost:8545')).toBe('unknown');
    expect(getMethodEvidenceStatus('non_existent_method', mockSnapshotUnknown, [], 'http://localhost:8545')).toBe('unknown');
  });

  it('handles empty history correctly', () => {
    expect(getMethodEvidenceStatus('eth_chainId', mockSnapshotSuccessAdvertised, [], 'http://localhost:8545')).toBe('advertised');
    expect(getMethodEvidenceStatus('eth_chainId', null, [], 'http://localhost:8545')).toBe('unknown');
  });

  it('handles empty snapshot correctly', () => {
    expect(getMethodEvidenceStatus('eth_chainId', null, historySuccess, 'http://localhost:8545')).toBe('confirmed');
    expect(getMethodEvidenceStatus('eth_getBalance', null, historyUnsupported, 'http://localhost:8545')).toBe('unsupported');
    expect(getMethodEvidenceStatus('eth_getBalance', null, historyInvalidResponse, 'http://localhost:8545')).toBe('unknown');
    expect(getMethodEvidenceStatus('eth_getBalance', null, [], 'http://localhost:8545')).toBe('unknown');
  });

  it('does not treat generic message text without code -32601 as unsupported', () => {
    const unsupportedHistory: DiagnosticHistoryItem[] = [
      {
        id: '7',
        endpoint: 'http://localhost:8545',
        timestamp: fixedTimestamp,
        request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 7 },
        response: { jsonrpc: '2.0', error: { code: -32000, message: 'Method not found, sorry!' }, id: 7 },
        latency: 10,
        error: 'Method not found, sorry!',
        success: false,
      },
    ];
    expect(getMethodEvidenceStatus('eth_getBalance', null, unsupportedHistory, 'http://localhost:8545')).toBe('unknown');
  });

  it('maps non-method-not-found errors to unknown (only confirmed/advertised/unsupported/unknown exist)', () => {
    const invalidResponseHistory: DiagnosticHistoryItem[] = [
      {
        id: '8',
        endpoint: 'http://localhost:8545',
        timestamp: fixedTimestamp,
        request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 8 },
        response: { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: 8 },
        latency: 10,
        error: 'Invalid Request',
        success: false,
      },
      {
        id: '9',
        endpoint: 'http://localhost:8545',
        timestamp: fixedTimestamp,
        request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 9 },
        response: null,
        latency: 10,
        error: 'Invalid JSON',
        success: false,
      },
    ];
    expect(getMethodEvidenceStatus('eth_getBalance', null, invalidResponseHistory, 'http://localhost:8545')).toBe('unknown');
  });

  it('requires code -32601 for unsupported; network/transport errors and generic text stay unknown', () => {
    const genuine: DiagnosticHistoryItem[] = [
      {
        id: 't1',
        endpoint: 'http://localhost:8545',
        timestamp: fixedTimestamp,
        request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 11 },
        response: { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 11 },
        latency: 5,
        error: 'JSON-RPC Error [-32601]: Method not found',
        success: false,
      },
    ];
    expect(getMethodEvidenceStatus('eth_getBalance', null, genuine, 'http://localhost:8545')).toBe('unsupported');

    const networkCases: DiagnosticHistoryItem[][] = [
      [
        {
          id: 'n1',
          endpoint: 'http://localhost:8545',
          timestamp: fixedTimestamp,
          request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 12 },
          response: null,
          latency: null,
          error: 'Network or CORS Error: Could not connect to http://localhost:8545. Ensure the endpoint is reachable and allows browser CORS requests.',
          success: false,
        },
      ],
      [
        {
          id: 'n2',
          endpoint: 'http://localhost:8545',
          timestamp: fixedTimestamp,
          request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 13 },
          response: null,
          latency: 8000,
          error: 'Request timeout after 8000ms',
          success: false,
        },
      ],
      [
        {
          id: 'n3',
          endpoint: 'http://localhost:8545',
          timestamp: fixedTimestamp,
          request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 14 },
          response: null,
          latency: 10,
          error: 'HTTP Error: 502 Bad Gateway',
          success: false,
        },
      ],
      [
        {
          id: 'n4',
          endpoint: 'http://localhost:8545',
          timestamp: fixedTimestamp,
          request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 15 },
          response: null,
          latency: 10,
          error: 'Method not found',
          success: false,
        },
      ],
      [
        {
          id: 'n5',
          endpoint: 'http://localhost:8545',
          timestamp: fixedTimestamp,
          request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 16 },
          response: { jsonrpc: '2.0', error: { code: -32600, message: 'Method not found?' }, id: 16 },
          latency: 10,
          error: 'JSON-RPC Error [-32600]: Method not found?',
          success: false,
        },
      ],
    ];
    for (const h of networkCases) {
      expect(getMethodEvidenceStatus('eth_getBalance', null, h, 'http://localhost:8545')).toBe('unknown');
    }
  });
});

describe('formatEvidenceLabel', () => {
  it('formats confirmed status', () => {
    expect(formatEvidenceLabel('confirmed')).toBe('Confirmed (Tested Successfully)');
  });

  it('formats advertised status', () => {
    expect(formatEvidenceLabel('advertised')).toBe('Advertised — Not Yet Tested');
  });

  it('formats unsupported status', () => {
    expect(formatEvidenceLabel('unsupported')).toBe('Unsupported (Method Not Found)');
  });

  it('formats unknown status', () => {
    expect(formatEvidenceLabel('unknown')).toBe('Status Unknown');
  });

  it('maps deprecated invalid_response input to unknown label', () => {
    expect(formatEvidenceLabel('invalid_response' as unknown as 'unknown')).toBe('Status Unknown');
  });
});

describe('Profile fallback when no usable capability snapshot exists', () => {
  it('preserves EVM profile defaults with null snapshot', () => {
    expect(defaultLatencyMethodForProfile('portaldot_v3_evm')).toBe('eth_chainId');
    expect(defaultClientVersionMethodForProfile('portaldot_v3_evm')).toBe('web3_clientVersion');
    expect(defaultBlockMethodForProfile('portaldot_v3_evm')).toBe('eth_blockNumber');
    expect(hasPeerCountSupport('portaldot_v3_evm')).toBe(false);
    expect(defaultPeerMethodForProfile('portaldot_v3_evm')).toBeNull();
  });

  it('preserves generic_http profile defaults with null snapshot', () => {
    expect(defaultLatencyMethodForProfile('generic_http')).toBe('system_health');
    expect(defaultClientVersionMethodForProfile('generic_http')).toBe('system_version');
    expect(defaultBlockMethodForProfile('generic_http')).toBe('chain_getHeader');
    expect(hasPeerCountSupport('generic_http')).toBe(true);
    expect(defaultPeerMethodForProfile('generic_http')).toBe('system_health');
  });

  it('does not mutate or dispatch network requests during evidence lookup', () => {
    // Pure function check: getMethodEvidenceStatus must be synchronous and pure
    const snapshotCopy = JSON.parse(JSON.stringify(mockSnapshotSuccessAdvertised));
    const historyCopy: DiagnosticHistoryItem[] = [];
    const status = getMethodEvidenceStatus('eth_chainId', snapshotCopy, historyCopy, 'http://localhost:8545');
    expect(status).toBe('advertised');
    expect(historyCopy.length).toBe(0);
    expect(snapshotCopy.safeAdvertisedMethods.length).toBe(3);
  });
});

describe('Endpoint scoping and recency (P2 refinements)', () => {
  it('does not use snapshot advertisement from a different endpoint origin', () => {
    expect(
      getMethodEvidenceStatus('eth_chainId', mockSnapshotSuccessAdvertised, [], 'https://other.example:9999')
    ).toBe('unknown');
  });

  it('does not use history from a different endpoint origin', () => {
    const otherEndpointHistory: DiagnosticHistoryItem[] = [
      {
        id: 'x1',
        endpoint: 'https://other.example:9999',
        timestamp: fixedTimestamp,
        request: { jsonrpc: '2.0', method: 'eth_chainId', id: 1 },
        response: { jsonrpc: '2.0', result: '0x539', id: 1 },
        latency: 5,
        error: null,
        success: true,
      },
    ];
    // History origin mismatches current endpoint, so it must not confer confirmed
    expect(
      getMethodEvidenceStatus('eth_chainId', null, otherEndpointHistory, 'http://localhost:8545')
    ).toBe('unknown');
  });

  it('resolves conflicting evidence by recency using timestamp (newer wins)', () => {
    const mixedHistory: DiagnosticHistoryItem[] = [
      {
        id: 'older-success',
        endpoint: 'http://localhost:8545',
        timestamp: fixedTimestamp,
        request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 1 },
        response: { jsonrpc: '2.0', result: '0x1', id: 1 },
        latency: 5,
        error: null,
        success: true,
      },
      {
        id: 'newer-unsupported',
        endpoint: 'http://localhost:8545',
        timestamp: fixedTimestamp + 1000,
        request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 2 },
        response: { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 2 },
        latency: 5,
        error: 'Method not found',
        success: false,
      },
    ];
    expect(getMethodEvidenceStatus('eth_getBalance', null, mixedHistory, 'http://localhost:8545')).toBe('unsupported');

    const reversed: DiagnosticHistoryItem[] = [
      {
        id: 'newer-success',
        endpoint: 'http://localhost:8545',
        timestamp: fixedTimestamp + 1000,
        request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 1 },
        response: { jsonrpc: '2.0', result: '0x1', id: 1 },
        latency: 5,
        error: null,
        success: true,
      },
      {
        id: 'older-unsupported',
        endpoint: 'http://localhost:8545',
        timestamp: fixedTimestamp,
        request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 2 },
        response: { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 2 },
        latency: 5,
        error: 'Method not found',
        success: false,
      },
    ];
    expect(getMethodEvidenceStatus('eth_getBalance', null, reversed, 'http://localhost:8545')).toBe('confirmed');
  });

  it('falls back to array position when timestamps are equal (deterministic tie-break)', () => {
    const equalTs: DiagnosticHistoryItem[] = [
      {
        id: 'first',
        endpoint: 'http://localhost:8545',
        timestamp: fixedTimestamp,
        request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 1 },
        response: { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 1 },
        latency: 5,
        error: 'Method not found',
        success: false,
      },
      {
        id: 'second',
        endpoint: 'http://localhost:8545',
        timestamp: fixedTimestamp,
        request: { jsonrpc: '2.0', method: 'eth_getBalance', id: 2 },
        response: { jsonrpc: '2.0', result: '0x1', id: 2 },
        latency: 5,
        error: null,
        success: true,
      },
    ];
    // Both have same timestamp; earlier array position wins deterministically -> unsupported
    expect(getMethodEvidenceStatus('eth_getBalance', null, equalTs, 'http://localhost:8545')).toBe('unsupported');
  });
});
