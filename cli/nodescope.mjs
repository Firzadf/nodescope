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
  alertKindForCycle,
  checkAlertText,
  postWebhook,
  benchEndpoints,
  prometheusReading,
  writeMetricsFile,
} from './lib.mjs';

const USAGE = `nodescope — check the node + price the deploy before you deploy.

Usage:
  nodescope check <rpc-url> [--json] [--format text|json|prometheus]
    [--timeout-ms N] [--wss <wss-url>] [--reliability N]
    [--metrics-file <path>]
    [--webhook <discord|slack webhook URL>] [--watch SECONDS]
  nodescope fees --artifact <file.json> [--evm-rpc URL] [--wss URL]
    [--from 0x…] [--max-tpot N] [--evm-only] [--json]
    [--connect-timeout-ms N] [--estimate-timeout-ms N]
  nodescope bench <rpc-url> [<rpc-url> …] [--samples N] [--json]

Defaults: --evm-rpc ${DEFAULT_EVM_RPC}, --wss ${DEFAULT_WSS},
--from ${SAMPLE_FROM} (dry-run origin only; nothing is signed).

Alerts: --webhook posts to Discord/Slack. One-shot: only when the
verdict is not healthy. With --watch N (N >= 30) the check repeats every
N seconds until Ctrl-C and posts only on degrade/recover and on
stall/resume transitions; the first check is the baseline. The URL is
never printed.

--format prometheus writes the text exposition (also once per --watch
cycle, and to --metrics-file when that path is set) for Grafana or the
node_exporter textfile collector. --json is the same as --format json.
--wss adds finality lag, peers, and sync. --reliability N repeats
eth_blockNumber N times (1–20) and reports the error ratio. A head whose
timestamp is 90s or older is STALLED: chain paused but RPC answers.
Exit 1 covers degraded, stalled, and down.

bench: latency (p50/p95/max of eth_blockNumber) and consistency (chain
ids agree, head spread) across endpoints, read-only. Exit 0 when every
endpoint answered and the chain ids agree, 1 otherwise.

Exit codes:
  check: 0 healthy, 1 degraded/stalled/down, 2 usage error (one-shot mode).
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

function printCheck(result, format) {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (format === 'prometheus') {
    console.log(prometheusReading(result));
    return;
  }
  console.log(`verdict: ${result.verdict}`);
  console.log(`rpc: ${result.rpc}`);
  if (result.chainId !== null) console.log(`chainId: ${result.chainId}${result.chainMismatch ? ' (MISMATCH: expected 420420777)' : ''}`);
  if (result.blockNumber !== null) console.log(`blockNumber: ${result.blockNumber}`);
  if (result.bestAgeSeconds !== null) console.log(`bestHeadAgeSeconds: ${result.bestAgeSeconds}`);
  if (result.stallExplanation) console.log(`stall: ${result.stallExplanation}`);
  if (result.finalizedBlock !== null) console.log(`finalizedBlock: ${result.finalizedBlock}`);
  if (result.finalityLag !== null) console.log(`finalityLagBlocks: ${result.finalityLag}`);
  if (result.peers !== null) console.log(`peers: ${result.peers}`);
  if (result.score !== null) console.log(`score: ${result.score}/100 (${result.formula}, coverage ${result.coverage})`);
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
  const format = flags.json ? 'json' : (flags.format || 'text');
  if (!['text', 'json', 'prometheus'].includes(format)) failUsage('--format must be text, json, or prometheus.');
  const wss = flags.wss;
  const reliability = flags.reliability !== undefined ? Number(flags.reliability) : undefined;
  if (reliability !== undefined && (!Number.isInteger(reliability) || reliability < 1 || reliability > 20)) {
    failUsage('--reliability must be an integer from 1 to 20.');
  }
  const metricsFile = flags['metrics-file'];
  const webhook = flags.webhook;
  if (webhook !== undefined && !detectWebhookKind(webhook)) {
    failUsage('--webhook must be an https Discord (discord.com/api/webhooks/…) or Slack (hooks.slack.com/…) webhook URL.');
  }
  const watch = flags.watch !== undefined ? Number(flags.watch) : undefined;
  if (watch !== undefined && (!Number.isFinite(watch) || watch < 30)) {
    failUsage('--watch must be a number of seconds, at least 30 (keeps load on a public RPC polite).');
  }
  const opts = { ...(timeoutMs ? { timeoutMs } : {}), ...(wss ? { wss } : {}), ...(reliability ? { reliability } : {}) };
  const emit = (result) => {
    if (metricsFile) writeMetricsFile(metricsFile, prometheusReading(result));
    if (format === 'text' && watch !== undefined) return;
    printCheck(result, format);
  };
  if (watch === undefined) {
    const result = await checkNode(rpc, opts);
    emit(result);
    if (webhook && result.verdict !== 'healthy') await alert(webhook, checkAlertText(null, null, result));
    process.exit(result.verdict === 'healthy' ? 0 : 1);
  }
  // Watch mode: loop until interrupted; alert only on transitions.
  let prev = null;
  let prevStall = null;
  let stop = false;
  process.on('SIGINT', () => {
    stop = true;
    console.error('watch stopped');
    process.exit(0);
  });
  const maxCycles = flags['max-cycles'] ? Number(flags['max-cycles']) : Infinity;
  const log = format === 'text' ? console.log : console.error;
  for (let cycle = 1; !stop && cycle <= maxCycles; cycle++) {
    const result = await checkNode(rpc, opts);
    const transition = alertKindForCycle(prev, result.verdict, prevStall, result.stall);
    log(`${new Date().toISOString()} cycle ${cycle}: ${result.verdict} block ${result.blockNumber ?? '—'}${transition ? ` ${transition.toUpperCase()}` : ''}`);
    if (format !== 'text') printCheck(result, format);
    if (metricsFile) writeMetricsFile(metricsFile, prometheusReading(result));
    if (transition && webhook) await alert(webhook, checkAlertText(transition, prev, result));
    prev = result.verdict;
    prevStall = result.stall;
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

async function runBench(argv) {
  const { flags, positional } = parseFlags(argv);
  if (positional.length === 0) failUsage('bench needs at least one RPC URL.');
  const samples = flags.samples !== undefined ? Number(flags.samples) : 5;
  if (!Number.isInteger(samples) || samples < 1 || samples > 50) failUsage('--samples must be an integer from 1 to 50.');
  const out = await benchEndpoints(positional, { samples });
  if (flags.json) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    for (const e of out.endpoints) {
      console.log(`${e.url}`);
      console.log(`  chainId ${e.chainId ?? '—'} · head ${e.head ?? '—'} · ok ${e.ok}/${out.samples} · p50 ${e.p50Ms ?? '—'} ms · p95 ${e.p95Ms ?? '—'} ms · max ${e.maxMs ?? '—'} ms${e.errors ? ` · last error: ${e.lastError}` : ''}`);
    }
    console.log(`consistency: chain ids ${out.consistency.chainIdsAgree ? 'agree' : 'DISAGREE'} (${out.consistency.chainIds.join(', ') || 'none'}) · head spread ${out.consistency.headSpread ?? 'n/a'} blocks`);
    if (out.fastest) console.log(`fastest (p50): ${out.fastest}`);
  }
  const allAnswered = out.endpoints.every((e) => e.ok > 0);
  process.exit(allAnswered && out.consistency.chainIdsAgree ? 0 : 1);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(USAGE);
    process.exit(cmd ? 0 : 2);
  }
  if (cmd === 'check') await runCheck(rest);
  else if (cmd === 'fees') await runFees(rest);
  else if (cmd === 'bench') await runBench(rest);
  else failUsage(`Unknown command: ${cmd}.`);
}

main().catch((e) => {
  console.error(`nodescope error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
