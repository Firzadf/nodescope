#!/usr/bin/env node
/**
 * estimate-attestation-native.mjs — native-surface cost estimate for deploying
 * NodeScopeAttestation, using the Fee Lab's own dry-run logic.
 *
 * Replicates src/services/feeLab/native.ts quoteReviveInstantiate in plain
 * Node (no bundler, no signing, no key):
 *   - WsProvider(wss, false) + explicit provider.connect() inside a 10s
 *     timeout (the same fix that unblocked the Fee Lab native leg),
 *   - reviveApi.instantiate dry-run with DRY_RUN_DEPOSIT_LIMIT (10^22),
 *   - the real revive.instantiateWithCode extrinsic weighed with paymentInfo.
 *
 * The dry-run origin is a throwaway H160 sample (the Fee Lab's own dry-run
 * origin); nothing is signed, so the origin only shapes the weight estimate.
 *
 * Usage:
 *   node scripts/estimate-attestation-native.mjs --code 0x... [--origin 0x...] [--wss wss://...]
 * Prints one JSON object on stdout and exits 0, or prints {"error": ...}
 * and exits 1 on failure/timeout.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ApiPromise, WsProvider } = require('@polkadot/api');

const DRY_RUN_DEPOSIT_LIMIT = 10n ** 22n;
const EE_SUFFIX = 'ee'.repeat(12);
const NATIVE_DECIMALS = 14;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

function h160ToAccountId32(h160) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(h160)) throw new Error(`invalid H160 origin: ${h160}`);
  return `0x${h160.slice(2).toLowerCase()}${EE_SUFFIX}`;
}

function fail(message) {
  console.log(JSON.stringify({ error: message }));
  process.exit(1);
}

function withTimeout(promise, ms, onTimeout) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try { onTimeout?.(); } catch { /* ignore */ }
      reject(new Error('timed out'));
    }, ms);
  });
  return Promise.race([
    promise.then(
      (v) => { clearTimeout(timer); return v; },
      (e) => { clearTimeout(timer); throw e; },
    ),
    timeout,
  ]);
}

function depositOf(sd) {
  if (!sd) return 0n;
  if (sd.isCharge) return sd.asCharge.toBigInt();
  return 0n; // Refund -> no charge
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
    } catch { /* fallthrough */ }
  }
  return err.toString();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const code = args.code;
  const wss = args.wss || 'wss://test-node-v3.portaldot.dev';
  const originH160 = args.origin || '0x03c502abb79e8eee50135c91933d059d982dd912';
  if (!code || !/^0x[0-9a-fA-F]+$/.test(code)) fail('missing or invalid --code (0x-prefixed creation bytecode)');
  const origin = h160ToAccountId32(originH160);

  const provider = new WsProvider(wss, false);
  let api = null;
  try {
    await withTimeout(
      (async () => {
        await provider.connect();
        api = await ApiPromise.create({ provider, noInitWarn: true, throwOnConnect: true });
      })(),
      10000,
      () => { try { void provider.disconnect(); } catch { /* ignore */ } },
    );
    const quote = await withTimeout(
      (async () => {
        const dry = await api.call.reviveApi.instantiate(
          origin, 0n, null, DRY_RUN_DEPOSIT_LIMIT, { Upload: code }, '0x', null,
        );
        const err = dryRunError(api, dry.result);
        if (err) throw new Error(`revive dry-run failed: ${err}`);
        const sd = depositOf(dry.storageDeposit);
        const tx = api.tx.revive.instantiateWithCode(
          0n, dry.weightRequired, sd > 0n ? sd : 1n, code, '0x', null,
        );
        const [info, header] = await Promise.all([
          tx.paymentInfo(origin),
          api.rpc.chain.getHeader(),
        ]);
        return {
          partialFee: info.partialFee.toBigInt(),
          storageDeposit: sd,
          refTime: dry.weightRequired.refTime.toBigInt(),
          proofSize: dry.weightRequired.proofSize.toBigInt(),
          blockNumber: header.number.toNumber(),
        };
      })(),
      15000,
    );
    const allIn = quote.partialFee + quote.storageDeposit;
    const fmt = (planck) => Number(planck) / 10 ** NATIVE_DECIMALS;
    console.log(JSON.stringify({
      method: 'revive.instantiateWithCode',
      partialFeePlanck: quote.partialFee.toString(),
      storageDepositPlanck: quote.storageDeposit.toString(),
      allInPlanck: allIn.toString(),
      feeOnlyTPOT: fmt(quote.partialFee),
      storageDepositTPOT: fmt(quote.storageDeposit),
      allInTPOT: fmt(allIn),
      weight: { refTime: quote.refTime.toString(), proofSize: quote.proofSize.toString() },
      blockNumber: quote.blockNumber,
    }));
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  } finally {
    try { if (api) await api.disconnect(); } catch { /* ignore */ }
    try { await provider.disconnect(); } catch { /* ignore */ }
  }
}

main();
