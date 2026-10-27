#!/usr/bin/env node
/**
 * nodescope — thin argument parser over cli/lib.mjs. All logic lives in
 * lib.mjs so the vitest suite can import it directly; this file only maps
 * argv to calls, prints output, and picks the exit code.
 *
 * Usage:
 *   node cli/nodescope.mjs check <rpc-url> [--json] [--timeout-ms N]
 *     [--webhook URL] [--watch SECONDS]
 *   node cli/nodescope.mjs fees --artifact <file.json> [--evm-rpc URL]
 *     [--wss URL] [--from 0x…] [--max-tpot N] [--evm-only] [--json]
 *     [--connect-timeout-ms N] [--estimate-timeout-ms N]
 * From a repo checkout, `npx nodescope` resolves the same bin (see the
 * bin entry in package.json). Nothing is published to npm.
 */
import {
  DEFAULT_EVM_RPC,
  DEFAULT_WSS,
  SAMPLE_FROM,
  checkNode,
  compareDeployCosts,
  budgetCheck,
  formatTpot,
  quoteEvmDeploy,
  quoteNativeDeploy,
  readArtifactFile,
  isH160,
  detectWebhookKind,
  detectTransition,
  checkAlertText,
  postWebhook,
} from './lib.mjs';

const USAGE = `nodescope — check the node + price the deploy before you deploy.

Usage:
  nodescope check <rpc-url> [--json] [--timeout-ms N]
    [--webhook <discord|slack webhook URL>] [--watch SECONDS]
  nodescope fees --artifact <file.json> [--evm-rpc URL] [--wss URL]
    [--from 0x…] [--max-tpot N] [--evm-only] [--json]
    [--connect-timeout-ms N] [--estimate-timeout-ms N]

Defaults: --evm-rpc ${DEFAULT_EVM_RPC}, --wss ${DEFAULT_WSS},
--from ${SAMPLE_FROM} (dry-run origin only; nothing is signed).

Alerts: --webhook posts to Discord/Slack. One-shot: only when the
verdict is not healthy. With --watch N (N >= 30) the check repeats every
N seconds until Ctrl-C and posts only on degrade/recover transitions;
the first check is the baseline. The URL is never printed.

Exit codes:
  check: 0 healthy, 1 degraded/down, 2 usage error (one-shot mode).
  fees:  0 priced and within budget, 1 EVM leg unavailable or budget
         exceeded, 2 usage/artifact error. A native leg that is
         unavailable is a warning, not a failure: the EVM leg alone still
         gates the deploy cost.`;

function failUsage(message) {
  console.error(message);
  console.error(USAGE);
  process.exit(2);
}

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json' || arg === '--evm-only' || arg === '--help' || arg === '-h') {
      flags[arg.replace(/^--/, '').replace(/^-/, '')] = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (i + 1 >= argv.length) failUsage(`Missing value for ${arg}.`);
      flags[key] = argv[++i];
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function printCheck(result, json) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`verdict: ${result.verdict}`);
  console.log(`rpc: ${result.rpc}`);
  if (result.chainId !== null) console.log(`chainId: ${result.chainId}${result.chainMismatch ? ' (MISMATCH: expected 420420777)' : ''}`);
  if (result.blockNumber !== null) console.log(`blockNumber: ${result.blockNumber}`);
  for (const c of result.checks) {
    console.log(`  ${c.method}: ${c.ok ? `ok (${c.value})` : `FAILED (${c.error})`}`);
  }
}

async function alert(webhook, text) {
  try {
    const r = await postWebhook(webhook, text);
    console.error(`alert: ${r.kind} webhook answered HTTP ${r.status}`);
  } catch (e) {
    console.error(`alert failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function runCheck(argv) {
  const { flags, positional } = parseFlags(argv);
  const rpc = positional[0];
  if (!rpc) failUsage('check needs an RPC URL: nodescope check <rpc-url>.');
  const timeoutMs = flags['timeout-ms'] ? Number(flags['timeout-ms']) : undefined;
  if (timeoutMs !== undefined && (!Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    failUsage('--timeout-ms must be a positive number.');
  }
  const webhook = flags.webhook;
  if (webhook !== undefined && !detectWebhookKind(webhook)) {
    failUsage('--webhook must be an https Discord (discord.com/api/webhooks/…) or Slack (hooks.slack.com/…) webhook URL.');
  }
  const watch = flags.watch !== undefined ? Number(flags.watch) : undefined;
  if (watch !== undefined && (!Number.isFinite(watch) || watch < 30)) {
    failUsage('--watch must be a number of seconds, at least 30 (keeps load on a public RPC polite).');
  }
  const opts = timeoutMs ? { timeoutMs } : {};
  if (watch === undefined) {
    const result = await checkNode(rpc, opts);
    printCheck(result, flags.json);
    if (webhook && result.verdict !== 'healthy') await alert(webhook, checkAlertText(null, null, result));
    process.exit(result.verdict === 'healthy' ? 0 : 1);
  }
  // Watch mode: loop until interrupted; alert only on transitions.
  let prev = null;
  let stop = false;
  process.on('SIGINT', () => {
    stop = true;
    console.error('watch stopped');
    process.exit(0);
  });
  const maxCycles = flags['max-cycles'] ? Number(flags['max-cycles']) : Infinity;
  for (let cycle = 1; !stop && cycle <= maxCycles; cycle++) {
    const result = await checkNode(rpc, opts);
    const transition = detectTransition(prev, result.verdict);
    console.log(`${new Date().toISOString()} cycle ${cycle}: ${result.verdict} block ${result.blockNumber ?? '—'}${transition ? ` ${transition.toUpperCase()}` : ''}`);
    if (transition && webhook) await alert(webhook, checkAlertText(transition, prev, result));
    prev = result.verdict;
    if (cycle < maxCycles) await new Promise((r) => setTimeout(r, watch * 1000));
  }
  process.exit(0);
}

async function runFees(argv) {
  const { flags } = parseFlags(argv);
  if (!flags.artifact) failUsage('fees needs --artifact <file.json>.');
  const evmRpc = flags['evm-rpc'] || DEFAULT_EVM_RPC;
  const wss = flags.wss || DEFAULT_WSS;
  const from = flags.from || SAMPLE_FROM;
  if (!isH160(from)) failUsage(`--from must be a 0x… H160 address: ${from}.`);
  let artifact;
  try {
    artifact = readArtifactFile(flags.artifact);
  } catch (e) {
    console.error(`artifact error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
  const evmOpts = flags['timeout-ms'] ? { timeoutMs: Number(flags['timeout-ms']) } : {};
  let evm;
  try {
    evm = await quoteEvmDeploy(evmRpc, from, artifact.bytecode, artifact.constructorData, evmOpts);
  } catch (e) {
    evm = { status: 'unavailable', method: 'eth_estimateGas (create)', reason: e instanceof Error ? e.message : String(e) };
  }
  let native;
  if (flags['evm-only']) {
    native = { status: 'unavailable', method: 'revive.instantiateWithCode', reason: 'skipped (--evm-only)' };
  } else {
    try {
      native = await quoteNativeDeploy(wss, from, artifact.bytecode, artifact.constructorData, {
        connectTimeoutMs: flags['connect-timeout-ms'] ? Number(flags['connect-timeout-ms']) : undefined,
        estimateTimeoutMs: flags['estimate-timeout-ms'] ? Number(flags['estimate-timeout-ms']) : undefined,
      });
    } catch (e) {
      native = { status: 'unavailable', method: 'revive.instantiateWithCode', reason: e instanceof Error ? e.message : String(e) };
    }
  }
  const comparison = compareDeployCosts(evm, native);
  // Budget applies to the cheapest priced all-in cost: that is what the
  // deploy would actually cost on the recommended path. When only one leg
  // priced, the budget applies to that leg, and the output says so.
  const priced = [evm, native].filter((l) => l.status === 'ok').map((l) => BigInt(l.totalPlanck));
  const cheapest = priced.length ? priced.reduce((a, b) => (a < b ? a : b)) : null;
  let budget = null;
  if (flags['max-tpot'] !== undefined && cheapest !== null) {
    try {
      budget = { ...budgetCheck(cheapest, flags['max-tpot']), pricedLeg: evm.status === 'ok' && native.status === 'ok' ? 'cheapest of both' : evm.status === 'ok' ? 'evm' : 'native' };
    } catch (e) {
      failUsage(`--max-tpot: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const out = { command: 'fees', artifact: flags.artifact, evmRpc, wss, from, ...comparison, budget };
  if (flags.json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    const legLine = (name, leg) =>
      leg.status === 'ok'
        ? `${name}: ${formatTpot(BigInt(leg.totalPlanck))} tPOT (block #${leg.blockNumber})`
        : `${name}: unavailable (${leg.reason})`;
    console.log(legLine('evm', evm));
    console.log(legLine('native', native));
    if (comparison.ratioAllIn !== null) console.log(`ratio all-in (EVM ÷ native): ${comparison.ratioAllIn}`);
    if (comparison.ratioVsNativeFeeOnly !== null) console.log(`ratio fee-only (EVM ÷ native fee): ${comparison.ratioVsNativeFeeOnly}`);
    console.log(`recommended: ${comparison.recommended ?? 'none'}`);
    console.log(`reason: ${comparison.reason}`);
    if (budget) console.log(`budget: max ${budget.maxTpot} tPOT, priced ${budget.pricedLeg} — ${budget.over ? 'OVER BUDGET' : 'within budget'}`);
  }
  if (evm.status !== 'ok') process.exit(1);
  if (budget?.over) process.exit(1);
  process.exit(0);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(USAGE);
    process.exit(cmd ? 0 : 2);
  }
  if (cmd === 'check') await runCheck(rest);
  else if (cmd === 'fees') await runFees(rest);
  else failUsage(`Unknown command: ${cmd}.`);
}

main().catch((e) => {
  console.error(`nodescope error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
