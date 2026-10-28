/**
 * Single source of truth for the public facts that appear in more than one
 * place: the landing page, /judges, /docs, the app, and the DoraHacks draft.
 * When one of these changes, update it HERE — the consistency test fails if
 * a rendered page disagrees with this file.
 *
 * Deliberately NOT duplicated here (each already has its own single source):
 * - the report schema version lives in utils/reportBuilder
 *   (REPORT_SCHEMA_VERSION);
 * - the EVM RPC URL lives in types/endpoint (DEFAULT_PORTALDOT_V3_EVM_RPC);
 * - the registry address itself lives in deployments/portaldot-v3.json
 *   (imported by utils/shareableVerification as DEPLOYED_REGISTRY_ADDRESS)
 *   and is re-exported below.
 *
 * The 25 Oct 2026 anchor on the earlier registry is kept as SUPPLEMENT_*
 * below and shown on /judges with its date label. It is history, not the
 * current evidence: ANCHOR_* above always point at the latest anchor.
 *
 * ANCHORED_REPORTS lists all three anchors on the current registry, in
 * anchor order, with the public report path for each. /judges renders
 * this list; the consistency script checks it against the anchors array
 * in deployments/portaldot-v3.json.
 *
 * Test counts are the one exception: they are measured, not declared, so
 * SITE_TESTS / SITE_TEST_FILES are updated by hand after a test run. The
 * consistency test checks every rendered page against them, so a stale
 * count fails loudly instead of shipping quietly.
 */
export { DEPLOYED_REGISTRY_ADDRESS as REGISTRY_CONTRACT } from './shareableVerification';

export const PORTALDOT_CHAIN_ID = 420420777;
export const PORTALDOT_CHAIN_ID_HEX = '0x190f1ca9';
export const PORTALDOT_SUBSTRATE_WSS = 'wss://test-node-v3.portaldot.dev';

export const ANCHOR_TX =
  '0xc74a08f3835b0c5b7d813ab15597488affa1987bce79a88d843dfdc31a9ec913';
export const ANCHOR_BLOCK = 216346;
export const ANCHORED_REPORT_HASH =
  '0x528f38d58920b2c7fef730c27e95200e429a126874746e8cead5c1146c768a5b';
export const ANCHORED_REPORT_EXPORTED_AT = '2026-10-27T10:20:20Z';
export const ANCHORED_REPORT_RECORDS = 12;

export interface AnchoredReportEntry {
  label: string;
  hash: string;
  tx: string;
  block: number;
  exportedAt: string;
  records: number;
  reportFile: string;
}

export const ANCHORED_REPORTS: AnchoredReportEntry[] = [
  {
    label: 'Health #1',
    hash: '0x08ac72ad0f7a818bc18a8624232811fc4f994cf065bbd2cad1eea4b0bb002df4',
    tx: '0xba35df8e2f182d75885b75b75f0dd97340f4ce64333840d1cf06a252441e9476',
    block: 216341,
    exportedAt: '2026-10-27T10:18:05Z',
    records: 6,
    reportFile: '/evidence/reports/diagnostic-2026-10-27-1.json',
  },
  {
    label: 'Fees',
    hash: '0x246d6d43b308b8801109910bb52d8ad8d264376e7c8557255b3704176ada0464',
    tx: '0x0c08335507cfb2a0df4b0236543607aed04527ec26361e6e0022c9100c88f2c9',
    block: 216343,
    exportedAt: '2026-10-27T10:18:57Z',
    records: 2,
    reportFile: '/evidence/reports/fee-2026-10-27.json',
  },
  {
    label: 'Health #2',
    hash: '0x528f38d58920b2c7fef730c27e95200e429a126874746e8cead5c1146c768a5b',
    tx: '0xc74a08f3835b0c5b7d813ab15597488affa1987bce79a88d843dfdc31a9ec913',
    block: 216346,
    exportedAt: '2026-10-27T10:20:20Z',
    records: 12,
    reportFile: '/evidence/reports/diagnostic-2026-10-27-2.json',
  },
];

export const SUPPLEMENT_REGISTRY =
  '0x74c88d3090aD6915BFDc373eD6F037e2da4557Ce';
export const SUPPLEMENT_ANCHOR_TX =
  '0xa7cd3cbd060335d851494c1f48e15124ec8d32ccfa3fe03413c85cf895625448';
export const SUPPLEMENT_ANCHOR_BLOCK = 179228;
export const SUPPLEMENT_REPORT_HASH =
  '0x0bc787de4c634a55699e92d90b7280fffebdbcd557c4312044134e4df9dfa286';
export const SUPPLEMENT_REPORT_EXPORTED_AT = '2026-10-24T20:12:08Z';
export const SUPPLEMENT_REPORT_RECORDS = 14;

export const SITE_TESTS = '516';
export const SITE_TEST_FILES = '75';
