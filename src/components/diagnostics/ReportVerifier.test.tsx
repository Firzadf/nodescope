// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReportVerifier } from './ReportVerifier';
import {
  attachSessionTrends,
  buildDiagnosticReport,
  type DiagnosticReportExport,
} from '../../utils/reportBuilder';
import { stampReportIntegrity } from '../../utils/reportIntegrity';
import type { DiagnosticHistoryItem } from '../../types/rpc';
import {
  HEALTH_SNAPSHOT_SCHEMA_VERSION,
  type HealthCheckCheck,
  type HealthCheckSnapshot,
} from '../../types/healthCheck';

// Hashing uses the global WebCrypto API in both environments: Node 24's
// global in the utils tests, and jsdom 29's native subtle implementation
// here (probed during development — it produces correct SHA-256 digests).
// The app tsconfig restricts ambient types to vite/client, so no node:*
// imports are available to test files; none are needed.

afterEach(() => cleanup());

const T0 = 1700000000000;

function blockRecord(overrides: Partial<DiagnosticHistoryItem> = {}): DiagnosticHistoryItem {
  return {
    id: 'record-1',
    endpoint: 'https://rpc.example.test',
    timestamp: T0,
    request: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
    response: { jsonrpc: '2.0', result: '0x10', id: 1 },
    latency: 23,
    error: null,
    success: true,
    ...overrides,
  };
}

function trendCheck(overrides: Partial<HealthCheckCheck> = {}): HealthCheckCheck {
  return {
    method: 'eth_blockNumber',
    outcome: 'success',
    success: true,
    latencyMs: 40,
    observedValue: '0x100',
    error: null,
    ...overrides,
  };
}

function trendSnapshot(id: string, timestamp: number, blockHex: string): HealthCheckSnapshot {
  return {
    schemaVersion: HEALTH_SNAPSHOT_SCHEMA_VERSION,
    id,
    timestamp,
    exportedAt: new Date(timestamp).toISOString(),
    endpointOrigin: 'https://rpc.example.test',
    endpointProfile: 'portaldot_v3_evm',
    checks: [
      trendCheck({ method: 'eth_chainId', observedValue: '0x190f1ca9' }),
      trendCheck({ method: 'eth_blockNumber', observedValue: blockHex }),
    ],
    findings: [],
  };
}

async function stampedReport(): Promise<DiagnosticReportExport> {
  const base = buildDiagnosticReport([blockRecord()], [], new Date('2026-10-21T00:00:00.000Z'));
  const withTrends = attachSessionTrends(base, [
    trendSnapshot('s1', T0, '0x100'),
    trendSnapshot('s2', T0 + 76_000, '0x10c'),
  ]);
  return stampReportIntegrity(withTrends);
}

function pasteAndVerify(text: string) {
  fireEvent.click(screen.getByText('Or paste report JSON'));
  fireEvent.change(screen.getByPlaceholderText(/schemaVersion/), { target: { value: text } });
  fireEvent.click(screen.getByText('Verify pasted report'));
}

describe('ReportVerifier', () => {
  it('verifies a stamped report and renders the attested contents incl. the verdict', async () => {
    render(<ReportVerifier />);
    pasteAndVerify(JSON.stringify(await stampedReport()));

    expect(await screen.findByText('VERIFIED — INTACT')).toBeInTheDocument();
    expect(screen.getByText(/match the SHA-256 stamp/)).toBeInTheDocument();
    expect(screen.getByText('Attested contents')).toBeInTheDocument();
    expect(screen.getByText(/Session verdict:/)).toBeInTheDocument();
    expect(screen.getByText('HEALTHY')).toBeInTheDocument();
    expect(
      screen.getByText(/does not prove the node data inside the report was true/)
    ).toBeInTheDocument();
  });

  it('flags a report whose latency was edited after export', async () => {
    const tampered = JSON.parse(JSON.stringify(await stampedReport())) as DiagnosticReportExport;
    tampered.records[0].latencyMs = 999;

    render(<ReportVerifier />);
    pasteAndVerify(JSON.stringify(tampered));

    expect(await screen.findByText('MISMATCH — ALTERED AFTER EXPORT')).toBeInTheDocument();
    expect(screen.getByText(/altered after export/)).toBeInTheDocument();
    expect(screen.getByText('Contents claimed by this file')).toBeInTheDocument();
  });

  it('reports a legacy unstamped report as unverifiable, not as fake', async () => {
    const legacy = buildDiagnosticReport([blockRecord()], [], new Date('2026-10-21T00:00:00.000Z'));

    render(<ReportVerifier />);
    pasteAndVerify(JSON.stringify(legacy));

    expect(await screen.findByText('NO INTEGRITY STAMP')).toBeInTheDocument();
    expect(screen.getByText(/predates integrity stamping/)).toBeInTheDocument();
  });
});
