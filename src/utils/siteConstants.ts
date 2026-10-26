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
 * - the registry address itself lives in utils/shareableVerification
 *   (DEPLOYED_REGISTRY_ADDRESS) and is re-exported below.
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
  '0xa7cd3cbd060335d851494c1f48e15124ec8d32ccfa3fe03413c85cf895625448';
export const ANCHOR_BLOCK = 179228;
export const ANCHORED_REPORT_HASH =
  '0x0bc787de4c634a55699e92d90b7280fffebdbcd557c4312044134e4df9dfa286';
export const ANCHORED_REPORT_EXPORTED_AT = '2026-10-24T20:12:08Z';
export const ANCHORED_REPORT_RECORDS = 14;

export const SITE_TESTS = '463';
export const SITE_TEST_FILES = '66';
