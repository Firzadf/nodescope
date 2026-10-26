import { keccakAsU8a, decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { u8aToHex, hexToU8a } from '@polkadot/util';

/**
 * pallet-revive account mapping (as used on Portaldot V3):
 *  - H160 -> AccountId32: "fallback" account = h160 ++ 0xEE * 12.
 *  - AccountId32 -> H160: if it ends with 12 x 0xEE it is Ethereum-derived, so take the first 20 bytes;
 *    otherwise H160 = last 20 bytes of keccak256(accountId32).
 * Verified against the runtime API `ReviveApi.address` on 2026-10-26.
 * Native accounts that called `revive.map_account` keep their original AccountId32 for
 * Substrate-origin calls; EVM-origin calls from their H160 resolve back to them.
 */
const EE_SUFFIX = 'ee'.repeat(12);

export function isH160(v: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(v);
}

export function h160ToAccountId32(h160: string): `0x${string}` {
  if (!isH160(h160)) throw new Error(`invalid H160: ${h160}`);
  return `0x${h160.slice(2).toLowerCase()}${EE_SUFFIX}`;
}

export function accountId32ToH160(account: string | Uint8Array): `0x${string}` {
  const bytes = typeof account === 'string'
    ? (account.startsWith('0x') ? hexToU8a(account) : decodeAddress(account))
    : account;
  if (bytes.length !== 32) throw new Error('AccountId32 must be 32 bytes');
  const hex = u8aToHex(bytes);
  if (hex.endsWith(EE_SUFFIX)) return hex.slice(0, 42) as `0x${string}`;
  return u8aToHex(keccakAsU8a(bytes).slice(12)) as `0x${string}`;
}

export function isEthDerived(account: string | Uint8Array): boolean {
  const bytes = typeof account === 'string'
    ? (account.startsWith('0x') ? hexToU8a(account) : decodeAddress(account))
    : account;
  return u8aToHex(bytes).endsWith(EE_SUFFIX);
}

/** SS58 (prefix 42 on Portaldot V3) for any H160's fallback account. */
export function h160ToSs58(h160: string, ss58Format = 42): string {
  return encodeAddress(hexToU8a(h160ToAccountId32(h160)), ss58Format);
}
