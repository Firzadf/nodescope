import { describe, it, expect } from 'vitest';
import { buildFeeLabShareParams, parseFeeLabShareParams } from './feeLabShare';

describe('feeLabShare', () => {
  it('round-trips custom deploy state through the URL', () => {
    const state = {
      from: '0x03c502abb79e8eee50135c91933d059d982dd912',
      code: '0x608060',
      args: '0x0001',
    };
    const parsed = parseFeeLabShareParams(`?${buildFeeLabShareParams(state)}`);
    expect(parsed).toEqual(state);
  });

  it('omits empty args and drops an invalid from', () => {
    const parsed = parseFeeLabShareParams(`?${buildFeeLabShareParams({ code: '0x6080', from: 'nope' })}`);
    expect(parsed).toEqual({ code: '0x6080' });
  });

  it('parses to null without a usable code', () => {
    expect(parseFeeLabShareParams('')).toBeNull();
    expect(parseFeeLabShareParams('?op=transfer')).toBeNull();
    expect(parseFeeLabShareParams('?op=deploy&code=not-hex')).toBeNull();
  });
});
