import type { EndpointProfile } from '../types/endpoint';

export function defaultBlockMethodForProfile(profile: EndpointProfile): string {
  return profile === 'portaldot_v3_evm' ? 'eth_blockNumber' : 'chain_getHeader';
}
