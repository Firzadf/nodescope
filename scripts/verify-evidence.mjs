#!/usr/bin/env node
/**
 * verify-evidence.mjs — re-check NodeScope's on-chain evidence, automatically.
 *
 * What it checks (one line per check, PASS / FAIL / SKIP):
 *   1. registry-code    — eth_getCode at the registry address is non-empty.
 *   2. deploy-receipt   — the deploy tx receipt exists and has status 0x1.
 *   3. anchor-receipt   — the anchor tx receipt exists and has status 0x1.
 *   4. anchor-log-topic — an anchor receipt log from the registry carries
 *                          the anchored report hash as topics[1] (the
 *                          indexed reportHash of the Attested event).
 *   5. recompile        — a fresh `forge build` produces bytecode identical
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
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir, platform } from 'node:os';
import { join, dirname } from 'node:path';
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

  // 3 + 4. Anchor receipt and log topic.
  const anchor = doc && !docBroken ? doc.anchor : null;
  if (!doc && !docBroken) {
    record('anchor-receipt', 'SKIP', 'no deployment recorded yet');
    record('anchor-log-topic', 'SKIP', 'no deployment recorded yet');
  } else if (docBroken) {
    record('anchor-receipt', 'FAIL', 'deployments file is not valid JSON');
    record('anchor-log-topic', 'FAIL', 'deployments file is not valid JSON');
  } else if (!anchor) {
    record('anchor-receipt', 'SKIP', 'no anchor recorded yet');
    record('anchor-log-topic', 'SKIP', 'no anchor recorded yet');
  } else if (!anchor.txHash) {
    record('anchor-receipt', 'FAIL', 'anchor record has no txHash');
    record('anchor-log-topic', 'FAIL', 'anchor record has no txHash');
  } else {
    let receipt = null;
    try {
      receipt = await rpcCall(rpc, 'eth_getTransactionReceipt', [anchor.txHash]);
    } catch (e) {
      record('anchor-receipt', 'FAIL', `RPC request failed: ${e.message}`);
    }
    if (receipt !== null) {
      if (!receipt) record('anchor-receipt', 'FAIL', `no receipt for ${anchor.txHash}`);
      else if (receipt.status !== '0x1') record('anchor-receipt', 'FAIL', `receipt status is ${receipt.status}, not 0x1`);
      else record('anchor-receipt', 'PASS', `receipt status 0x1, block ${receipt.blockNumber}`);
    }
    if (!anchor.reportHash || !HASH_RE.test(anchor.reportHash)) {
      record('anchor-log-topic', 'FAIL', 'anchor record has no valid reportHash');
    } else if (!receipt) {
      record('anchor-log-topic', 'FAIL', 'no anchor receipt to check topics against');
    } else if (receipt.status !== '0x1') {
      record('anchor-log-topic', 'FAIL', 'anchor receipt did not succeed, so its topics prove nothing');
    } else {
      const contract = (doc.contract || '').toLowerCase();
      const target = anchor.reportHash.toLowerCase();
      const match = (receipt.logs || []).some((log) => {
        const topics = (log.topics || []).map((t) => String(t).toLowerCase());
        return String(log.address || '').toLowerCase() === contract && topics.length >= 2 && topics[1] === target;
      });
      record(
        'anchor-log-topic',
        match ? 'PASS' : 'FAIL',
        match
          ? `a log from ${doc.contract} carries ${target} as topics[1]`
          : `no log from ${doc.contract} carries ${target} as topics[1]`,
      );
    }
  }

  // 5. Recompile (needs no deployment).
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
