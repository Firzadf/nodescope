/**
 * Storage-deposit split for a read-only Revive dry-run.
 *
 * The dry-run returns one reserved total. Where the runtime exposes
 * depositPerByte, a deploy's code deposit is estimated as that constant
 * times the code length, and the remainder is treated as item storage.
 * If that estimate exceeds the dry-run total, the split is withheld.
 *
 * Refunds, as described for Portaldot:
 * - Code deposit: when the code is no longer referenced by any contract
 *   and the removal conditions are met, the original uploader can remove
 *   the code and receive the deposit refund.
 * - Item storage deposit: after contract termination, storage cleanup is
 *   performed and the deposit is refunded.
 *
 * Neither path is executed here. Nothing is signed or submitted.
 */

export const DEPOSIT_REASON_SUFFIX =
  ' Native storage deposit is a refundable reserved hold, not burned. Code deposit is refunded when the code is no longer referenced by any contract and the original uploader removes it. Item storage deposit is refunded after contract termination, once storage cleanup runs. The EVM gas figure already includes that hold.';

export function byteLengthOfHex(code: string): number | null {
  const hex = code.startsWith('0x') || code.startsWith('0X') ? code.slice(2) : code;
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  return hex.length / 2;
}

export function splitReviveDeposit(
  storageDeposit: bigint,
  codeBytes: number | null,
  depositPerByte: bigint | null,
): { codeDeposit: bigint | null; itemStorageDeposit: bigint | null } {
  if (codeBytes === null || depositPerByte === null || depositPerByte <= 0n || storageDeposit < 0n) {
    return { codeDeposit: null, itemStorageDeposit: null };
  }
  const codeDeposit = depositPerByte * BigInt(codeBytes);
  if (codeDeposit <= 0n || codeDeposit > storageDeposit) {
    return { codeDeposit: null, itemStorageDeposit: null };
  }
  return { codeDeposit, itemStorageDeposit: storageDeposit - codeDeposit };
}

/** A call does not upload code, so the dry-run hold is item storage. */
export function callDepositParts(storageDeposit: bigint): { codeDeposit: bigint; itemStorageDeposit: bigint } {
  const hold = storageDeposit > 0n ? storageDeposit : 0n;
  return { codeDeposit: 0n, itemStorageDeposit: hold };
}
