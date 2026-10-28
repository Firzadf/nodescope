/**
 * Native units the node reports (system_properties) versus the 18-decimal
 * unit EVM tooling assumes. Portaldot V3 testnet reports tokenDecimals 14
 * and tokenSymbol tPOT. Treating a 14-decimal balance as wei is a
 * 10^(18−14) = 10,000× overstatement — the decimal trap.
 */

export const EVM_WEI_DECIMALS = 18;

export const ADDRESS_RULE_TEXT =
  'pallet-revive AccountId32Mapper: fallback account is the H160 followed by twelve 0xEE bytes. ' +
  'An account whose last twelve bytes are 0xEE maps back by stripping that suffix. ' +
  'Any other AccountId32 maps to keccak256(account)[12:32]. ' +
  'A stored OriginalAccount entry overrides the fallback; only the runtime API can see that.';

export interface UnitsSanity {
  symbol: string | null;
  ss58Format: number | null;
  /** Distinct decimal values the node reported. More than one is a mismatch. */
  decimals: number[];
  nativeDecimals: number | null;
  evmDecimals: number;
  mismatch: boolean;
  /** True when the native decimals are not the EVM default of 18. */
  decimalTrap: boolean;
  /** 10^(18−native) when native < 18. */
  trapFactor: string | null;
  detail: string;
}

function asDecimals(value: unknown): number[] {
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  const out: number[] = [];
  for (const item of list) {
    const n = typeof item === 'number' ? item : typeof item === 'string' && /^\d+$/.test(item) ? Number(item) : NaN;
    if (Number.isInteger(n) && n >= 0 && n <= 36) out.push(n);
  }
  return out;
}

export function unitsFromProperties(props: {
  tokenDecimals?: unknown;
  tokenSymbol?: unknown;
  ss58Format?: unknown;
} | null): UnitsSanity {
  if (!props) {
    return {
      symbol: null,
      ss58Format: null,
      decimals: [],
      nativeDecimals: null,
      evmDecimals: EVM_WEI_DECIMALS,
      mismatch: false,
      decimalTrap: false,
      trapFactor: null,
      detail: 'system_properties has not been read.',
    };
  }
  const decimals = [...new Set(asDecimals(props.tokenDecimals))];
  const symbol = typeof props.tokenSymbol === 'string'
    ? props.tokenSymbol
    : Array.isArray(props.tokenSymbol) && props.tokenSymbol.every((s) => typeof s === 'string')
      ? (props.tokenSymbol as string[]).join(' / ')
      : null;
  const ss58Format = typeof props.ss58Format === 'number' ? props.ss58Format : null;
  const mismatch = decimals.length > 1;
  const nativeDecimals = decimals.length === 1 ? decimals[0] : null;
  const decimalTrap = nativeDecimals !== null && nativeDecimals !== EVM_WEI_DECIMALS;
  const trapFactor = decimalTrap && nativeDecimals !== null && nativeDecimals < EVM_WEI_DECIMALS
    ? (10n ** BigInt(EVM_WEI_DECIMALS - nativeDecimals)).toString()
    : null;
  let detail: string;
  if (props.tokenDecimals == null && symbol === null) {
    detail = 'The node did not report token decimals or a symbol.';
  } else if (mismatch) {
    detail = `The node reported more than one tokenDecimals value (${decimals.join(', ')}). They disagree.`;
  } else if (decimalTrap && nativeDecimals !== null) {
    detail = `Native ${symbol ?? 'token'} uses ${nativeDecimals} decimals. EVM tooling assumes ${EVM_WEI_DECIMALS}. Reading a native balance as wei overstates it ${trapFactor ?? '?'}×.`;
  } else if (nativeDecimals !== null) {
    detail = `Native decimals (${nativeDecimals}) match the EVM default. No decimal trap on the unit scale.`;
  } else {
    detail = 'tokenDecimals was missing or not a number.';
  }
  return { symbol, ss58Format, decimals, nativeDecimals, evmDecimals: EVM_WEI_DECIMALS, mismatch, decimalTrap, trapFactor, detail };
}
