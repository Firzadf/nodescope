import { describe, expect, it } from 'vitest';
import {
  analyzeCrossEndpoint,
  extractChainId,
  HEIGHT_GAP_FINDING_THRESHOLD_BLOCKS,
} from './crossEndpointAnalysis';
import { compareSnapshots } from './snapshotComparer';
import {
  HEALTH_SNAPSHOT_SCHEMA_VERSION,
  type HealthCheckCheck,
  type HealthCheckSnapshot,
} from '../types/healthCheck';

function createCheck(overrides: Partial<HealthCheckCheck> = {}): HealthCheckCheck {
  return {
    method: 'eth_chainId',
    outcome: 'success',
    success: true,
    latencyMs: 40,
    observedValue: '0x190f1ca9',
    error: null,
    ...overrides,
  };
}

function createSnapshot(overrides: Partial<HealthCheckSnapshot> = {}): HealthCheckSnapshot {
  return {
    schemaVersion: HEALTH_SNAPSHOT_SCHEMA_VERSION,
    id: 'snap-1',
    timestamp: 1700000000000,
    exportedAt: '2023-11-14T22:13:20.000Z',
    endpointOrigin: 'https://a.example.test',
    endpointProfile: 'portaldot_v3_evm',
    checks: [],
    findings: [],
    ...overrides,
  };
}

const evmChecks = (chainId: string, blockHex: string, version = 'eth-rpc/test'): HealthCheckCheck[] => [
  createCheck({ method: 'eth_chainId', observedValue: chainId }),
  createCheck({ method: 'eth_blockNumber', observedValue: blockHex, latencyMs: 55 }),
  createCheck({ method: 'web3_clientVersion', observedValue: version, latencyMs: 30 }),
  createCheck({ method: 'net_version', observedValue: '420420777', latencyMs: 20 }),
];

describe('analyzeCrossEndpoint', () => {
  it('returns null for a like-for-like pair (same origin and profile)', () => {
    const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100') });
    const b = createSnapshot({
      id: 'snap-2',
      checks: evmChecks('0x190f1ca9', '0x110'),
    });
    expect(analyzeCrossEndpoint(a, b)).toBeNull();
    // And compareSnapshots still classifies the pair exactly as before.
    expect(compareSnapshots(a, b).mode).toBe('like_for_like');
  });

  it('activates when only the profile differs (same origin)', () => {
    const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100') });
    const b = createSnapshot({
      id: 'snap-2',
      endpointProfile: 'generic_http',
      checks: [
        createCheck({ method: 'eth_chainId', observedValue: '0x190f1ca9' }),
        createCheck({ method: 'chain_getHeader', observedValue: '0x100' }),
      ],
    });
    const result = analyzeCrossEndpoint(a, b);
    expect(result).not.toBeNull();
    expect(result?.chainRelation).toBe('same_chain');
    expect(compareSnapshots(a, b).mode).toBe('cross_endpoint');
  });

  it('extracts chain identity from eth_chainId, falling back to net_version', () => {
    const hexSnap = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100') });
    expect(extractChainId(hexSnap)).toBe('420420777');

    const fallbackSnap = createSnapshot({
      checks: [
        createCheck({ method: 'eth_chainId', outcome: 'rpc_error', success: false, observedValue: null, error: 'boom' }),
        createCheck({ method: 'net_version', observedValue: '420420777' }),
      ],
    });
    expect(extractChainId(fallbackSnap)).toBe('420420777');

    const noIdentity = createSnapshot({
      checks: [
        createCheck({ method: 'eth_chainId', outcome: 'unsupported_method', success: false, observedValue: null, error: 'JSON-RPC Error [-32601]' }),
      ],
    });
    expect(extractChainId(noIdentity)).toBeNull();
  });

  describe('cross-endpoint, same chain', () => {
    it('shows the block delta as an exact BigInt string with no gap finding for a small gap', () => {
      const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100') }); // 256
      const b = createSnapshot({
        id: 'snap-2',
        endpointOrigin: 'https://b.example.test',
        timestamp: 1700000060000,
        exportedAt: '2023-11-14T22:14:20.000Z',
        checks: evmChecks('0x190f1ca9', '0x105'), // 261
      });
      const result = analyzeCrossEndpoint(a, b);
      expect(result?.chainRelation).toBe('same_chain');
      expect(result?.chainIdA).toBe('420420777');
      expect(result?.chainIdB).toBe('420420777');
      expect(result?.blockDelta.status).toBe('available');
      expect(result?.blockDelta.a).toBe('256');
      expect(result?.blockDelta.b).toBe('261');
      expect(result?.blockDelta.delta).toBe('5');
      expect(result?.findings.map((f) => f.ruleId)).not.toContain('cross_endpoint_height_gap');
    });

    it('fires the height-gap finding with "behind" wording at/above the threshold', () => {
      const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x200') }); // 512
      const b = createSnapshot({
        id: 'snap-2',
        endpointOrigin: 'https://b.example.test',
        timestamp: 1700000060000,
        exportedAt: '2023-11-14T22:14:20.000Z',
        checks: evmChecks('0x190f1ca9', '0x100'), // 256 -> delta -256
      });
      const result = analyzeCrossEndpoint(a, b);
      expect(result?.blockDelta.delta).toBe('-256');
      const gap = result?.findings.find((f) => f.ruleId === 'cross_endpoint_height_gap');
      expect(gap).toBeDefined();
      expect(gap?.severity).toBe('warning');
      expect(gap?.evidence).toContain('Endpoint B is 256 blocks behind endpoint A at check time');
      expect(HEIGHT_GAP_FINDING_THRESHOLD_BLOCKS).toBeLessThanOrEqual(256);
    });

    it('fires the height-gap finding with "ahead" wording when B is far ahead', () => {
      const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100') }); // 256
      const b = createSnapshot({
        id: 'snap-2',
        endpointOrigin: 'https://b.example.test',
        timestamp: 1700000060000,
        exportedAt: '2023-11-14T22:14:20.000Z',
        checks: evmChecks('0x190f1ca9', '0x200'), // 512 -> delta +256
      });
      const gap = analyzeCrossEndpoint(a, b)?.findings.find(
        (f) => f.ruleId === 'cross_endpoint_height_gap'
      );
      expect(gap?.evidence).toContain('Endpoint B is 256 blocks ahead of endpoint A at check time');
    });

    it('does not fire the gap finding just below the threshold', () => {
      const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100') }); // 256
      const b = createSnapshot({
        id: 'snap-2',
        endpointOrigin: 'https://b.example.test',
        checks: evmChecks('0x190f1ca9', '0x163'), // 355 -> delta +99 < 100
      });
      const result = analyzeCrossEndpoint(a, b);
      expect(result?.blockDelta.status).toBe('available');
      expect(result?.blockDelta.delta).toBe('99');
      expect(result?.findings.map((f) => f.ruleId)).not.toContain('cross_endpoint_height_gap');
    });

    it('keeps the delta available but never fabricates heights when one side failed its block check', () => {
      const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100') });
      const b = createSnapshot({
        id: 'snap-2',
        endpointOrigin: 'https://b.example.test',
        checks: [
          createCheck({ method: 'eth_chainId', observedValue: '0x190f1ca9' }),
          createCheck({ method: 'eth_blockNumber', outcome: 'network_error', success: false, observedValue: null, error: 'Failed to fetch' }),
        ],
      });
      const result = analyzeCrossEndpoint(a, b);
      expect(result?.chainRelation).toBe('same_chain');
      expect(result?.blockDelta.status).toBe('unavailable');
      expect(result?.blockDelta.delta).toBeNull();
      expect(result?.blockDelta.a).toBe('256');
      expect(result?.blockDelta.b).toBeNull();
    });
  });

  describe('cross-endpoint, different chains', () => {
    it('marks the delta not comparable, never computes it, and leads with an error finding', () => {
      const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100') });
      const b = createSnapshot({
        id: 'snap-2',
        endpointOrigin: 'https://other-chain.example.test',
        checks: evmChecks('0x1', '0x999', 'geth/other'),
      });
      const result = analyzeCrossEndpoint(a, b);
      expect(result?.chainRelation).toBe('different_chain');
      expect(result?.chainIdA).toBe('420420777');
      expect(result?.chainIdB).toBe('1');
      expect(result?.blockDelta.status).toBe('not_comparable');
      expect(result?.blockDelta.delta).toBeNull();
      // Heights are still reported as facts about each side.
      expect(result?.blockDelta.a).toBe('256');
      expect(result?.blockDelta.b).toBe('2457');
      const first = result?.findings[0];
      expect(first?.ruleId).toBe('cross_endpoint_different_chain');
      expect(first?.severity).toBe('error');
      expect(first?.evidence).toContain('420420777');
      expect(first?.evidence).toContain('chain ID 1');
      // No gap finding may be derived across chains.
      expect(result?.findings.map((f) => f.ruleId)).not.toContain('cross_endpoint_height_gap');
    });
  });

  describe('cross-endpoint, unknown chain identity', () => {
    it('keeps the delta unavailable and fires no chain findings', () => {
      const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100') });
      const b = createSnapshot({
        id: 'snap-2',
        endpointOrigin: 'https://b.example.test',
        checks: [
          createCheck({ method: 'eth_chainId', outcome: 'network_error', success: false, observedValue: null, error: 'Failed to fetch' }),
          createCheck({ method: 'eth_blockNumber', observedValue: '0x200' }),
        ],
      });
      const result = analyzeCrossEndpoint(a, b);
      expect(result?.chainRelation).toBe('unknown');
      expect(result?.chainIdB).toBeNull();
      expect(result?.blockDelta.status).toBe('unavailable');
      expect(result?.blockDelta.delta).toBeNull();
      expect(result?.findings).toEqual([]);
    });

    it('does not derive a delta for generic profiles from heights alone when chain identity is unknown', () => {
      const genericChecks = (blockHex: string): HealthCheckCheck[] => [
        createCheck({ method: 'system_health', observedValue: 12 }),
        createCheck({ method: 'system_version', observedValue: '1.0.0' }),
        createCheck({ method: 'chain_getHeader', observedValue: blockHex }),
        createCheck({ method: 'eth_chainId', outcome: 'unsupported_method', success: false, observedValue: null, error: 'JSON-RPC Error [-32601]' }),
      ];
      const a = createSnapshot({
        endpointOrigin: 'https://sub-a.example.test',
        endpointProfile: 'generic_http',
        checks: genericChecks('0x100'),
      });
      const b = createSnapshot({
        id: 'snap-2',
        endpointOrigin: 'https://sub-b.example.test',
        endpointProfile: 'generic_http',
        checks: genericChecks('0x200'),
      });
      const result = analyzeCrossEndpoint(a, b);
      expect(result?.chainRelation).toBe('unknown');
      expect(result?.blockDelta.status).toBe('unavailable');
      expect(result?.blockDelta.delta).toBeNull();
      expect(result?.findings.map((f) => f.ruleId)).not.toContain('cross_endpoint_height_gap');
    });
  });

  describe('support-matrix differences', () => {
    const withSupport = (bVersionOutcome: 'success' | 'unsupported_method') => {
      const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100') });
      const bChecks = evmChecks('0x190f1ca9', '0x100');
      bChecks[2] =
        bVersionOutcome === 'success'
          ? createCheck({ method: 'web3_clientVersion', observedValue: 'eth-rpc/test' })
          : createCheck({
              method: 'web3_clientVersion',
              outcome: 'unsupported_method',
              success: false,
              observedValue: null,
              error: 'JSON-RPC Error [-32601]: the method web3_clientVersion does not exist',
            });
      const b = createSnapshot({
        id: 'snap-2',
        endpointOrigin: 'https://b.example.test',
        checks: bChecks,
      });
      return analyzeCrossEndpoint(a, b);
    };

    it('fires when a method succeeds on A and is unsupported on B', () => {
      const result = withSupport('unsupported_method');
      const finding = result?.findings.find((f) => f.ruleId === 'cross_endpoint_method_support_diff');
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe('warning');
      expect(finding?.title).toContain('web3_clientVersion');
      expect(finding?.evidence).toContain('https://a.example.test');
      expect(finding?.evidence).toContain('https://b.example.test');
    });

    it('fires in the reverse direction (unsupported on A, success on B)', () => {
      const a = createSnapshot({
        checks: [
          createCheck({ method: 'eth_chainId', observedValue: '0x190f1ca9' }),
          createCheck({ method: 'net_version', outcome: 'unsupported_method', success: false, observedValue: null, error: 'JSON-RPC Error [-32601]' }),
        ],
      });
      const b = createSnapshot({
        id: 'snap-2',
        endpointOrigin: 'https://b.example.test',
        checks: [
          createCheck({ method: 'eth_chainId', observedValue: '0x190f1ca9' }),
          createCheck({ method: 'net_version', observedValue: '420420777' }),
        ],
      });
      const finding = analyzeCrossEndpoint(a, b)?.findings.find(
        (f) => f.ruleId === 'cross_endpoint_method_support_diff'
      );
      expect(finding?.title).toContain('net_version');
      expect(finding?.evidence).toContain('succeeded on endpoint B');
    });

    it('does not fire when the method is unsupported on both sides', () => {
      const checks = [
        createCheck({ method: 'eth_chainId', observedValue: '0x190f1ca9' }),
        createCheck({ method: 'net_version', outcome: 'unsupported_method', success: false, observedValue: null, error: 'JSON-RPC Error [-32601]' }),
      ];
      const a = createSnapshot({ checks });
      const b = createSnapshot({ id: 'snap-2', endpointOrigin: 'https://b.example.test', checks });
      const result = analyzeCrossEndpoint(a, b);
      expect(result?.findings.map((f) => f.ruleId)).not.toContain('cross_endpoint_method_support_diff');
    });

    it('does not fire for a method missing from one snapshot entirely', () => {
      const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100') });
      const b = createSnapshot({
        id: 'snap-2',
        endpointOrigin: 'https://b.example.test',
        checks: evmChecks('0x190f1ca9', '0x100').filter((c) => c.method !== 'web3_clientVersion'),
      });
      const result = analyzeCrossEndpoint(a, b);
      expect(result?.findings.map((f) => f.ruleId)).not.toContain('cross_endpoint_method_support_diff');
      expect(result?.findings.map((f) => f.ruleId)).not.toContain('cross_endpoint_client_version_diff');
    });
  });

  describe('client-version differences', () => {
    it('fires as info when the same-profile version strings differ', () => {
      const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100', 'eth-rpc/main-aaa') });
      const b = createSnapshot({
        id: 'snap-2',
        endpointOrigin: 'https://b.example.test',
        checks: evmChecks('0x190f1ca9', '0x100', 'eth-rpc/main-bbb'),
      });
      const finding = analyzeCrossEndpoint(a, b)?.findings.find(
        (f) => f.ruleId === 'cross_endpoint_client_version_diff'
      );
      expect(finding?.severity).toBe('info');
      expect(finding?.evidence).toContain('eth-rpc/main-aaa');
      expect(finding?.evidence).toContain('eth-rpc/main-bbb');
    });

    it('does not fire when versions are identical', () => {
      const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100') });
      const b = createSnapshot({
        id: 'snap-2',
        endpointOrigin: 'https://b.example.test',
        checks: evmChecks('0x190f1ca9', '0x100'),
      });
      expect(analyzeCrossEndpoint(a, b)?.findings).toEqual([]);
    });

    it('does not compare version strings across different profiles', () => {
      const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x100', 'eth-rpc/main') });
      const b = createSnapshot({
        id: 'snap-2',
        endpointProfile: 'generic_http',
        checks: [
          createCheck({ method: 'system_version', observedValue: '1.5.0-node' }),
          createCheck({ method: 'eth_chainId', observedValue: '0x190f1ca9' }),
          createCheck({ method: 'chain_getHeader', observedValue: '0x100' }),
        ],
      });
      const result = analyzeCrossEndpoint(a, b);
      expect(result?.findings.map((f) => f.ruleId)).not.toContain('cross_endpoint_client_version_diff');
    });
  });

  it('does not mutate inputs and is deterministic', () => {
    const a = createSnapshot({ checks: evmChecks('0x190f1ca9', '0x200', 'eth-rpc/aaa') });
    const b = createSnapshot({
      id: 'snap-2',
      endpointOrigin: 'https://b.example.test',
      timestamp: 1700000060000,
      exportedAt: '2023-11-14T22:14:20.000Z',
      checks: evmChecks('0x190f1ca9', '0x100', 'eth-rpc/bbb'),
    });
    const beforeA = JSON.stringify(a);
    const beforeB = JSON.stringify(b);
    const first = analyzeCrossEndpoint(a, b);
    const second = analyzeCrossEndpoint(a, b);
    expect(JSON.stringify(a)).toBe(beforeA);
    expect(JSON.stringify(b)).toBe(beforeB);
    expect(second).toEqual(first);
    expect(first?.findings.map((f) => f.ruleId)).toEqual([
      'cross_endpoint_height_gap',
      'cross_endpoint_client_version_diff',
    ]);
  });
});
