#!/usr/bin/env node
/**
 * verify-evidence.mjs — re-check NodeScope's on-chain evidence, automatically.
 *
 * What it checks (one line per check, PASS / FAIL / SKIP):
 *   1. registry-code    — eth_getCode at the registry address is non-empty.
 *   2. deploy-receipt   — the deploy tx receipt exists and has status 0x1.
 *   3. per anchor, five checks (anchor-N-* for each entry of the
 *      deployments anchors array, in order):
 *      - receipt    — the anchor tx receipt exists and has status 0x1.
 *      - log-topic  — an anchor receipt log from the registry carries the
 *                     anchored report hash as topics[1] (the indexed
 *                     reportHash of the Attested event).
 *      - report-hash — the SHA-256 recomputed from the committed report
 *                     file (evidence/reports/...) equals both the anchor's
 *                     reportHash and the file's own integrity stamp, using
 *                     the app's canonicalization (sorted keys, integrity
 *                     block excluded; see src/utils/reportIntegrity.ts).
 *      - is-anchored — the registry's isAnchored(hash) view returns true.
 *      - public-copy — public/evidence/reports/<file> is byte-identical
 *                     to the committed report, so /verify can load it.
 *   4. recompile        — a fresh `forge build` produces bytecode identical
 *                          to the committed artifact (creation + deployed).
 *
 * Where the facts come from: deployments/portaldot-v3.json, written by
 * scripts/deploy-attestation.sh and scripts/anchor-report.sh. The script
 * never invents values: when that file does not exist yet (the user has
 * not deployed), the on-chain checks report SKIP, not a fake PASS — and
 * the script still runs the recompile check, which needs no deployment.
 * When the file exists but is incomplete, the affected checks FAIL
 * (a broken record is worse than an absent one).
 *
 * Usage:
 *   npm run verify:evidence
 *   node scripts/verify-evidence.mjs [--rpc URL] [--deployments FILE]
 *
 * Exit codes: 0 = every check PASS; 1 = any check FAIL; 2 = no FAIL but
 * at least one SKIP (nothing on-chain recorded yet). Exit 2 is honest
 * incompleteness, not success: it never prints an overall PASS for
 * checks that did not run.
 *
 * Dependencies: none beyond node itself. RPC calls use global fetch;
 * the recompile check shells out to `forge` WITHOUT a shell (execFile),
 * so paths and arguments behave the same on Windows and POSIX.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir, platform } from 'node:os';
import { join, dirname, basename, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_RPC = 'https://test-evm-rpc-v3.portaldot.dev';
const DEFAULT_DEPLOYMENTS = join(ROOT, 'deployments', 'portaldot-v3.json');
const COMMITTED_ARTIFACT = join(
  ROOT,
  'contracts',
  'out',
  'NodeScopeAttestation.sol',
  'NodeScopeAttestation.json',
);

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/;

function parseArgs(argv) {
  const args = { rpc: DEFAULT_RPC, deployments: DEFAULT_DEPLOYMENTS };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--rpc' && argv[i + 1]) args.rpc = argv[i + 1];
    if (argv[i] === '--deployments' && argv[i + 1]) args.deployments = argv[i + 1];
  }
  return args;
}

async function rpcCall(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(body.error.message || JSON.stringify(body.error));
  return body.result;
}

function findForge() {
  try {
    execFileSync('forge', ['--version'], { stdio: 'pipe' });
    return 'forge';
  } catch {
    const ext = platform() === 'win32' ? '.exe' : '';
    const candidate = join(homedir(), '.foundry', 'bin', `forge${ext}`);
    return existsSync(candidate) ? candidate : null;
  }
}

function checkRecompile() {
  const forge = findForge();
  if (!forge) return { status: 'SKIP', detail: 'forge not found on PATH or in ~/.foundry/bin' };
  let tmp;
  try {
    if (!existsSync(COMMITTED_ARTIFACT)) {
      return { status: 'FAIL', detail: `committed artifact not found: ${COMMITTED_ARTIFACT}` };
    }
    tmp = mkdtempSync(join(tmpdir(), 'nodescope-verify-'));
    execFileSync(forge, ['build', '--out', tmp, '--force'], { cwd: ROOT, stdio: 'pipe' });
    const freshPath = join(tmp, 'NodeScopeAttestation.sol', 'NodeScopeAttestation.json');
    if (!existsSync(freshPath)) {
      return { status: 'FAIL', detail: 'forge build produced no NodeScopeAttestation artifact' };
    }
    const committed = JSON.parse(readFileSync(COMMITTED_ARTIFACT, 'utf8'));
    const fresh = JSON.parse(readFileSync(freshPath, 'utf8'));
    const fields = [
      ['bytecode.object', committed.bytecode?.object, fresh.bytecode?.object],
      ['deployedBytecode.object', committed.deployedBytecode?.object, fresh.deployedBytecode?.object],
    ];
    for (const [name, want, got] of fields) {
      if (typeof want !== 'string' || want !== got) {
        return { status: 'FAIL', detail: `${name} differs from the committed artifact` };
      }
    }
    return { status: 'PASS', detail: 'creation + deployed bytecode match the committed artifact' };
  } catch (e) {
    const tail = (e.stderr?.toString() || e.message || String(e)).split('\n').filter(Boolean).slice(-3).join(' ');
    return { status: 'FAIL', detail: `forge build failed: ${tail}` };
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}

// Canonicalization port of src/utils/reportIntegrity.ts (object keys sorted
// by UTF-16 code-unit order, undefined dropped, array order preserved,
// numbers and strings via JSON.stringify, root integrity block excluded).
// The committed reports are the test vectors: this function must reproduce
// their anchored hashes exactly, or the report-hash checks fail.
function canonicalizeValue(value) {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return Number.isFinite(value) ? JSON.stringify(value) : 'null';
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) return `[${value.map(canonicalizeValue).join(',')}]`;
      const keys = Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort();
      const pairs = keys.map((key) => `${JSON.stringify(key)}:${canonicalizeValue(value[key])}`);
      return `{${pairs.join(',')}}`;
    }
    default:
      return 'null';
  }
}

/** SHA-256 of a parsed report, excluding its root integrity block. */
function recomputedReportHash(parsed) {
  const { integrity, ...rest } = parsed;
  return createHash('sha256').update(canonicalizeValue(rest), 'utf8').digest('hex');
}

async function main() {
  const { rpc, deployments } = parseArgs(process.argv.slice(2));
  console.log(`NodeScope evidence verification (rpc: ${rpc})`);
  const results = [];

  const record = (name, status, detail) => {
    results.push({ name, status, detail });
    console.log(`[${status}] ${name} — ${detail}`);
  };

  let doc = null;
  let docBroken = false;
  if (!existsSync(deployments)) {
    console.log(`(no deployment record at ${deployments} — on-chain checks will SKIP)`);
  } else {
    try {
      doc = JSON.parse(readFileSync(deployments, 'utf8'));
    } catch {
      docBroken = true;
    }
  }

  // 1. Registry code.
  if (!doc && !docBroken) {
    record('registry-code', 'SKIP', 'no deployment recorded yet');
  } else if (docBroken || !ADDRESS_RE.test(doc.contract ?? '')) {
    record('registry-code', 'FAIL', 'deployments file is not valid JSON or has no valid contract address');
  } else {
    try {
      const code = await rpcCall(rpc, 'eth_getCode', [doc.contract, 'latest']);
      record(
        'registry-code',
        code && code !== '0x' ? 'PASS' : 'FAIL',
        code && code !== '0x' ? `non-empty code at ${doc.contract}` : `empty code at ${doc.contract}`,
      );
    } catch (e) {
      record('registry-code', 'FAIL', `RPC request failed: ${e.message}`);
    }
  }

  // 2. Deploy receipt.
  if (!doc && !docBroken) {
    record('deploy-receipt', 'SKIP', 'no deployment recorded yet');
  } else if (docBroken || !doc.deployTx) {
    record('deploy-receipt', 'FAIL', 'deployments file has no deployTx');
  } else {
    try {
      const receipt = await rpcCall(rpc, 'eth_getTransactionReceipt', [doc.deployTx]);
      if (!receipt) record('deploy-receipt', 'FAIL', `no receipt for ${doc.deployTx}`);
      else if (receipt.status !== '0x1') record('deploy-receipt', 'FAIL', `receipt status is ${receipt.status}, not 0x1`);
      else record('deploy-receipt', 'PASS', `receipt status 0x1, block ${receipt.blockNumber}`);
    } catch (e) {
      record('deploy-receipt', 'FAIL', `RPC request failed: ${e.message}`);
    }
  }

  // 3. Per-anchor checks, one set per entry of the anchors array.
  const anchors = doc && !docBroken && Array.isArray(doc.anchors) ? doc.anchors : null;
  if (!doc && !docBroken) {
    record('anchors', 'SKIP', 'no deployment recorded yet');
  } else if (docBroken) {
    record('anchors', 'FAIL', 'deployments file is not valid JSON');
  } else if (!anchors) {
    record('anchors', 'FAIL', 'deployments file has no anchors array');
  } else if (anchors.length === 0) {
    record('anchors', 'SKIP', 'no anchor recorded yet');
  } else {
    // isAnchored(bytes32) selector: first 4 bytes of
    // keccak256("isAnchored(bytes32)"), verified with `cast sig`.
    const IS_ANCHORED_SELECTOR = '0x4f0b5801';
    for (let i = 0; i < anchors.length; i += 1) {
      const anchor = anchors[i];
      const n = i + 1;
      const label = anchor.label ? ` (${anchor.label})` : '';
      const evidencePath =
        anchor.reportFile && isAbsolute(anchor.reportFile)
          ? anchor.reportFile
          : join(ROOT, anchor.reportFile || '');
      // Receipt (shared by the receipt and log-topic checks).
      let receipt = null;
      if (!anchor.txHash) {
        record(`anchor-${n}-receipt`, 'FAIL', `anchor${label} record has no txHash`);
      } else {
        try {
          receipt = await rpcCall(rpc, 'eth_getTransactionReceipt', [anchor.txHash]);
        } catch (e) {
          record(`anchor-${n}-receipt`, 'FAIL', `RPC request failed: ${e.message}`);
        }
        if (receipt !== null) {
          if (!receipt) record(`anchor-${n}-receipt`, 'FAIL', `no receipt for ${anchor.txHash}`);
          else if (receipt.status !== '0x1')
            record(`anchor-${n}-receipt`, 'FAIL', `receipt status is ${receipt.status}, not 0x1`);
          else record(`anchor-${n}-receipt`, 'PASS', `receipt status 0x1, block ${receipt.blockNumber}`);
        }
      }
      // Log topic.
      if (!anchor.reportHash || !HASH_RE.test(anchor.reportHash)) {
        record(`anchor-${n}-log-topic`, 'FAIL', `anchor${label} record has no valid reportHash`);
      } else if (!receipt) {
        record(`anchor-${n}-log-topic`, 'FAIL', 'no anchor receipt to check topics against');
      } else if (receipt.status !== '0x1') {
        record(
          `anchor-${n}-log-topic`,
          'FAIL',
          'anchor receipt did not succeed, so its topics prove nothing',
        );
      } else {
        const contract = (doc.contract || '').toLowerCase();
        const target = anchor.reportHash.toLowerCase();
        const match = (receipt.logs || []).some((log) => {
          const topics = (log.topics || []).map((t) => String(t).toLowerCase());
          return String(log.address || '').toLowerCase() === contract && topics.length >= 2 && topics[1] === target;
        });
        record(
          `anchor-${n}-log-topic`,
          match ? 'PASS' : 'FAIL',
          match
            ? `a log from ${doc.contract} carries ${target} as topics[1]`
            : `no log from ${doc.contract} carries ${target} as topics[1]`,
        );
      }
      // Report hash recomputation from the committed file.
      const bare = (anchor.reportHash || '').toLowerCase().replace(/^0x/, '');
      if (!anchor.reportFile) {
        record(`anchor-${n}-report-hash`, 'FAIL', `anchor${label} record has no reportFile`);
      } else if (!HASH_RE.test(anchor.reportHash || '')) {
        record(`anchor-${n}-report-hash`, 'FAIL', `anchor${label} record has no valid reportHash`);
      } else {
        let parsed = null;
        let readError = null;
        try {
          parsed = JSON.parse(readFileSync(evidencePath, 'utf8'));
        } catch (e) {
          readError = e;
        }
        if (readError) {
          record(`anchor-${n}-report-hash`, 'FAIL', `cannot read ${anchor.reportFile}: ${readError.message}`);
        } else {
          const computed = recomputedReportHash(parsed);
          const stated = String(parsed?.integrity?.hash || '').toLowerCase();
          if (computed === bare && stated === bare) {
            record(
              `anchor-${n}-report-hash`,
              'PASS',
              'recomputed hash matches the anchored hash and the file stamp',
            );
          } else {
            record(
              `anchor-${n}-report-hash`,
              'FAIL',
              `recomputed ${computed}, file stamp ${stated}, anchored ${bare}`,
            );
          }
        }
      }
      // isAnchored view.
      if (!anchor.reportHash || !HASH_RE.test(anchor.reportHash)) {
        record(`anchor-${n}-is-anchored`, 'FAIL', `anchor${label} record has no valid reportHash`);
      } else {
        try {
          const data = IS_ANCHORED_SELECTOR + anchor.reportHash.slice(2).toLowerCase();
          const result = await rpcCall(rpc, 'eth_call', [{ to: doc.contract, data }, 'latest']);
          const anchored = result != null && parseInt(result, 16) === 1;
          record(
            `anchor-${n}-is-anchored`,
            anchored ? 'PASS' : 'FAIL',
            anchored
              ? `isAnchored(${anchor.reportHash}) is true`
              : `isAnchored(${anchor.reportHash}) returned ${result}`,
          );
        } catch (e) {
          record(`anchor-${n}-is-anchored`, 'FAIL', `RPC request failed: ${e.message}`);
        }
      }
      // Public copy byte-identity.
      if (!anchor.reportFile) {
        record(`anchor-${n}-public-copy`, 'FAIL', `anchor${label} record has no reportFile`);
      } else {
        const publicPath = join(ROOT, 'public', 'evidence', 'reports', basename(anchor.reportFile));
        try {
          const a = readFileSync(evidencePath);
          const b = readFileSync(publicPath);
          record(
            `anchor-${n}-public-copy`,
            a.equals(b) ? 'PASS' : 'FAIL',
            a.equals(b)
              ? `public/evidence/reports/${basename(anchor.reportFile)} is byte-identical`
              : `public/evidence/reports/${basename(anchor.reportFile)} differs from ${anchor.reportFile}`,
          );
        } catch (e) {
          record(`anchor-${n}-public-copy`, 'FAIL', `cannot compare public copy: ${e.message}`);
        }
      }
    }
  }

  // 4. Recompile (needs no deployment).
  const recompile = checkRecompile();
  record('recompile', recompile.status, recompile.detail);

  const anyFail = results.some((r) => r.status === 'FAIL');
  const anySkip = results.some((r) => r.status === 'SKIP');
  const overall = anyFail ? 'FAIL' : anySkip ? 'SKIP' : 'PASS';
  console.log(`OVERALL: ${overall}`);
  process.exit(overall === 'PASS' ? 0 : overall === 'SKIP' ? 2 : 1);
}

main().catch((e) => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});
