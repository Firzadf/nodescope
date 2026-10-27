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
 *   check: 0 healthy, 1 degraded/down, 2 usage error.
 *   fees:  0 priced and within budget, 1 EVM leg unavailable or budget
 *          exceeded, 2 usage/artifact error. A native leg that is
 *          unavailable is a warning in the output, not a failure: the EVM
 *          leg alone still gates the deploy cost.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

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
    try {
      const value = await rpcCall(rpcUrl, method, [], timeoutMs);
      checks.push({ method, ok: true, value: typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value), error: null });
    } catch (e) {
      checks.push({ method, ok: false, value: null, error: e instanceof Error ? e.message : String(e) });
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
  const verdict = answered === 0 ? 'down' : answered === checks.length && !chainMismatch ? 'healthy' : 'degraded';
  return {
    verdict,
    rpc: rpcUrl,
    chainId,
    chainMismatch,
    blockNumber,
    checks,
  };
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
    reason += ' Native storage deposit is reserved (refundable when storage is freed); the EVM gas figure already folds it in.';
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

const VERDICT_RANK = { healthy: 2, degraded: 1, down: 0 };

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

export function checkAlertText(kind, prev, result, at = new Date()) {
  const head =
    kind === 'degrade'
      ? `NodeScope: node DEGRADED (${prev} → ${result.verdict})`
      : kind === 'recover'
        ? `NodeScope: node RECOVERED (${prev} → ${result.verdict})`
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
