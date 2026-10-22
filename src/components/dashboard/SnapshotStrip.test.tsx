// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SnapshotStrip } from './SnapshotStrip';
import { HEALTH_SNAPSHOT_SCHEMA_VERSION, type HealthCheckSnapshot } from '../../types/healthCheck';

afterEach(() => cleanup());

function snapshot(id: string, timestamp: number, outcomes: boolean[]): HealthCheckSnapshot {
  return {
    schemaVersion: HEALTH_SNAPSHOT_SCHEMA_VERSION,
    id,
    timestamp,
    exportedAt: new Date(timestamp).toISOString(),
    endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
    endpointProfile: 'portaldot_v3_evm',
    checks: outcomes.map((success, i) => ({
      method: i === 0 ? 'eth_blockNumber' : `method_${i}`,
      outcome: success ? ('success' as const) : ('rpc_error' as const),
      success,
      latencyMs: 100,
      observedValue: i === 0 ? '147639' : null,
      error: null,
    })),
    findings: [],
  };
}

describe('SnapshotStrip', () => {
  it('renders nothing before the first snapshot exists', () => {
    const { container } = render(<SnapshotStrip snapshots={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one entrance-animated cell per snapshot with tone from pass rate', () => {
    render(
      <SnapshotStrip
        snapshots={[
          snapshot('b', 2000, [true, true]),
          snapshot('a', 1000, [true, false]),
          snapshot('c', 3000, [false, false]),
        ]}
      />,
    );
    const strip = screen.getByRole('img', { name: /3 health checks this session/i });
    expect(strip.children).toHaveLength(3);
    // Oldest → newest: amber (half passed), emerald (all passed), red (none passed).
    expect(strip.children[0]).toHaveClass('bg-amber-400/80');
    expect(strip.children[1]).toHaveClass('bg-emerald-400/80');
    expect(strip.children[2]).toHaveClass('bg-red-400/80');
    for (const cell of Array.from(strip.children)) {
      expect(cell).toHaveClass('strip-cell-in');
    }
    expect(screen.getByText(/3 checks this session/i)).toBeInTheDocument();
  });
});
