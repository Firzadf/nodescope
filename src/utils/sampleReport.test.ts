// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { verifyReport } from './reportIntegrity';
import { REPORT_SCHEMA_VERSION } from './reportBuilder';
// The served sample is imported as JSON so this test always checks the
// exact file the app serves at /sample-report.json, not a copy of it.
import sampleReport from '../../public/sample-report.json';

/**
 * Guard for the bundled sample report served at /sample-report.json.
 * It must stay a real, app-verifiable export: the verifier recomputes its
 * SHA-256 stamp from the file contents, so any edit breaks this test.
 */
describe('bundled sample report', () => {
  it('verifies against its own SHA-256 stamp', async () => {
    const v = await verifyReport(sampleReport);
    expect(v.status).toBe('verified');
    expect(v.report?.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    expect(v.report?.recordCount).toBeGreaterThan(0);
    expect(v.report?.records.every((r) => r.dataOrigin === 'real_request')).toBe(true);
    expect(v.report?.records.every((r) => r.endpointOrigin === 'https://test-evm-rpc-v3.portaldot.dev')).toBe(true);
  });
});
