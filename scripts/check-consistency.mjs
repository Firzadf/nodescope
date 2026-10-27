/**
 * check-consistency.mjs — the grep half of the site-consistency story.
 * The vitest suite (src/utils/siteConsistency.test.tsx) already proves the
 * rendered landing, /judges, and /docs pages agree with
 * src/utils/siteConstants.ts. This script covers the two files the test
 * runner cannot reach cleanly: the README (checked here as a second layer)
 * and, when passed --draft <path>, the DoraHacks draft the user submits
 * by hand. Usage:
 *   npm run check:consistency
 *   node scripts/check-consistency.mjs --draft ../goals/.../dorahacks-update-draft.md
 *
 * Deployment facts come from deployments/portaldot-v3.json, the file the
 * deploy and anchor scripts write: it is the truth for the registry
 * contract, the deploy transaction, and the latest anchor. This script
 * cross-checks src/utils/siteConstants.ts against it (ANCHOR_TX and
 * ANCHORED_REPORT_HASH must equal the file's latest anchor) and requires
 * the README and the draft to contain the contract, the deploy tx, the
 * latest anchor tx and hash, the chain ID, and the test counts.
 * Exit code 1 lists every missing fact; fix the file, never this script.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const constantsSrc = readFileSync(join(root, 'src/utils/siteConstants.ts'), 'utf8');
const deployments = JSON.parse(readFileSync(join(root, 'deployments', 'portaldot-v3.json'), 'utf8'));

function exportedValue(name) {
  if (name === 'REGISTRY_CONTRACT') {
    // Truth: deployments/portaldot-v3.json, imported by shareableVerification.ts.
    if (!deployments.contract) throw new Error('deployments file has no contract address');
    return deployments.contract;
  }
  if (name === 'DEPLOY_TX') {
    if (!deployments.deployTx) throw new Error('deployments file has no deployTx');
    return deployments.deployTx;
  }
  const m = constantsSrc.match(new RegExp(`export const ${name} =\\s*('([^']+)'|(\\d+))`));
  if (!m) throw new Error(`constant ${name} not found in siteConstants.ts`);
  return m[2] ?? m[3];
}

const FACTS = [
  'REGISTRY_CONTRACT',
  'DEPLOY_TX',
  'ANCHOR_TX',
  'ANCHORED_REPORT_HASH',
  'PORTALDOT_CHAIN_ID',
  'SITE_TESTS',
  'SITE_TEST_FILES',
].map((name) => ({ name, value: exportedValue(name) }));

const draftArg = process.argv.indexOf('--draft');
const targets = [{ label: 'README.md', path: join(root, 'README.md') }];
if (draftArg !== -1 && process.argv[draftArg + 1]) {
  targets.push({ label: 'DoraHacks draft', path: process.argv[draftArg + 1] });
}

let failures = 0;
const anchorTx = FACTS.find((f) => f.name === 'ANCHOR_TX').value;
const anchorHash = FACTS.find((f) => f.name === 'ANCHORED_REPORT_HASH').value;
if (!deployments.anchor || anchorTx !== deployments.anchor.txHash) {
  console.error(
    `FAIL deployments: siteConstants ANCHOR_TX (${anchorTx}) != deployments anchor txHash (${deployments.anchor?.txHash})`,
  );
  failures += 1;
}
if (!deployments.anchor || anchorHash !== deployments.anchor.reportHash) {
  console.error(
    `FAIL deployments: siteConstants ANCHORED_REPORT_HASH (${anchorHash}) != deployments anchor reportHash (${deployments.anchor?.reportHash})`,
  );
  failures += 1;
}
for (const { label, path } of targets) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    console.error(`SKIP ${label}: cannot read ${path}`);
    continue;
  }
  const before = failures;
  for (const { name, value } of FACTS) {
    if (!text.includes(value)) {
      console.error(`FAIL ${label}: missing ${name} (${value})`);
      failures += 1;
    }
  }
  if (failures === before) console.log(`OK ${label}: all ${FACTS.length} facts present`);
}
if (draftArg === -1) {
  console.log('NOTE: DoraHacks draft not checked (pass --draft <path> to check it).');
}
process.exit(failures === 0 ? 0 : 1);
