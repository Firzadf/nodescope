// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import { VerdictBar } from './VerdictBar';
import type { HealthCheckSnapshot } from '../../types/healthCheck';
import type { SubstrateWsProbeResult } from '../../services/substrateWsProbe';

afterEach(() => cleanup());

const probe: SubstrateWsProbeResult = {
  url: 'wss://test-node-v3.portaldot.dev',
  status: 'ok',
  handshakeMs: 120,
  totalMs: 200,
  chain: 'Portaldot',
  version: 'test',
  peers: 3,
  isSyncing: false,
  shouldHavePeers: true,
  headerNumberHex: '0x1',
  headerNumberDecimal: '1',
  error: null,
};

const snapshot: HealthCheckSnapshot = {
  schemaVersion: 'nodescope.health-snapshot.v1',
  id: 'test',
  timestamp: 1000,
  exportedAt: '2026-10-26T00:00:00.000Z',
  endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
  endpointProfile: 'portaldot_v3_evm',
  checks: [],
  findings: [],
};

describe('VerdictBar transport label', () => {
  it('names the Substrate probe on the EVM HTTP-only profile', () => {
    const { container } = render(
      <VerdictBar latestHealthSnapshot={snapshot} wsProbeResult={probe} latencyMs={null} endpointProfile="portaldot_v3_evm" />,
    );
    expect(within(container).getByText(/Substrate WSS \(test-node-v3\)/)).toBeTruthy();
    expect(within(container).getByText('Answered')).toBeTruthy();
  });

  it('keeps the bare WSS label on other profiles', () => {
    const { container } = render(
      <VerdictBar latestHealthSnapshot={snapshot} wsProbeResult={probe} latencyMs={null} endpointProfile="generic_http" />,
    );
    const scope = within(container);
    expect(scope.getByText('Answered')).toBeTruthy();
    expect(scope.queryByText(/Substrate WSS/)).toBeNull();
  });

  it('uses the real hostname for a custom probe URL', () => {
    const custom = { ...probe, url: 'wss://my-node.example.com:9944' };
    const { container } = render(
      <VerdictBar latestHealthSnapshot={snapshot} wsProbeResult={custom} latencyMs={null} endpointProfile="portaldot_v3_evm" />,
    );
    expect(within(container).getByText(/Substrate WSS \(my-node\.example\.com:9944\)/)).toBeTruthy();
  });
});
