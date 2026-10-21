import type { EndpointProfile } from '../types/endpoint';

export function defaultLatencyMethodForProfile(profile: EndpointProfile): string {
  return profile === 'portaldot_v3_evm' ? 'eth_chainId' : 'system_health';
}

export function defaultClientVersionMethodForProfile(profile: EndpointProfile): string {
  return profile === 'portaldot_v3_evm' ? 'web3_clientVersion' : 'system_version';
}

export function hasPeerCountSupport(profile: EndpointProfile): boolean {
  return profile !== 'portaldot_v3_evm';
}

export function defaultPeerMethodForProfile(profile: EndpointProfile): string | null {
  return hasPeerCountSupport(profile) ? 'system_health' : null;
}
