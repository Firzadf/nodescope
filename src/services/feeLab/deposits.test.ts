import { describe, expect, it } from 'vitest';
import { byteLengthOfHex, callDepositParts, splitReviveDeposit } from './deposits';

describe('revive deposit split', () => {
  it('splits a deploy into code bytes and the remaining item storage', () => {
    const parts = splitReviveDeposit(1_000n, 10, 50n);
    expect(parts.codeDeposit).toBe(500n);
    expect(parts.itemStorageDeposit).toBe(500n);
  });

  it('withholds the split when the per-byte estimate exceeds the dry-run total', () => {
    expect(splitReviveDeposit(100n, 10, 50n)).toEqual({ codeDeposit: null, itemStorageDeposit: null });
    expect(splitReviveDeposit(100n, null, 50n)).toEqual({ codeDeposit: null, itemStorageDeposit: null });
  });

  it('counts hex bytes and treats a call hold as item storage', () => {
    expect(byteLengthOfHex('0xabcd')).toBe(2);
    expect(byteLengthOfHex('0xabc')).toBeNull();
    expect(callDepositParts(80n)).toEqual({ codeDeposit: 0n, itemStorageDeposit: 80n });
  });
});
