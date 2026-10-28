import { describe, it, expect } from 'vitest';
import { LANGS, landingCopy } from './landingLang';
import { feeLabCopy, feesCopy } from './feesLang';

// Every key path in a copy object, with array indices, so a missing or extra
// item in a translated list fails too.
function keyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return [`${prefix}[len=${value.length}]`, ...value.flatMap((v, i) => keyPaths(v, `${prefix}[${i}]`))];
  }
  if (value !== null && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .flatMap((k) => [`${prefix}.${k}`, ...keyPaths((value as Record<string, unknown>)[k], `${prefix}.${k}`)]);
  }
  return [];
}

describe('language copy parity', () => {
  it('offers EN, ID, and ZH in toggle order', () => {
    expect(LANGS).toEqual(['en', 'id', 'zh']);
  });

  it('zh copy has exactly the same keys as en (landing, fees, Fee Lab)', () => {
    expect(keyPaths(landingCopy.zh)).toEqual(keyPaths(landingCopy.en));
    expect(keyPaths(feesCopy.zh)).toEqual(keyPaths(feesCopy.en));
    expect(keyPaths(feeLabCopy.zh)).toEqual(keyPaths(feeLabCopy.en));
  });
});
