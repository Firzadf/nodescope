#!/usr/bin/env node
/**
 * cost-gate.mjs — pre-deploy cost gate (Fee Lab logic, headless).
 *
 * Prices a contract deploy BEFORE it happens and fails when the price is
 * above a budget. The pricing is the Fee Lab's, via cli/lib.mjs:
 *   - EVM leg: eth_estimateGas (create) × eth_gasPrice, converted to tPOT.
 *     On pallet-revive the gas figure already folds the storage deposit in.
 *   - Native leg (surface=cheapest only): ReviveApi dry-run + paymentInfo,
 *     fee + refundable storage deposit, all-in.
 * Read-only: the from address is only a dry-run origin, nothing signs.
 *
 * Inputs come from flags OR from GitHub Action env (INPUT_*), so the same
 * file runs in a terminal, in a test, and inside .github/actions/cost-gate:
 *   --artifact / INPUT_ARTIFACT   solc artifact JSON or raw 0x bytecode file (required)
 *   --max-tpot / INPUT_MAX_TPOT   budget in tPOT (required)
 *   --rpc      / INPUT_RPC        EVM RPC (default Portaldot V3 testnet)
 *   --wss      / INPUT_WSS        Substrate WSS (surface=cheapest only)
 *   --from     / INPUT_FROM       dry-run origin (default the Fee Lab sample holder)
 *   --surface  / INPUT_SURFACE    evm (default) | cheapest
 *
 * Writes `cost_tpot`, `max_tpot`, `over`, `surface`, `block`, `ratio_all_in`
 * to $GITHUB_OUTPUT and a markdown table to $GITHUB_STEP_SUMMARY when those
 * files are set. Exit: 0 within budget, 1 over budget or EVM unpriceable,
 * 2 usage/artifact error. An unpriceable deploy never passes the gate.
 */
import { appendFileSync } from 'node:fs';
import {
  DEFAULT_EVM_RPC,
  DEFAULT_WSS,
  SAMPLE_FROM,
  budgetCheck,
  compareDeployCosts,
  formatTpot,
  isH160,
  quoteEvmDeploy,
  quoteNativeDeploy,
  readArtifactFile,
} from '../cli/lib.mjs';

function readInputs(argv, env) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      flags[a.slice(2)] = argv[i + 1];
      i++;
    }
  }
  const pick = (name) => {
    const v = flags[name] ?? env[`INPUT_${name.replace(/-/g, '_').toUpperCase()}`];
    return v === undefined || v === '' ? undefined : String(v).trim();
  };
  return {
    artifact: pick('artifact'),
    maxTpot: pick('max-tpot'),
    rpc: pick('rpc') ?? DEFAULT_EVM_RPC,
    wss: pick('wss') ?? DEFAULT_WSS,
    from: pick('from') ?? SAMPLE_FROM,
    surface: pick('surface') ?? 'evm',
  };
}

function writeOutputs(env, outputs) {
  if (!env.GITHUB_OUTPUT) return;
  for (const [k, v] of Object.entries(outputs)) appendFileSync(env.GITHUB_OUTPUT, `${k}=${v ?? ''}\n`);
}

function writeSummary(env, lines) {
  if (!env.GITHUB_STEP_SUMMARY) return;
  appendFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}

function usage(msg) {
  console.error(`cost-gate: ${msg}`);
  console.error('usage: node scripts/cost-gate.mjs --artifact <file> --max-tpot <tPOT> [--rpc URL] [--surface evm|cheapest] [--wss URL] [--from 0x…]');
  process.exit(2);
}

async function main() {
  const env = process.env;
  const inp = readInputs(process.argv.slice(2), env);
  if (!inp.artifact) usage('artifact is required.');
  if (!inp.maxTpot) usage('max-tpot is required (a budget is the point of the gate).');
  if (!/^\d+(\.\d+)?$/.test(inp.maxTpot)) usage(`max-tpot must be a decimal tPOT amount: ${inp.maxTpot}.`);
  if (inp.surface !== 'evm' && inp.surface !== 'cheapest') usage(`surface must be evm or cheapest: ${inp.surface}.`);
  if (!isH160(inp.from)) usage(`from must be a 0x… H160 address: ${inp.from}.`);

  let artifact;
  try {
    artifact = readArtifactFile(inp.artifact);
  } catch (e) {
    console.error(`cost-gate: artifact error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }

  let evm;
  try {
    evm = await quoteEvmDeploy(inp.rpc, inp.from, artifact.bytecode, artifact.constructorData);
  } catch (e) {
    evm = { status: 'unavailable', method: 'eth_estimateGas (create)', reason: e instanceof Error ? e.message : String(e) };
  }
  let native = { status: 'unavailable', method: 'revive.instantiateWithCode', reason: 'not requested (surface=evm)' };
  if (inp.surface === 'cheapest') {
    try {
      native = await quoteNativeDeploy(inp.wss, inp.from, artifact.bytecode, artifact.constructorData);
    } catch (e) {
      native = { status: 'unavailable', method: 'revive.instantiateWithCode', reason: e instanceof Error ? e.message : String(e) };
    }
  }

  const comparison = compareDeployCosts(evm, native);
  if (evm.status !== 'ok') {
    console.log(`cost-gate: FAIL — EVM deploy could not be priced (${evm.reason}). An unpriceable deploy never passes.`);
    writeOutputs(env, { cost_tpot: '', max_tpot: inp.maxTpot, over: 'unknown', surface: inp.surface, block: '', ratio_all_in: '' });
    writeSummary(env, ['### NodeScope cost gate: FAIL', '', `EVM deploy could not be priced: \`${evm.reason}\`.`]);
    process.exit(1);
  }

  const evmPlanck = BigInt(evm.totalPlanck);
  let gated = evmPlanck;
  let gatedLeg = 'evm';
  if (inp.surface === 'cheapest' && native.status === 'ok' && BigInt(native.totalPlanck) < evmPlanck) {
    gated = BigInt(native.totalPlanck);
    gatedLeg = 'native';
  }
  const budget = budgetCheck(gated, inp.maxTpot);
  const cost = formatTpot(gated);
  const verdict = budget.over ? 'FAIL' : 'PASS';

  console.log(`cost-gate: ${verdict} — deploy costs ${cost} tPOT on ${gatedLeg} (block #${evm.blockNumber}), budget ${inp.maxTpot} tPOT.`);
  console.log(`  evm: ${formatTpot(evmPlanck)} tPOT (gas ${evm.gas} × price ${evm.gasPrice} wei)`);
  console.log(`  native: ${native.status === 'ok' ? `${formatTpot(BigInt(native.totalPlanck))} tPOT all-in (fee ${formatTpot(BigInt(native.partialFee))} + deposit ${formatTpot(BigInt(native.storageDeposit))})` : `unavailable (${native.reason})`}`);
  if (comparison.ratioAllIn !== null) console.log(`  ratio all-in (EVM ÷ native): ${comparison.ratioAllIn}`);

  writeOutputs(env, {
    cost_tpot: cost,
    max_tpot: inp.maxTpot,
    over: budget.over ? 'true' : 'false',
    surface: gatedLeg,
    block: String(evm.blockNumber),
    ratio_all_in: comparison.ratioAllIn === null ? '' : String(comparison.ratioAllIn),
  });
  writeSummary(env, [
    `### NodeScope cost gate: ${verdict}`,
    '',
    '| | tPOT |',
    '| --- | --- |',
    `| Gated cost (${gatedLeg}) | ${cost} |`,
    `| Budget (max-tpot) | ${inp.maxTpot} |`,
    `| EVM (eth_estimateGas × eth_gasPrice) | ${formatTpot(evmPlanck)} |`,
    `| Native all-in (fee + refundable deposit) | ${native.status === 'ok' ? formatTpot(BigInt(native.totalPlanck)) : `unavailable — ${native.reason}`} |`,
    '',
    `Priced at EVM block #${evm.blockNumber} on ${inp.rpc}. Read-only dry run: nothing was signed or sent.`,
  ]);
  process.exit(budget.over ? 1 : 0);
}

main().catch((e) => {
  console.error(`cost-gate error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
