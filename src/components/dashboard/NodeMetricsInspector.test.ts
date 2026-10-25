import { describe, expect, it } from 'vitest';
import { defaultBlockMethodForProfile } from '../../utils/blockMethodDefaults';
import {
  defaultLatencyMethodForProfile,
  defaultClientVersionMethodForProfile,
  hasPeerCountSupport,
  defaultPeerMethodForProfile,
} from '../../utils/metricMethodDefaults';

describe('defaultBlockMethodForProfile', () => {
  it('returns eth_blockNumber for portaldot_v3_evm profile', () => {
    expect(defaultBlockMethodForProfile('portaldot_v3_evm')).toBe('eth_blockNumber');
  });

  it('returns chain_getHeader for generic_http profile', () => {
    expect(defaultBlockMethodForProfile('generic_http')).toBe('chain_getHeader');
  });

  it('EVM profile does not default to chain_getHeader', () => {
    expect(defaultBlockMethodForProfile('portaldot_v3_evm')).not.toBe('chain_getHeader');
  });

  it('generic_http profile does not default to eth_blockNumber', () => {
    expect(defaultBlockMethodForProfile('generic_http')).not.toBe('eth_blockNumber');
  });
});

describe('defaultLatencyMethodForProfile', () => {
  it('returns eth_chainId for portaldot_v3_evm profile', () => {
    expect(defaultLatencyMethodForProfile('portaldot_v3_evm')).toBe('eth_chainId');
  });

  it('returns system_health for generic_http profile', () => {
    expect(defaultLatencyMethodForProfile('generic_http')).toBe('system_health');
  });
});

describe('defaultClientVersionMethodForProfile', () => {
  it('returns web3_clientVersion for portaldot_v3_evm profile', () => {
    expect(defaultClientVersionMethodForProfile('portaldot_v3_evm')).toBe('web3_clientVersion');
  });

  it('returns system_version for generic_http profile', () => {
    expect(defaultClientVersionMethodForProfile('generic_http')).toBe('system_version');
  });
});

describe('hasPeerCountSupport', () => {
  it('returns true for portaldot_v3_evm profile (net_peerCount works on the V3 EVM RPC)', () => {
    expect(hasPeerCountSupport('portaldot_v3_evm')).toBe(true);
  });

  it('returns true for generic_http profile', () => {
    expect(hasPeerCountSupport('generic_http')).toBe(true);
  });
});

describe('defaultPeerMethodForProfile', () => {
  it('returns net_peerCount for portaldot_v3_evm profile', () => {
    expect(defaultPeerMethodForProfile('portaldot_v3_evm')).toBe('net_peerCount');
  });

  it('returns system_health for generic_http profile', () => {
    expect(defaultPeerMethodForProfile('generic_http')).toBe('system_health');
  });
});
