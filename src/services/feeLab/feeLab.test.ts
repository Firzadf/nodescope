// Pure-logic tests for the fee-estimation code. No network:
// every case here runs on constants and bigint math only.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  SAMPLE,
  accountId32ToH160,
  compareLegs,
  erc20TransferCalldata,
  estimateBoth,
  estimateNative,
  formatUnits,
  h160ToAccountId32,
  h160ToSs58,
  hexToBigInt,
  isH160,
  parseUnits,
  planckToWei,
  ratio,
  rescale,
  serializeComparison,
  toEvmTx,
  toHex,
  validateTx,
  weiToPlanck,
  type DualTx,
  type EvmLeg,
  type NativeLeg,
} from './estimate';
import { evmRpc } from './evm';
import { withTimeout } from './native';
import type { ApiPromise } from '@polkadot/api';

const evmOk = (totalPlanck: bigint): EvmLeg => ({
  status: 'ok',
  method: 'eth_estimateGas',
  gas: 100000n,
  gasPrice: 1000n,
  feeWei: 100000000n,
  totalPlanck,
  blockNumber: 1,
});

const nativeOk = (partialFee: bigint, storageDeposit: bigint): NativeLeg => ({
  status: 'ok',
  method: 'revive.call',
  partialFee,
  storageDeposit,
  totalPlanck: partialFee + storageDeposit,
  weight: { refTime: 1n, proofSize: 1n },
  blockNumber: 1,
});

describe('units', () => {
  it('formats and parses amounts', () => {
    expect(formatUnits(1000000n, 6)).toBe('1');
    expect(formatUnits(1500000n, 6)).toBe('1.5');
    expect(formatUnits(0n, 6)).toBe('0');
    expect(formatUnits(1234567000000n, 6)).toBe('1,234,567');
    expect(parseUnits('1', 14)).toBe(10n ** 14n);
    expect(parseUnits('1.5', 6)).toBe(1500000n);
    expect(() => parseUnits('abc', 6)).toThrow();
    expect(() => parseUnits('1.1234567', 6)).toThrow();
  });

  it('rescales between wei and planck, truncating dust', () => {
    expect(weiToPlanck(10n ** 18n, 18, 14)).toBe(10n ** 14n);
    expect(planckToWei(10n ** 14n, 14, 18)).toBe(10n ** 18n);
    expect(rescale(1999n, 3, 0)).toBe(1n);
    expect(ratio(200n, 100n)).toBe(2);
    expect(ratio(1n, 0n)).toBeNull();
  });

  it('converts hex', () => {
    expect(hexToBigInt('0x190f1ca9')).toBe(420420777n);
    expect(hexToBigInt('0x')).toBe(0n);
    expect(() => hexToBigInt('zz')).toThrow();
    expect(toHex(255n)).toBe('0xff');
  });
});

describe('mapping', () => {
  it('maps H160 to the fallback AccountId32 and back', () => {
    const h160 = '0x03c502abb79e8eee50135c91933d059d982dd912';
    expect(isH160(h160)).toBe(true);
    expect(isH160('0x1234')).toBe(false);
    const account = h160ToAccountId32(h160);
    expect(account).toBe(`0x${h160.slice(2).toLowerCase()}${'ee'.repeat(12)}`);
    expect(accountId32ToH160(account)).toBe(h160.toLowerCase());
    expect(() => h160ToAccountId32('nope')).toThrow();
    expect(h160ToSs58(h160)).toHaveLength(48);
  });
});

describe('compareLegs', () => {
  it('ties within the 2% band and reports both ratios', () => {
    const c = compareLegs(evmOk(100n), nativeOk(60n, 40n));
    expect(c.recommended).toBe('either');
    expect(c.ratioAllIn).toBe(1);
    expect(c.ratioVsNativeFeeOnly).toBeCloseTo(100 / 60, 5);
  });

  it('picks the cheaper side outside the band', () => {
    expect(compareLegs(evmOk(50n), nativeOk(60n, 40n)).recommended).toBe('evm');
    expect(compareLegs(evmOk(500n), nativeOk(60n, 40n)).recommended).toBe('native');
  });

  it('explains the refundable deposit in the reason', () => {
    const c = compareLegs(evmOk(500n), nativeOk(60n, 40n));
    expect(c.reason).toMatch(/refundable/);
  });

  it('handles unavailable legs', () => {
    const down: EvmLeg = { status: 'unavailable', method: 'eth_estimateGas', reason: 'boom' };
    expect(compareLegs(down, nativeOk(60n, 40n)).recommended).toBe('native');
    const nativeDown: NativeLeg = { status: 'unavailable', method: 'revive.call', reason: 'boom' };
    expect(compareLegs(down, nativeDown).recommended).toBeNull();
    expect(compareLegs(down, nativeDown).ratioAllIn).toBeNull();
  });

  it('serializes bigints as decimal strings', () => {
    const c = compareLegs(evmOk(100n), nativeOk(60n, 40n));
    const parsed = JSON.parse(serializeComparison(c)) as { evm: { totalPlanck: unknown } };
    expect(parsed.evm.totalPlanck).toBe('100');
  });
});

describe('tx mapping and validation', () => {
  it('maps each op to its EVM equivalent', () => {
    const from = SAMPLE.holder;
    expect(toEvmTx({ kind: 'nativeTransfer', from, to: SAMPLE.existingEoa, amountPlanck: 10n ** 14n })?.value).toBe(10n ** 18n);
    const erc = toEvmTx({ kind: 'erc20Transfer', from, token: SAMPLE.erc20Token, to: SAMPLE.existingRecipient, amount: 1n });
    expect(erc?.to).toBe(SAMPLE.erc20Token);
    expect(erc?.data?.startsWith('0xa9059cbb')).toBe(true);
    expect(toEvmTx({ kind: 'contractDeploy', from, bytecode: '0x6080' })?.data).toBe('0x6080');
    expect(toEvmTx({ kind: 'calldata', from, data: '0x1234' })?.data).toBe('0x1234');
    expect(toEvmTx({ kind: 'assetsTransfer', from, assetId: 7777, to: SAMPLE.existingEoa, amount: 1n })).toBeNull();
  });

  it('rejects bad addresses and hex', () => {
    expect(() => validateTx({ kind: 'nativeTransfer', from: 'nope', to: SAMPLE.existingEoa, amountPlanck: 1n })).toThrow();
    expect(() => validateTx({ kind: 'erc20Transfer', from: SAMPLE.holder, token: 'nope', to: SAMPLE.existingRecipient, amount: 1n })).toThrow();
    expect(() => erc20TransferCalldata('nope', 1n)).toThrow();
    expect(() =>
      validateTx({ kind: 'contractDeploy', from: SAMPLE.holder, bytecode: '0x6080' }),
    ).not.toThrow();
  });

  it('pins the public sample data the panel defaults to', () => {
    expect(SAMPLE.erc20Decimals).toBe(6);
    expect(SAMPLE.nativeAssetId).toBe(7777);
    expect(isH160(SAMPLE.holder)).toBe(true);
    expect(isH160(SAMPLE.erc20Token)).toBe(true);
  });
});

// Timeout and retry behavior: a stalled native connection must still
// yield a result (EVM ok, native unavailable: timed out), never a hang.
describe('timeouts and retries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // An api whose calls never resolve: transferKeepAlive's paymentInfo and
  // the chain head both hang, like a WSS socket that opened but stays silent.
  const hangingApi = {
    tx: { balances: { transferKeepAlive: () => ({ paymentInfo: () => new Promise(() => {}) }) } },
    rpc: { chain: { getHeader: () => new Promise(() => {}) } },
  } as unknown as ApiPromise;

  const transfer: DualTx = {
    kind: 'nativeTransfer',
    from: '0x0000000000000000000000000000000000000001',
    to: '0x0000000000000000000000000000000000000002',
    amountPlanck: 1000n,
  };

  it('withTimeout rejects a never-resolving promise', async () => {
    await expect(withTimeout(new Promise(() => {}), 20)).rejects.toThrow('timed out');
  });

  it('estimateNative with a hanging api returns unavailable: timed out', async () => {
    const leg = await estimateNative(transfer, { api: hangingApi, estimateTimeoutMs: 50 });
    expect(leg.status).toBe('unavailable');
    if (leg.status === 'unavailable') {
      expect(leg.method).toBe('balances.transferKeepAlive');
      expect(leg.reason).toBe('timed out');
    }
  });

  it('estimateBoth with a hanging native api still resolves: EVM ok, native timed out', async () => {
    vi.stubGlobal('fetch', async (_url: unknown, init: { body: string }) => {
      const body = JSON.parse(init.body) as { id: number; method: string };
      const result = body.method === 'eth_gasPrice' ? '0x3b9aca00' : '0x5208';
      return { ok: true, json: async () => ({ jsonrpc: '2.0', id: body.id, result }) };
    });
    const comparison = await estimateBoth(transfer, { api: hangingApi, estimateTimeoutMs: 50 });
    expect(comparison.evm.status).toBe('ok');
    expect(comparison.native.status).toBe('unavailable');
    if (comparison.native.status === 'unavailable') {
      expect(comparison.native.method).toBe('balances.transferKeepAlive');
      expect(comparison.native.reason).toBe('timed out');
    }
  });
});

describe('evmRpc retries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries once on network failure, then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', id: 1, result: '0x190f1ca9' }),
      });
    vi.stubGlobal('fetch', fetchMock);
    await expect(evmRpc('https://example.invalid', 'eth_chainId')).resolves.toBe('0x190f1ca9');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails with a plain-language error after the retry is exhausted', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(evmRpc('https://example.invalid', 'eth_chainId')).rejects.toThrow('network error after 1 retry');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry HTTP errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    await expect(evmRpc('https://example.invalid', 'eth_chainId')).rejects.toThrow('HTTP 500');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
