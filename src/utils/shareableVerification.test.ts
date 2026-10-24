import { describe, it, expect } from 'vitest';
import {
  buildAttestationShareLink,
  parseShareParams,
  DEPLOYED_REGISTRY_ADDRESS,
} from './shareableVerification';

const HASH = '0x0bc787de4c634a55699e92d90b7280fffebdbcd557c4312044134e4df9dfa286';
const TX = '0xa7cd3cbd060335d851494c1f48e15124ec8d32ccfa3fe03413c85cf895625448';

describe('shareableVerification', () => {
  it('parses a full share link and drops invalid values', () => {
    expect(parseShareParams(`?hash=${HASH}&contract=${DEPLOYED_REGISTRY_ADDRESS}&tx=${TX}`)).toEqual({
      hash: HASH,
      contract: DEPLOYED_REGISTRY_ADDRESS,
      tx: TX,
    });
    expect(parseShareParams('?hash=0x123&contract=nope&tx=0x123')).toEqual({});
  });

  it('builds a /verify link only when all three values are valid', () => {
    expect(buildAttestationShareLink('https://nodescope.vercel.app', {
      hash: HASH,
      contract: DEPLOYED_REGISTRY_ADDRESS,
      tx: TX,
    })).toBe(`https://nodescope.vercel.app/verify?hash=${HASH}&contract=${DEPLOYED_REGISTRY_ADDRESS}&tx=${TX}`);
    expect(buildAttestationShareLink('https://nodescope.vercel.app', { hash: HASH })).toBeNull();
  });
});
