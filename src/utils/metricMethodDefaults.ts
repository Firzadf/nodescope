import type { EndpointProfile } from '../types/endpoint';

export function defaultLatencyMethodForProfile(profile: EndpointProfile): string {
  return profile === 'portaldot_v3_evm' ? 'eth_chainId' : 'system_health';
}

export function defaultClientVersionMethodForProfile(profile: EndpointProfile): string {
  return profile === 'portaldot_v3_evm' ? 'web3_clientVersion' : 'system_version';
}

/**
 * Every profile now has a peer query: the EVM profile uses net_peerCount,
 * other profiles use system_health. The parameter stays so call sites keep
 * their shape and a future profile can opt out again; it is intentionally
 * unused for now.
 */
export function hasPeerCountSupport(_profile: EndpointProfile): boolean {
  return true;
}

export function defaultPeerMethodForProfile(profile: EndpointProfile): string | null {
  if (profile === 'portaldot_v3_evm') return 'net_peerCount';
  return hasPeerCountSupport(profile) ? 'system_health' : null;
}
