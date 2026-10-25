// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HealthCheckPanel } from './HealthCheckPanel';
import type { HealthCheckCheck } from '../../types/healthCheck';

afterEach(() => cleanup());

function panelProps(overrides: { isLoading: boolean; onRunHealthCheck: (onCheck?: (c: HealthCheckCheck) => void) => Promise<void> }) {
  return {
    endpoint: 'https://test-evm-rpc-v3.portaldot.dev',
    endpointProfile: 'portaldot_v3_evm' as const,
    isConnected: true,
    latestSnapshot: null,
    isLoading: overrides.isLoading,
    onRunHealthCheck: overrides.onRunHealthCheck,
  };
}

describe('HealthCheckPanel per-method progress', () => {
  it('shows each method as RUNNING then PASS or FAIL as its call returns', async () => {
    const onRunHealthCheck = vi.fn(async (onCheck?: (c: HealthCheckCheck) => void) => {
      onCheck?.({ method: 'eth_chainId', outcome: 'success', success: true, latencyMs: 10, observedValue: '0x190f1ca9', error: null });
      onCheck?.({ method: 'eth_blockNumber', outcome: 'unsupported_method', success: false, latencyMs: 12, observedValue: null, error: 'JSON-RPC Error [-32601]' });
    });

    const { rerender } = render(<HealthCheckPanel {...panelProps({ isLoading: false, onRunHealthCheck })} />);
    fireEvent.click(screen.getByRole('button', { name: /Run Health Check/ }));

    // The parent flips isLoading while the run is in flight; the panel
    // keeps the checks it already received and marks the next one running.
    rerender(<HealthCheckPanel {...panelProps({ isLoading: true, onRunHealthCheck })} />);

    expect(screen.getByText('eth_chainId')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('eth_blockNumber')).toBeInTheDocument();
    expect(screen.getByText('Unsupported (-32601)')).toBeInTheDocument();
    expect(screen.getByText('web3_clientVersion')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('net_version')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
  });
});
