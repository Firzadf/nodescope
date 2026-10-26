// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildFeeReport } from './feeReport';
import { verifyReportText, verifyReport } from './reportIntegrity';
import { REPORT_SCHEMA_VERSION } from './reportBuilder';
import { compareLegs, type Comparison } from '../services/feeLab/compare';

const MEASURED_AT = '2026-10-27T00:30:00.000Z';

function okComparison(): Comparison {
  return compareLegs(
    {
      status: 'ok',
      method: 'eth_estimateGas (create)',
      gas: 4151136282350816n,
      gasPrice: 29895n,
      feeWei: 124098219160877644320n,
      totalPlanck: 1240982191608776n,
      blockNumber: 206234,
    },
    {
      status: 'ok',
      method: 'revive.instantiateWithCode',
      partialFee: 15441193000000n,
      storageDeposit: 1220370000000000n,
      totalPlanck: 1235811193000000n,
      weight: { refTime: 372899347n, proofSize: 20930n },
      blockNumber: 206235,
    },
    new Date(MEASURED_AT),
  );
}

describe('buildFeeReport', () => {
  it('exports a v1 report whose SHA-256 stamp verifies on /verify', async () => {
    const { stampReportIntegrity } = await import('./reportIntegrity');
    const stamped = await stampReportIntegrity(buildFeeReport(okComparison(), 'deploy'));
    expect(stamped.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    const text = JSON.stringify(stamped);
    const v = await verifyReportText(text);
    expect(v.status).toBe('verified');
    // The stamped report carries both legs as records, and the full
    // comparison additively — the same shape the anchor flow consumes.
    const parsed = JSON.parse(text) as {
      recordCount: number;
      records: { id: string; outcome: string; metricResult: string | null }[];
      feeComparison: { ratioAllIn: number; recommended: string };
      feeOperation: string;
      integrity: { hash: string };
    };
    expect(parsed.recordCount).toBe(2);
    expect(parsed.records.map((r) => r.id)).toEqual(['evm', 'native']);
    expect(parsed.records.every((r) => r.outcome === 'success')).toBe(true);
    expect(parsed.feeOperation).toBe('deploy');
    expect(parsed.feeComparison.ratioAllIn).toBeGreaterThan(1);
    expect(parsed.feeComparison.recommended).toBe('either');
    // The anchor flow passes this hash to cast as bytes32; on-chain it
    // appears 0x-prefixed as an Attested log topic.
    expect(parsed.integrity.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('tampering with one value breaks verification', async () => {
    const { stampReportIntegrity } = await import('./reportIntegrity');
    const stamped = await stampReportIntegrity(buildFeeReport(okComparison(), 'deploy'));
    const tampered = JSON.parse(JSON.stringify(stamped)) as {
      feeComparison: { evm: { totalPlanck: string } };
    };
    tampered.feeComparison.evm.totalPlanck = '1';
    const v = await verifyReportText(JSON.stringify(tampered));
    expect(v.status).toBe('mismatch');
  });

  it('an unavailable leg still becomes an honest error record and the stamp verifies', async () => {
    const { stampReportIntegrity } = await import('./reportIntegrity');
    const comparison = compareLegs(
      {
        status: 'ok',
        method: 'eth_estimateGas',
        gas: 439105576633n,
        gasPrice: 29855n,
        feeWei: 13109496990378215n,
        totalPlanck: 13109496990378n,
        blockNumber: 206239,
      },
      { status: 'unavailable', method: 'balances.transferKeepAlive', reason: 'revive.instantiateWithCode: timed out' },
      new Date(MEASURED_AT),
    );
    const stamped = await stampReportIntegrity(buildFeeReport(comparison, 'transfer'));
    const v = await verifyReport(stamped);
    expect(v.status).toBe('verified');
    const native = stamped.records.find((r) => r.id === 'native');
    expect(native?.outcome).toBe('network_or_http_error');
    expect(native?.metricResult).toBeNull();
    expect(native?.error).toContain('timed out');
  });

  it('never claims a latency it did not measure', () => {
    const report = buildFeeReport(okComparison(), 'deploy');
    expect(report.records.every((r) => r.latencyMs === null)).toBe(true);
    expect(report.records.every((r) => r.dataOrigin === 'real_request')).toBe(true);
  });
});
