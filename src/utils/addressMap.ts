import { decodeAddress, encodeAddress, keccak256AsU8a } from '@polkadot/util-crypto';
import { hexToU8a, u8aToHex } from '@polkadot/util';

/**
 * pallet-revive AccountId32Mapper, verified against the Polkadot SDK
 * `frame/revive/src/address.rs` and against a live `ReviveApi_account_id`
 * / `ReviveApi_address` state_call on wss://test-node-v3.portaldot.dev
 * (28 Oct 2026):
 *
 * - Fallback H160 → AccountId32: the 20 address bytes, then twelve 0xEE
 *   bytes. Contracts and secp256k1 wallets use this stateless form.
 *   `to_account_id` returns it when no OriginalAccount storage entry exists.
 * - AccountId32 → H160, eth-derived (last 12 bytes are 0xEE): the first
 *   20 bytes. The suffix is stripped, not hashed.
 * - AccountId32 → H160, anything else: keccak256(account)[12..32].
 *
 * The stateful direction (an sr25519 account mapped back to its H160 via
 * OriginalAccount) is NOT guessed. Confirm with the runtime API. If that
 * call differs from the fallback, the storage mapping wins and the UI
 * says so.
 */

const EE = 0xee;

export interface AddressMapping {
  h160: string;
  /** Stateless fallback: H160 || 0xEE × 12. */
  fallbackAccountId: string;
  ss58: string;
  ss58Prefix: number;
  ethDerived: boolean;
  /** How the H160 was obtained from the account, when the input was an account. */
  rule: 'fallback-suffix' | 'strip-ee-suffix' | 'keccak256-last-20';
}

function bytesToHex(bytes: Uint8Array): string {
  return u8aToHex(bytes);
}

export function isEthDerivedAccount(account: Uint8Array): boolean {
  if (account.length !== 32) return false;
  for (let i = 20; i < 32; i++) if (account[i] !== EE) return false;
  return true;
}

/** H160 (20 bytes) → fallback AccountId32. */
export function h160ToFallbackAccountId(h160: Uint8Array): Uint8Array {
  if (h160.length !== 20) throw new Error('H160 must be 20 bytes.');
  const out = new Uint8Array(32);
  out.set(h160, 0);
  out.fill(EE, 20);
  return out;
}

/** AccountId32 → H160, using the stateless rule (no storage). */
export function accountIdToH160(account: Uint8Array): { h160: Uint8Array; rule: 'strip-ee-suffix' | 'keccak256-last-20' } {
  if (account.length !== 32) throw new Error('AccountId32 must be 32 bytes.');
  if (isEthDerivedAccount(account)) {
    return { h160: account.slice(0, 20), rule: 'strip-ee-suffix' };
  }
  const hash = keccak256AsU8a(account);
  return { h160: hash.slice(12), rule: 'keccak256-last-20' };
}

function parseHex(input: string): Uint8Array | null {
  const trimmed = input.trim();
  if (!/^0x[0-9a-fA-F]+$/.test(trimmed) || trimmed.length % 2 !== 0) return null;
  try {
    return hexToU8a(trimmed);
  } catch {
    return null;
  }
}

/**
 * Accept an H160 (0x + 20 bytes), an AccountId32 (0x + 32 bytes), or an
 * SS58 address. ss58Prefix defaults to 42, which is what the V3 testnet
 * reports in system_properties.
 */
export function mapAddress(input: string, ss58Prefix = 42): AddressMapping {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Enter an H160, an AccountId32 hex, or an SS58 address.');
  const hex = parseHex(trimmed);
  if (hex && hex.length === 20) {
    const account = h160ToFallbackAccountId(hex);
    return {
      h160: bytesToHex(hex),
      fallbackAccountId: bytesToHex(account),
      ss58: encodeAddress(account, ss58Prefix),
      ss58Prefix,
      ethDerived: true,
      rule: 'fallback-suffix',
    };
  }
  let account: Uint8Array;
  if (hex && hex.length === 32) account = hex;
  else {
    try {
      account = decodeAddress(trimmed);
    } catch {
      throw new Error('Not an H160 (20 bytes), an AccountId32 (32 bytes), or an SS58 address.');
    }
    if (account.length !== 32) throw new Error('Decoded address is not 32 bytes.');
  }
  const { h160, rule } = accountIdToH160(account);
  const fallback = h160ToFallbackAccountId(h160);
  return {
    h160: bytesToHex(h160),
    fallbackAccountId: bytesToHex(isEthDerivedAccount(account) ? account : fallback),
    ss58: encodeAddress(isEthDerivedAccount(account) ? account : fallback, ss58Prefix),
    ss58Prefix,
    ethDerived: isEthDerivedAccount(account),
    rule,
  };
}

