#!/usr/bin/env node
/**
 * nodescope CLI — "check the node + price the deploy before you deploy".
 *
 * Plain Node, no bundler, no build step: CI runs Node 20, and the app's
 * TypeScript sources use extensionless imports that Node cannot resolve
 * without a bundler. So this CLI ports the Fee Lab's estimation logic to
 * plain .mjs, explicitly, with the same semantics:
 *   - EVM leg: eth_estimateGas x eth_gasPrice (the gas figure already folds
 *     the storage deposit in), same as src/services/feeLab/evm.ts.
 *   - Native leg: ReviveApi.instantiate dry-run + paymentInfo, reported as
 *     partialFee + storage deposit separately, same as
 *     src/services/feeLab/native.ts quoteReviveInstantiate — including the
 *     WsProvider(url, false) + explicit provider.connect() fix that
 *     unblocked the Fee Lab native leg (autoConnect stays false: one
 *     explicit connection attempt, no reconnect loop).
 *   - Comparison: the same 2% tie band and reason strings as
 *     src/services/feeLab/compare.ts compareLegs.
 *   - Health verdict: the same method set as the app's portaldot_v3_evm
 *     profile (eth_chainId, eth_blockNumber, web3_clientVersion,
 *     net_version) and the same verdict vocabulary (healthy / degraded /
 *     down) as the app's sticky verdict bar.
 *
 * The browser app remains the source of truth for these semantics; the
 * vitest suite covers the shared pure helpers there, and cli/*.test.mjs
 * covers this port (parsing, verdicts, budgets, exit codes, and a mocked
 * RPC server). If the app logic changes, this file must change with it —
 * that is the documented cost of a zero-dependency CLI.
 *
 * Nothing here signs, sends, or asks for a key. The --from address is only
 * a dry-run origin. Nothing is published to npm: the package stays
 * private, and `npx nodescope` works from a repo checkout via the bin
 * entry in package.json. Publishing is a separate manual step by the user.
 *
 * Exit codes:
 *   check: 0 healthy, 1 degraded/stalled/down, 2 usage error.
 *   fees:  0 priced and within budget, 1 EVM leg unavailable or budget
 *          exceeded, 2 usage/artifact error. A native leg that is
 *          unavailable is a warning in the output, not a failure: the EVM
 *          leg alone still gates the deploy cost.
 */

import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';
import { assessStall, computeHealthScoreV2, formatPrometheus } from '../shared/liveStatus.mjs';
import { paceRequest } from '../shared/requestPace.mjs';

export { formatPrometheus };

export const DEFAULT_EVM_RPC = 'https://test-evm-rpc-v3.portaldot.dev';
export const DEFAULT_WSS = 'wss://test-node-v3.portaldot.dev';
export const PORTALDOT_CHAIN_ID = 420420777;
export const NATIVE_DECIMALS = 14;
export const EVM_DECIMALS = 18;
/** Dry-run origin only (the Fee Lab's sample holder). Nothing is signed. */
export const SAMPLE_FROM = '0x03c502abb79e8eee50135c91933d059d982dd912';
export const DRY_RUN_DEPOSIT_LIMIT = 10n ** 22n;
export const TIE_BAND = 0.02;

const EE_SUFFIX = 'ee'.repeat(12);

export function isH160(v) {
  return /^0x[0-9a-fA-F]{40}$/.test(v);
}

function h160ToAccountId32(h160) {
  if (!isH160(h160)) throw new Error(`invalid H160: ${h160}`);
  return `0x${h160.slice(2).toLowerCase()}${EE_SUFFIX}`;
}

function pow10(n) {
  if (!Number.isInteger(n) || n < 0) throw new Error(`invalid decimals: ${n}`);
  return 10n ** BigInt(n);
}

export function rescale(amount, fromDecimals, toDecimals) {
  if (fromDecimals === toDecimals) return amount;
  if (fromDecimals > toDecimals) return amount / pow10(fromDecimals - toDecimals);
  return amount * pow10(toDecimals - fromDecimals);
}

export function weiToPlanck(wei, evmDecimals = EVM_DECIMALS, nativeDecimals = NATIVE_DECIMALS) {
  return rescale(wei, evmDecimals, nativeDecimals);
}

/** Port of src/services/feeLab/units.ts formatUnits (bigint math only). */
export function formatTpot(amount, decimals = NATIVE_DECIMALS, maxFraction = 6) {
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const base = pow10(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, '0').slice(0, Math.max(0, maxFraction));
  frac = frac.replace(/0+$/, '');
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const s = frac ? `${wholeStr}.${frac}` : wholeStr;
  if (abs > 0n && whole === 0n && !frac) {
    return `${neg ? '-' : ''}<0.${'0'.repeat(Math.max(0, maxFraction - 1))}1`;
  }
  return neg ? `-${s}` : s;
}

/** Port of src/services/feeLab/units.ts parseUnits (decimal string -> planck). */
export function parseTpot(value, decimals = NATIVE_DECIMALS) {
  const v = String(value).trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(`invalid amount: ${value}`);
  const [w, f = ''] = v.split('.');
  if (f.length > decimals) throw new Error(`too many decimals (max ${decimals})`);
  return BigInt(w) * pow10(decimals) + BigInt(f.padEnd(decimals, '0') || '0');
}

function hexToBigInt(hex) {
  if (!/^0x[0-9a-fA-F]*$/.test(hex)) throw new Error(`not hex: ${hex}`);
  return hex === '0x' ? 0n : BigInt(hex);
}

function ratio(a, b) {
  if (b === 0n) return null;
  const SCALE = 1_000_000n;
  return Number((a * SCALE) / b) / Number(SCALE);
}

/** One JSON-RPC call: 10s per attempt, one retry on network failure only
 * (same policy as the app's evmRpc: aborts are never retried). */
export async function rpcCall(url, method, params = [], timeoutMs = 10000) {
  let lastNetworkError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    await paceRequest(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: attempt + 1, method, params }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(`${method}: ${json.error.message} (code ${json.error.code})`);
      return json.result;
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof Error && (e.message.startsWith(`${method}:`) || e.name === 'AbortError')) {
        if (e.name === 'AbortError') throw new Error(`${method}: request timed out (${timeoutMs}ms)`);
        throw e;
      }
      lastNetworkError = e;
      if (attempt === 0) continue;
      throw new Error(`${method}: network error after 1 retry`);
    }
  }
  throw lastNetworkError instanceof Error ? lastNetworkError : new Error(String(lastNetworkError));
}

const HEALTH_METHODS = ['eth_chainId', 'eth_blockNumber', 'web3_clientVersion', 'net_version'];

/**
 * Health verdict for one EVM RPC endpoint. Same verdict vocabulary as the
 * app's sticky verdict bar: healthy (every method answered and the chain
 * id matches Portaldot V3), degraded (partial answers or a chain id
 * mismatch), down (nothing answered).
 */
export async function checkNode(rpcUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 10000;
  const checks = [];
  for (const method of HEALTH_METHODS) {
    const started = Date.now();
    try {
      const value = await rpcCall(rpcUrl, method, [], timeoutMs);
      checks.push({ method, ok: true, value: typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value), latencyMs: Date.now() - started, error: null });
    } catch (e) {
      checks.push({ method, ok: false, value: null, latencyMs: Date.now() - started, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const chainCheck = checks.find((c) => c.method === 'eth_chainId');
  const blockCheck = checks.find((c) => c.method === 'eth_blockNumber');
  let chainId = null;
  let chainMismatch = false;
  if (chainCheck?.ok) {
    try {
      chainId = Number(hexToBigInt(chainCheck.value));
      chainMismatch = chainId !== PORTALDOT_CHAIN_ID;
    } catch {
      chainMismatch = true;
    }
  }
  let blockNumber = null;
  if (blockCheck?.ok) {
    try {
      blockNumber = Number(hexToBigInt(blockCheck.value));
    } catch {
      blockNumber = null;
    }
  }
  const answered = checks.filter((c) => c.ok).length;
  let blockTimestamp = null;
  if (answered > 0) {
    try {
      const block = await rpcCall(rpcUrl, 'eth_getBlockByNumber', ['latest', false], timeoutMs);
      if (block && typeof block.timestamp === 'string' && /^0x[0-9a-fA-F]+$/.test(block.timestamp)) {
        blockTimestamp = Number(BigInt(block.timestamp));
      }
    } catch {
      blockTimestamp = null;
    }
  }
  let substrate = null;
  if (opts.wss) {
    try {
      substrate = await probeSubstrateFinality(opts.wss, timeoutMs);
    } catch (e) {
      substrate = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  let reliability = null;
  if (opts.reliability) {
    reliability = await reliabilitySample(rpcUrl, opts.reliability, timeoutMs);
  }
  const observedAt = Date.now();
  const bestHeight = blockNumber !== null ? String(blockNumber) : null;
  const stall = assessStall({
    nowMs: observedAt,
    rpcAnswered: answered > 0 || substrate?.ok === true,
    bestSamples: [],
    bestTimestampSec: blockTimestamp,
    finalizedTimestampSec: null,
    bestHeight,
    finalizedHeight: substrate?.finalizedBlock != null ? String(substrate.finalizedBlock) : null,
  });
  let verdict = answered === 0 ? 'down' : answered === checks.length && !chainMismatch ? 'healthy' : 'degraded';
  if (answered > 0 && stall.state === 'stalled') verdict = 'stalled';
  const snapshot = {
    timestamp: observedAt,
    endpointOrigin: rpcUrl,
    endpointProfile: 'cli',
    checks: checks.map((c) => ({ method: c.method, success: c.ok, outcome: c.ok ? 'success' : 'network_error', latencyMs: c.latencyMs, observedValue: c.value })),
  };
  const wsProbe = substrate?.ok
    ? {
        status: 'ok',
        chain: substrate.chain,
        peers: substrate.peers,
        isSyncing: substrate.isSyncing,
        shouldHavePeers: substrate.shouldHavePeers,
        headerNumberDecimal: substrate.bestBlock != null ? String(substrate.bestBlock) : null,
        finalizedNumberDecimal: substrate.finalizedBlock != null ? String(substrate.finalizedBlock) : null,
        syncCurrentBlock: substrate.syncCurrent,
        syncHighestBlock: substrate.syncHighest,
      }
    : substrate
      ? { status: 'error', error: substrate.error }
      : null;
  const score = computeHealthScoreV2({
    snapshots: answered > 0 ? [snapshot] : [],
    wsProbe,
    motion: blockTimestamp !== null ? { bestTimestampSec: blockTimestamp, observedAtMs: observedAt, bestHeight } : null,
    reliability,
  });
  return {
    verdict,
    rpc: rpcUrl,
    chainId,
    chainMismatch,
    blockNumber,
    blockTimestamp,
    bestAgeSeconds: stall.bestAgeSeconds,
    stall: stall.state,
    stallExplanation: stall.explanation,
    finalizedBlock: substrate?.finalizedBlock ?? null,
    finalityLag: substrate?.lag ?? stall.finalityLagBlocks,
    peers: substrate?.peers ?? null,
    isSyncing: substrate?.isSyncing ?? null,
    sync: substrate?.ok ? { current: substrate.syncCurrent, highest: substrate.syncHighest } : null,
    score: score.score,
    scoreBand: score.band,
    coverage: score.coverage,
    formula: score.formula,
    reliability,
    checks,
  };
}

async function reliabilitySample(rpcUrl, samples, timeoutMs) {
  const n = Math.min(20, Math.max(1, Number(samples) || 1));
  const latencies = [];
  let errors = 0;
  let http5xx = 0;
  for (let i = 0; i < n; i++) {
    const started = Date.now();
    try {
      await rpcCall(rpcUrl, 'eth_blockNumber', [], timeoutMs);
      latencies.push(Date.now() - started);
    } catch (e) {
      errors += 1;
      const msg = e instanceof Error ? e.message : String(e);
      if (/HTTP 5\d\d/.test(msg)) http5xx += 1;
    }
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const pick = (p) => (sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]);
  return { samples: n, errors, http5xx, p50Ms: pick(50), p95Ms: pick(95) };
}

/** Read-only finality and peer snapshot. Optional methods that fail do not fail the probe. */
export async function probeSubstrateFinality(url, timeoutMs = 10000) {
  const calls = [
    ['system_health', []],
    ['system_chain', []],
    ['chain_getHeader', []],
    ['chain_getFinalizedHead', []],
    ['system_syncState', []],
  ];
  const answers = await wsRpc(url, calls, timeoutMs);
  const health = answers[0];
  const header = answers[2];
  const finHash = typeof answers[3] === 'string' ? answers[3] : null;
  let finHeader = null;
  if (finHash && /^0x[0-9a-fA-F]{64}$/.test(finHash)) {
    try {
      const more = await wsRpc(url, [['chain_getHeader', [finHash]]], timeoutMs);
      finHeader = more[0];
    } catch {
      finHeader = null;
    }
  }
  const best = header?.number ? Number(BigInt(header.number)) : null;
  const fin = finHeader?.number ? Number(BigInt(finHeader.number)) : null;
  const sync = answers[4] && typeof answers[4] === 'object' ? answers[4] : null;
  return {
    ok: true,
    chain: typeof answers[1] === 'string' ? answers[1] : null,
    peers: typeof health?.peers === 'number' ? health.peers : null,
    isSyncing: typeof health?.isSyncing === 'boolean' ? health.isSyncing : null,
    shouldHavePeers: typeof health?.shouldHavePeers === 'boolean' ? health.shouldHavePeers : null,
    bestBlock: best,
    finalizedBlock: fin,
    lag: best !== null && fin !== null ? best - fin : null,
    syncCurrent: sync?.currentBlock != null ? String(sync.currentBlock) : null,
    syncHighest: sync?.highestBlock != null ? String(sync.highestBlock) : null,
  };
}

function wsRpc(url, calls, timeoutMs) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    const results = new Array(calls.length);
    const got = new Set();
    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* closed */ }
      reject(new Error(`WebSocket timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    ws.onopen = () => {
      void (async () => {
        for (let i = 0; i < calls.length; i++) {
          const [method, params] = calls[i];
          await paceRequest(url);
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: i + 1, method, params }));
        }
      })();
    };
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (typeof parsed.id !== 'number') return;
      if (parsed.error) {
        results[parsed.id - 1] = null;
      } else {
        results[parsed.id - 1] = parsed.result;
      }
      got.add(parsed.id);
      if (got.size === calls.length) {
        clearTimeout(timer);
        try { ws.close(); } catch { /* closed */ }
        resolve(results);
      }
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error('WebSocket error'));
    };
  });
}

export function prometheusReading(result) {
  return formatPrometheus({
    up: result.verdict === 'down' ? 0 : 1,
    verdict: result.verdict,
    score: result.score,
    stalled: result.stall === 'stalled',
    bestBlock: result.blockNumber,
    finalizedBlock: result.finalizedBlock,
    finalityLag: result.finalityLag,
    peers: result.peers,
    syncing: result.isSyncing,
    bestAgeSeconds: result.bestAgeSeconds,
    rpcSamples: result.reliability?.samples ?? null,
    rpcErrors: result.reliability?.errors ?? null,
    rpcP50: result.reliability?.p50Ms ?? null,
    rpcP95: result.reliability?.p95Ms ?? null,
  });
}

export function writeMetricsFile(path, text) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}

/**
 * Parse a contract artifact into creation bytecode + constructor data.
 * Accepts: a solc JSON artifact (bytecode, bytecode.object, or
 * evm.bytecode.object), a plain JSON object with a bytecode field, or raw
 * 0x hex text. Optional constructor args come from a `constructorArgs` or
 * `constructorData` hex field. Every failure names the problem plainly —
 * an invalid artifact never produces an invented estimate.
 */
export function parseArtifact(text) {
  const trimmed = String(text).trim();
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    return { bytecode: trimmed, constructorData: '' };
  }
  let obj;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    throw new Error('Artifact is not valid JSON and not raw 0x bytecode. Provide a solc artifact JSON (with evm.bytecode.object) or raw creation bytecode.');
  }
  if (typeof obj === 'string' && /^0x[0-9a-fA-F]+$/.test(obj.trim())) {
    return { bytecode: obj.trim(), constructorData: '' };
  }
  if (!obj || typeof obj !== 'object') {
    throw new Error('Artifact JSON must be an object with a creation bytecode field, not a bare value.');
  }
  const pick = (v) => (typeof v === 'string' ? v : v && typeof v.object === 'string' ? v.object : null);
  const bytecode = pick(obj.bytecode) ?? pick(obj.evm?.bytecode) ?? null;
  if (!bytecode) {
    if (pick(obj.deployedBytecode) ?? pick(obj.evm?.deployedBytecode)) {
      throw new Error('Artifact contains only deployedBytecode (runtime code). NodeScope needs creation bytecode (evm.bytecode.object) to price a deploy.');
    }
    throw new Error('No creation bytecode found in artifact. Expected one of: bytecode, bytecode.object, or evm.bytecode.object.');
  }
  if (!/^0x[0-9a-fA-F]+$/.test(bytecode)) {
    throw new Error('Bytecode must be 0x-prefixed hex.');
  }
  const rawArgs = obj.constructorArgs ?? obj.constructorData ?? '';
  if (rawArgs !== '' && !/^0x[0-9a-fA-F]*$/.test(rawArgs)) {
    throw new Error('constructorArgs must be 0x-prefixed hex (ABI-encoded constructor arguments).');
  }
  return { bytecode, constructorData: rawArgs === '0x' ? '' : rawArgs };
}

export function readArtifactFile(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`Cannot read artifact file: ${path}`);
  }
  return parseArtifact(text);
}

/** EVM deploy leg: eth_estimateGas x eth_gasPrice, same as the Fee Lab. */
export async function quoteEvmDeploy(rpcUrl, from, bytecode, constructorData, opts = {}) {
  if (!isH160(from)) throw new Error(`from must be a 0x… H160 address: ${from}`);
  const data = bytecode + (constructorData ?? '').replace(/^0x/, '');
  const [gasHex, priceHex, blockHex] = await Promise.all([
    rpcCall(rpcUrl, 'eth_estimateGas', [{ from, data }], opts.timeoutMs),
    rpcCall(rpcUrl, 'eth_gasPrice', [], opts.timeoutMs),
    rpcCall(rpcUrl, 'eth_blockNumber', [], opts.timeoutMs),
  ]);
  const gas = hexToBigInt(gasHex);
  const gasPrice = hexToBigInt(priceHex);
  const feeWei = gas * gasPrice;
  return {
    status: 'ok',
    method: 'eth_estimateGas (create)',
    gas: gas.toString(),
    gasPrice: gasPrice.toString(),
    feeWei: feeWei.toString(),
    totalPlanck: weiToPlanck(feeWei).toString(),
    blockNumber: Number(hexToBigInt(blockHex)),
  };
}

function withTimeout(promise, ms, onTimeout) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try {
        onTimeout?.();
      } catch {
        // ignore teardown errors
      }
      reject(new Error('timed out'));
    }, ms);
  });
  return Promise.race([
    promise.then(
      (v) => {
        clearTimeout(timer);
        return v;
      },
      (e) => {
        clearTimeout(timer);
        throw e;
      },
    ),
    timeout,
  ]);
}

function depositOf(sd) {
  if (!sd) return 0n;
  if (sd.isCharge) return sd.asCharge.toBigInt();
  return 0n;
}

function dryRunError(api, result) {
  if (result.isOk) {
    const ok = result.asOk;
    const flags = ok.result ? ok.result.flags : ok.flags;
    if (flags && flags.bits && flags.bits.toNumber && (flags.bits.toNumber() & 1) === 1) return 'contract reverted';
    return null;
  }
  const err = result.asErr;
  if (err.isModule) {
    try {
      const meta = api.registry.findMetaError(err.asModule);
      return `${meta.section}.${meta.name}`;
    } catch {
      // fallthrough
    }
  }
  return err.toString();
}

/**
 * Native deploy leg: ReviveApi.instantiate dry-run + paymentInfo on the
 * real revive.instantiateWithCode extrinsic. Mirrors
 * src/services/feeLab/native.ts quoteReviveInstantiate, including the
 * explicit provider.connect() inside the timeout.
 */
export async function quoteNativeDeploy(wssUrl, from, bytecode, constructorData, opts = {}) {
  if (!isH160(from)) throw new Error(`from must be a 0x… H160 address: ${from}`);
  const connectTimeoutMs = opts.connectTimeoutMs ?? 10000;
  const estimateTimeoutMs = opts.estimateTimeoutMs ?? 15000;
  const require = createRequire(import.meta.url);
  const { ApiPromise, WsProvider } = require('@polkadot/api');
  const provider = new WsProvider(wssUrl, false);
  let api = null;
  try {
    await withTimeout(
      (async () => {
        await provider.connect();
        api = await ApiPromise.create({ provider, noInitWarn: true, throwOnConnect: true });
      })(),
      connectTimeoutMs,
      () => {
        try {
          void provider.disconnect();
        } catch {
          // ignore
        }
      },
    );
    const origin = h160ToAccountId32(from);
    const data = constructorData && constructorData !== '0x' ? constructorData : '0x';
    const quote = await withTimeout(
      (async () => {
        const dry = await api.call.reviveApi.instantiate(origin, 0n, null, DRY_RUN_DEPOSIT_LIMIT, { Upload: bytecode }, data, null);
        const err = dryRunError(api, dry.result);
        if (err) throw new Error(`revive dry-run failed: ${err}`);
        const sd = depositOf(dry.storageDeposit);
        const tx = api.tx.revive.instantiateWithCode(0n, dry.weightRequired, sd > 0n ? sd : 1n, bytecode, data, null);
        const [info, header] = await Promise.all([tx.paymentInfo(origin), api.rpc.chain.getHeader()]);
        return {
          partialFee: info.partialFee.toBigInt(),
          storageDeposit: sd,
          refTime: dry.weightRequired.refTime.toBigInt(),
          proofSize: dry.weightRequired.proofSize.toBigInt(),
          blockNumber: header.number.toNumber(),
        };
      })(),
      estimateTimeoutMs,
    );
    const total = quote.partialFee + quote.storageDeposit;
    return {
      status: 'ok',
      method: 'revive.instantiateWithCode',
      partialFee: quote.partialFee.toString(),
      storageDeposit: quote.storageDeposit.toString(),
      totalPlanck: total.toString(),
      weight: { refTime: quote.refTime.toString(), proofSize: quote.proofSize.toString() },
      blockNumber: quote.blockNumber,
    };
  } finally {
    try {
      if (api) await api.disconnect();
    } catch {
      // ignore
    }
    try {
      await provider.disconnect();
    } catch {
      // ignore
    }
  }
}

/**
 * Compare the two deploy legs. Port of compareLegs semantics: all-in vs
 * all-in, the fee-only ratio shown alongside, a 2% tie band, and the same
 * reason strings. Legs here carry decimal-string bigints (JSON-safe).
 */
export function compareDeployCosts(evm, native) {
  const measuredAt = new Date().toISOString();
  if (evm.status !== 'ok' && native.status !== 'ok') {
    return { evm, native, ratioAllIn: null, ratioVsNativeFeeOnly: null, recommended: null, savingsPlanck: '0', reason: 'Neither surface could be estimated.', measuredAt };
  }
  if (evm.status !== 'ok') {
    return { evm, native, ratioAllIn: null, ratioVsNativeFeeOnly: null, recommended: 'native', savingsPlanck: '0', reason: `Only native is available (EVM: ${evm.reason}).`, measuredAt };
  }
  if (native.status !== 'ok') {
    return { evm, native, ratioAllIn: null, ratioVsNativeFeeOnly: null, recommended: 'evm', savingsPlanck: '0', reason: `Only EVM is available (native: ${native.reason}).`, measuredAt };
  }
  const e = BigInt(evm.totalPlanck);
  const n = BigInt(native.totalPlanck);
  const r = ratio(e, n);
  const rFee = ratio(e, BigInt(native.partialFee));
  const diff = e > n ? e - n : n - e;
  const bigger = e > n ? e : n;
  const rel = bigger === 0n ? 0 : Number((diff * 1_000_000n) / bigger) / 1_000_000;
  let recommended;
  let reason;
  if (rel <= TIE_BAND) {
    recommended = 'either';
    reason = `All-in costs are within ${(TIE_BAND * 100).toFixed(0)}% — pick by wallet/UX.`;
  } else if (e < n) {
    recommended = 'evm';
    reason = `EVM is cheaper all-in by ${(rel * 100).toFixed(1)}%.`;
  } else {
    recommended = 'native';
    reason = `Native is cheaper all-in by ${(rel * 100).toFixed(1)}%.`;
  }
  if (BigInt(native.storageDeposit) > 0n) {
    reason += ' Native storage deposit is a refundable reserved hold, not burned. Code deposit is refunded when the code is no longer referenced by any contract and the original uploader removes it. Item storage deposit is refunded after contract termination, once storage cleanup runs. The EVM gas figure already includes that hold.';
  }
  return { evm, native, ratioAllIn: r, ratioVsNativeFeeOnly: rFee, recommended, savingsPlanck: diff.toString(), reason, measuredAt };
}

/** Budget check: is the priced all-in cost above --max-tpot? */
export function budgetCheck(allInPlanck, maxTpot) {
  const maxPlanck = parseTpot(maxTpot);
  return { maxTpot: String(maxTpot), maxPlanck: maxPlanck.toString(), over: allInPlanck > maxPlanck };
}

/* ------------------------------------------------------------------------ */
/* Alert webhooks (port of src/utils/alertWebhook.ts, Node side: no CORS).  */
/* ------------------------------------------------------------------------ */

const VERDICT_RANK = { healthy: 3, degraded: 2, stalled: 1, down: 0 };

export function detectWebhookKind(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  if (['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com'].includes(host) && u.pathname.startsWith('/api/webhooks/')) return 'discord';
  if (host === 'hooks.slack.com' && /^\/(services|workflows|triggers)\//.test(u.pathname)) return 'slack';
  return null;
}

/** degrade / recover / null — same rule as the app: the first observation is the baseline. */
export function detectTransition(prev, next) {
  if (prev == null || !(prev in VERDICT_RANK) || !(next in VERDICT_RANK)) return null;
  if (VERDICT_RANK[next] < VERDICT_RANK[prev]) return 'degrade';
  if (VERDICT_RANK[next] > VERDICT_RANK[prev]) return 'recover';
  return null;
}

/** Same stall/resume rule as the app. Unknown and the first sample are the baseline. */
export function detectStallTransition(prev, next) {
  if (prev == null || prev === 'unknown') return null;
  if (prev !== 'stalled' && next === 'stalled') return 'stall';
  if (prev === 'stalled' && next === 'live') return 'resume';
  return null;
}

export function alertKindForCycle(prevVerdict, nextVerdict, prevStall, nextStall) {
  const stall = detectStallTransition(prevStall, nextStall);
  if (stall) return stall;
  return detectTransition(prevVerdict, nextVerdict);
}

export function checkAlertText(kind, prev, result, at = new Date()) {
  const head =
    kind === 'degrade'
      ? `NodeScope: node DEGRADED (${prev} → ${result.verdict})`
      : kind === 'recover'
        ? `NodeScope: node RECOVERED (${prev} → ${result.verdict})`
        : kind === 'stall'
          ? `NodeScope: chain STALLED (${prev} → ${result.verdict}). Chain paused but RPC answers.`
          : kind === 'resume'
            ? `NodeScope: chain RESUMED (${prev} → ${result.verdict}).`
            : `NodeScope: node ${String(result.verdict).toUpperCase()}`;
  const failed = result.checks.filter((c) => !c.ok).map((c) => c.method);
  return [
    head,
    `Endpoint: ${result.rpc}`,
    `Block: ${result.blockNumber ?? 'not observed'}`,
    `Failed checks: ${failed.length ? failed.join(', ') : 'none'}${result.chainMismatch ? ' (chain id mismatch)' : ''}`,
    `At: ${at.toISOString()}`,
    'Read-only check from the nodescope CLI. Nothing was signed.',
  ].join('\n');
}

export async function postWebhook(url, text, fetchImpl = globalThis.fetch) {
  const kind = detectWebhookKind(url);
  if (!kind) throw new Error('not a Discord or Slack webhook URL (https only)');
  const body = kind === 'discord' ? { username: 'NodeScope', content: text, allowed_mentions: { parse: [] } } : { text };
  const res = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`webhook answered HTTP ${res.status}`);
  return { kind, status: res.status };
}

/* ------------------------------------------------------------------------ */
/* RPC endpoint benchmark: latency + consistency across endpoints.          */
/* ------------------------------------------------------------------------ */

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

/**
 * Benchmark one or more EVM endpoints with the same read-only calls:
 * `samples` rounds of eth_blockNumber (timed, sequential per endpoint,
 * all endpoints in parallel per round) plus one eth_chainId each.
 * Reports p50/p95/max latency, error count, the chain id, and the head
 * height of the LAST round, then a consistency block: do the chain ids
 * agree, and how far apart are the heads (max − min) in that last round.
 * A head spread is reported, never judged: endpoints can legitimately be a
 * block or two apart between two calls.
 */
export async function benchEndpoints(urls, opts = {}) {
  const samples = opts.samples ?? 5;
  const timeoutMs = opts.timeoutMs ?? 10000;
  const now = opts.now ?? (() => performance.now());
  const results = await Promise.all(
    urls.map(async (url) => {
      let chainId = null;
      try {
        chainId = Number(hexToBigInt(await rpcCall(url, 'eth_chainId', [], timeoutMs)));
      } catch {
        chainId = null;
      }
      return { url, chainId, latencies: [], errors: 0, lastHead: null, lastError: null };
    }),
  );
  for (let round = 0; round < samples; round++) {
    await Promise.all(
      results.map(async (r) => {
        const t0 = now();
        try {
          const head = await rpcCall(r.url, 'eth_blockNumber', [], timeoutMs);
          r.latencies.push(Math.round(now() - t0));
          r.lastHead = Number(hexToBigInt(head));
        } catch (e) {
          r.errors += 1;
          r.lastError = e instanceof Error ? e.message : String(e);
        }
      }),
    );
  }
  const endpoints = results.map((r) => {
    const sorted = [...r.latencies].sort((a, b) => a - b);
    return {
      url: r.url,
      chainId: r.chainId,
      ok: r.latencies.length,
      errors: r.errors,
      p50Ms: percentile(sorted, 50),
      p95Ms: percentile(sorted, 95),
      maxMs: sorted.length ? sorted[sorted.length - 1] : null,
      head: r.lastHead,
      lastError: r.lastError,
    };
  });
  const ids = [...new Set(endpoints.map((e) => e.chainId).filter((x) => x !== null))];
  const heads = endpoints.map((e) => e.head).filter((h) => h !== null);
  const answering = endpoints.filter((e) => e.ok > 0);
  const fastest = answering.length ? answering.reduce((a, b) => (a.p50Ms <= b.p50Ms ? a : b)).url : null;
  return {
    samples,
    endpoints,
    consistency: {
      chainIdsAgree: ids.length <= 1,
      chainIds: ids,
      headSpread: heads.length >= 2 ? Math.max(...heads) - Math.min(...heads) : null,
      expectedChain: ids.length === 1 && ids[0] === PORTALDOT_CHAIN_ID,
    },
    fastest,
  };
}
