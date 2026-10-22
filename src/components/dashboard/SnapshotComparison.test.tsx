// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SnapshotComparison } from './SnapshotComparison';
import { HEALTH_SNAPSHOT_SCHEMA_VERSION, type HealthCheckSnapshot } from '../../types/healthCheck';

function createSnapshot(overrides: Partial<HealthCheckSnapshot> = {}): HealthCheckSnapshot {
  return {
    schemaVersion: HEALTH_SNAPSHOT_SCHEMA_VERSION,
    id: 'snap-1',
    timestamp: 1700000000000,
    exportedAt: '2026-10-21T00:00:00.000Z',
    endpointOrigin: 'https://rpc.example.test',
    endpointProfile: 'portaldot_v3_evm',
    checks: [],
    findings: [],
    ...overrides,
  };
}

describe('SnapshotComparison UI', () => {
  afterEach(() => {
    cleanup();
  });
  it('shows an explicit empty state when fewer than 2 snapshots exist', () => {
    const { rerender } = render(<SnapshotComparison snapshots={[]} />);
    expect(screen.getByText(/At least 2 health snapshots required to compare/i)).toBeInTheDocument();
    expect(screen.getByText(/Currently 0 available/i)).toBeInTheDocument();

    rerender(<SnapshotComparison snapshots={[createSnapshot({ id: 'only-one' })]} />);
    expect(screen.getByText(/Currently 1 available/i)).toBeInTheDocument();
  });

  it('defaults to A = older and B = newer when at least 2 snapshots are provided', () => {
    const snapOlder = createSnapshot({
      id: 'snap-older',
      timestamp: 1700000000000,
      checks: [
        {
          method: 'eth_chainId',
          outcome: 'success',
          success: true,
          latencyMs: 30,
          observedValue: '0x190f1ca9',
          error: null,
        },
      ],
    });
    const snapNewer = createSnapshot({
      id: 'snap-newer',
      timestamp: 1700000010000,
      checks: [
        {
          method: 'eth_chainId',
          outcome: 'success',
          success: true,
          latencyMs: 45,
          observedValue: '0x190f1ca9',
          error: null,
        },
      ],
    });

    // Storage orders snapshots newest first: [snapNewer, snapOlder]
    render(<SnapshotComparison snapshots={[snapNewer, snapOlder]} />);

    const selectA = screen.getByLabelText('Snapshot A (Baseline)') as HTMLSelectElement;
    const selectB = screen.getByLabelText('Snapshot B (Current)') as HTMLSelectElement;

    expect(selectA.value).toBe('snap-older');
    expect(selectB.value).toBe('snap-newer');
    expect(screen.getByText(/Mode: Like-for-Like/i)).toBeInTheDocument();
  });

  it('updates comparison when user selects different snapshots', () => {
    const snap1 = createSnapshot({ id: 's1', timestamp: 1000 });
    const snap2 = createSnapshot({ id: 's2', timestamp: 2000 });
    const snap3 = createSnapshot({ id: 's3', timestamp: 3000 });

    render(<SnapshotComparison snapshots={[snap3, snap2, snap1]} />);

    const selectA = screen.getByLabelText('Snapshot A (Baseline)') as HTMLSelectElement;
    fireEvent.change(selectA, { target: { value: 's3' } });

    expect(selectA.value).toBe('s3');
  });

  it('displays a prominent warning for cross-endpoint/profile comparison while showing diffs', () => {
    const snapEvm = createSnapshot({
      id: 'snap-evm',
      endpointOrigin: 'https://evm.example.test',
      endpointProfile: 'portaldot_v3_evm',
      checks: [
        {
          method: 'eth_chainId',
          outcome: 'success',
          success: true,
          latencyMs: 25,
          observedValue: '0x190f1ca9',
          error: null,
        },
      ],
    });
    const snapGeneric = createSnapshot({
      id: 'snap-generic',
      endpointOrigin: 'https://generic.example.test',
      endpointProfile: 'generic_http',
      checks: [
        {
          method: 'eth_chainId',
          outcome: 'unsupported_method',
          success: false,
          latencyMs: 15,
          observedValue: null,
          error: 'JSON-RPC Error [-32601]',
        },
      ],
    });

    render(<SnapshotComparison snapshots={[snapGeneric, snapEvm]} />);

    expect(screen.getByText(/Cross-Endpoint \/ Profile Comparison/i)).toBeInTheDocument();
    expect(screen.getByText(/Mode: Cross-Endpoint/i)).toBeInTheDocument();
    expect(screen.getByText(/endpoint origin/i)).toBeInTheDocument();
    expect(screen.getByText(/endpoint profile/i)).toBeInTheDocument();
    // Method diff is still rendered descriptively
    expect(screen.getByText('eth_chainId')).toBeInTheDocument();
  });

  it('displays block height delta as decimal string and displays status explicitly without converting to Number', () => {
    const snapA = createSnapshot({
      id: 'snap-a',
      checks: [
        {
          method: 'eth_blockNumber',
          outcome: 'success',
          success: true,
          latencyMs: 30,
          observedValue: '0xfffffffffffff',
          error: null,
        },
      ],
    });
    const snapB = createSnapshot({
      id: 'snap-b',
      checks: [
        {
          method: 'eth_blockNumber',
          outcome: 'success',
          success: true,
          latencyMs: 32,
          observedValue: '0x10000000000000',
          error: null,
        },
      ],
    });

    render(<SnapshotComparison snapshots={[snapB, snapA]} />);

    expect(screen.getByText(/\+1 blocks/i)).toBeInTheDocument();
    expect(screen.getByText('4503599627370495')).toBeInTheDocument();
    expect(screen.getByText('4503599627370496')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('displays explicit status and never shows 0 for unavailable block height delta', () => {
    const snapA = createSnapshot({
      id: 'snap-a',
      checks: [],
    });
    const snapB = createSnapshot({
      id: 'snap-b',
      checks: [
        {
          method: 'eth_blockNumber',
          outcome: 'success',
          success: true,
          latencyMs: 32,
          observedValue: '0x64',
          error: null,
        },
      ],
    });

    render(<SnapshotComparison snapshots={[snapB, snapA]} />);

    expect(screen.getByText(/Unavailable \(Missing block height check in snapshot\)/i)).toBeInTheDocument();
    // Verify no fake "0 blocks" or numeric zero is rendered for unavailable delta
    expect(screen.queryByText(/0 blocks/i)).not.toBeInTheDocument();
  });

  it('distinguishes null from empty string and zero in observed values', () => {
    const snapA = createSnapshot({
      id: 'snap-a',
      checks: [
        {
          method: 'test_null',
          outcome: 'success',
          success: true,
          latencyMs: 20,
          observedValue: null,
          error: null,
        },
      ],
    });
    const snapB = createSnapshot({
      id: 'snap-b',
      checks: [
        {
          method: 'test_null',
          outcome: 'success',
          success: true,
          latencyMs: 25,
          observedValue: '',
          error: null,
        },
      ],
    });

    render(<SnapshotComparison snapshots={[snapB, snapA]} />);

    expect(screen.getByText(/null \(unavailable\)/i)).toBeInTheDocument();
    expect(screen.getByText(/"" \(empty string\)/i)).toBeInTheDocument();
  });

  it('renders check changes and latency delta accurately', () => {
    const snapA = createSnapshot({
      id: 'snap-a',
      checks: [
        {
          method: 'eth_chainId',
          outcome: 'success',
          success: true,
          latencyMs: 40,
          observedValue: '0x1',
          error: null,
        },
        {
          method: 'removed_method',
          outcome: 'success',
          success: true,
          latencyMs: 10,
          observedValue: 'foo',
          error: null,
        },
      ],
    });
    const snapB = createSnapshot({
      id: 'snap-b',
      checks: [
        {
          method: 'eth_chainId',
          outcome: 'network_error',
          success: false,
          latencyMs: null,
          observedValue: null,
          error: 'Timeout',
        },
        {
          method: 'added_method',
          outcome: 'success',
          success: true,
          latencyMs: 15,
          observedValue: 'bar',
          error: null,
        },
      ],
    });

    render(<SnapshotComparison snapshots={[snapB, snapA]} />);

    expect(screen.getByText('+ Added in B')).toBeInTheDocument();
    expect(screen.getByText('- Removed in B')).toBeInTheDocument();
    expect(screen.getByText('Changed')).toBeInTheDocument();
    expect(screen.getAllByText(/Unavailable \(missing in B\)/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders categorized diagnostic findings', () => {
    const snapA = createSnapshot({
      id: 'snap-a',
      findings: [
        {
          ruleId: 'resolved-rule',
          severity: 'warning',
          title: 'Resolved Warning',
          evidence: 'old issue',
          explanation: 'explained',
          recommendation: 'fixed',
        },
        {
          ruleId: 'unchanged-rule',
          severity: 'info',
          title: 'Unchanged Info',
          evidence: 'steady state',
          explanation: 'explained',
          recommendation: 'no action',
        },
      ],
    });
    const snapB = createSnapshot({
      id: 'snap-b',
      findings: [
        {
          ruleId: 'unchanged-rule',
          severity: 'info',
          title: 'Unchanged Info',
          evidence: 'steady state',
          explanation: 'explained',
          recommendation: 'no action',
        },
        {
          ruleId: 'new-rule',
          severity: 'error',
          title: 'New Error',
          evidence: 'new failure',
          explanation: 'explained',
          recommendation: 'investigate',
        },
      ],
    });

    render(<SnapshotComparison snapshots={[snapB, snapA]} />);

    expect(screen.getByText('Resolved in B')).toBeInTheDocument();
    expect(screen.getByText('Resolved Warning')).toBeInTheDocument();
    expect(screen.getByText('New in B')).toBeInTheDocument();
    expect(screen.getByText('New Error')).toBeInTheDocument();
    expect(screen.getByText('Unchanged Info')).toBeInTheDocument();
  });

  it('never mutates input snapshots array or snapshot objects', () => {
    const snapA = createSnapshot({
      id: 'snap-a',
      checks: [
        {
          method: 'eth_chainId',
          outcome: 'success',
          success: true,
          latencyMs: 10,
          observedValue: '0x1',
          error: null,
        },
      ],
      findings: [
        {
          ruleId: 'r1',
          severity: 'info',
          title: 'T1',
          evidence: 'E1',
          explanation: 'Ex1',
          recommendation: 'Rec1',
        },
      ],
    });
    const snapB = createSnapshot({
      id: 'snap-b',
      checks: [
        {
          method: 'eth_chainId',
          outcome: 'success',
          success: true,
          latencyMs: 15,
          observedValue: '0x1',
          error: null,
        },
      ],
    });

    const snapshots = [snapB, snapA];
    const cloneBefore = structuredClone(snapshots);

    render(<SnapshotComparison snapshots={snapshots} />);

    expect(snapshots).toEqual(cloneBefore);
  });

  it('shows a caveated block delta and names both endpoints for a cross-endpoint same-chain pair', () => {
    const evmChecks = (blockHex: string) => [
      { method: 'eth_chainId', outcome: 'success' as const, success: true, latencyMs: 25, observedValue: '0x190f1ca9', error: null },
      { method: 'eth_blockNumber', outcome: 'success' as const, success: true, latencyMs: 40, observedValue: blockHex, error: null },
      { method: 'web3_clientVersion', outcome: 'success' as const, success: true, latencyMs: 30, observedValue: 'eth-rpc/test', error: null },
      { method: 'net_version', outcome: 'success' as const, success: true, latencyMs: 20, observedValue: '420420777', error: null },
    ];
    const snapA = createSnapshot({
      id: 'snap-a',
      timestamp: 1700000000000,
      endpointOrigin: 'https://a.example.test',
      checks: evmChecks('0x100'), // 256
    });
    const snapB = createSnapshot({
      id: 'snap-b',
      timestamp: 1700000060000,
      endpointOrigin: 'https://b.example.test',
      checks: evmChecks('0x105'), // 261
    });

    render(<SnapshotComparison snapshots={[snapB, snapA]} />);

    expect(screen.getByText(/Mode: Cross-Endpoint/i)).toBeInTheDocument();
    expect(screen.getByText(/Both endpoints reported chain ID 420420777/i)).toBeInTheDocument();
    // Both endpoints named in the banner (and again under the selectors).
    expect(screen.getAllByText(/https:\/\/a\.example\.test/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/https:\/\/b\.example\.test/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Available \(Cross-Endpoint\)/i)).toBeInTheDocument();
    expect(screen.getByText(/\+5 blocks/)).toBeInTheDocument();
    // The sync-point caveat appears in both the banner and under the delta itself.
    expect(screen.getAllByText(/endpoints may be at different sync points/i).length).toBeGreaterThanOrEqual(2);
  });

  it('withholds the block delta as not comparable and shows the error finding for different chains', () => {
    const snapA = createSnapshot({
      id: 'snap-a',
      timestamp: 1700000000000,
      endpointOrigin: 'https://a.example.test',
      checks: [
        { method: 'eth_chainId', outcome: 'success' as const, success: true, latencyMs: 25, observedValue: '0x190f1ca9', error: null },
        { method: 'eth_blockNumber', outcome: 'success' as const, success: true, latencyMs: 40, observedValue: '0x100', error: null },
        { method: 'web3_clientVersion', outcome: 'success' as const, success: true, latencyMs: 30, observedValue: 'eth-rpc/test', error: null },
        { method: 'net_version', outcome: 'success' as const, success: true, latencyMs: 20, observedValue: '420420777', error: null },
      ],
    });
    const snapB = createSnapshot({
      id: 'snap-b',
      timestamp: 1700000060000,
      endpointOrigin: 'https://other-chain.example.test',
      checks: [
        { method: 'eth_chainId', outcome: 'success' as const, success: true, latencyMs: 25, observedValue: '0x1', error: null },
        { method: 'eth_blockNumber', outcome: 'success' as const, success: true, latencyMs: 40, observedValue: '0x999', error: null },
        { method: 'web3_clientVersion', outcome: 'success' as const, success: true, latencyMs: 30, observedValue: 'eth-rpc/test', error: null },
        { method: 'net_version', outcome: 'success' as const, success: true, latencyMs: 20, observedValue: '1', error: null },
      ],
    });

    render(<SnapshotComparison snapshots={[snapB, snapA]} />);

    expect(screen.getByText(/Different chains: endpoint A reported chain ID 420420777, endpoint B reported chain ID 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Not Comparable \(Different Chains: 420420777 vs 1\)/i)).toBeInTheDocument();
    // The critical (error) cross-endpoint finding is rendered.
    expect(screen.getByText('cross_endpoint_different_chain')).toBeInTheDocument();
    expect(screen.getByText('Endpoints are on different chains')).toBeInTheDocument();
    // No signed block delta is presented anywhere.
    expect(screen.queryByText(/\d+ blocks/)).toBeNull();
  });
});
