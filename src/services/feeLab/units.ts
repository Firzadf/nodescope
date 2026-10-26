/** Pure bigint unit math. No floating point is used for amounts. */

export function pow10(n: number): bigint {
  if (!Number.isInteger(n) || n < 0) throw new Error(`invalid decimals: ${n}`);
  return 10n ** BigInt(n);
}

/**
 * Convert an amount between decimal bases. Down-scaling truncates toward zero
 * (same as pallet-revive, which drops "dust" below 1 planck when converting wei -> planck).
 */
export function rescale(amount: bigint, fromDecimals: number, toDecimals: number): bigint {
  if (fromDecimals === toDecimals) return amount;
  if (fromDecimals > toDecimals) return amount / pow10(fromDecimals - toDecimals);
  return amount * pow10(toDecimals - fromDecimals);
}

/** EVM wei (18 dp) -> native planck (14 dp). */
export function weiToPlanck(wei: bigint, evmDecimals = 18, nativeDecimals = 14): bigint {
  return rescale(wei, evmDecimals, nativeDecimals);
}

/** Native planck (14 dp) -> EVM wei (18 dp). */
export function planckToWei(planck: bigint, nativeDecimals = 14, evmDecimals = 18): bigint {
  return rescale(planck, nativeDecimals, evmDecimals);
}

/** Format a bigint amount with `decimals` into a human string with at most `maxFraction` digits. */
export function formatUnits(amount: bigint, decimals: number, maxFraction = 6): string {
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

/** Parse a decimal string into a bigint with `decimals`. */
export function parseUnits(value: string, decimals: number): bigint {
  const v = value.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(`invalid amount: ${value}`);
  const [w, f = ''] = v.split('.');
  if (f.length > decimals) throw new Error(`too many decimals (max ${decimals})`);
  return BigInt(w) * pow10(decimals) + BigInt(f.padEnd(decimals, '0') || '0');
}

/** a / b as a float with ~6 significant digits; returns null when b is 0. */
export function ratio(a: bigint, b: bigint): number | null {
  if (b === 0n) return null;
  const SCALE = 1_000_000n;
  return Number((a * SCALE) / b) / Number(SCALE);
}

export function hexToBigInt(hex: string): bigint {
  if (!/^0x[0-9a-fA-F]*$/.test(hex)) throw new Error(`not hex: ${hex}`);
  return hex === '0x' ? 0n : BigInt(hex);
}

export function toHex(n: bigint): string {
  return '0x' + n.toString(16);
}
