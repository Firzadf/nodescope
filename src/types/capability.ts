export type DiscoveryStatus =
  | 'success'
  | 'unsupported_method'
  | 'transport_error'
  | 'invalid_response'
  | 'not_attempted';

export interface AdvertisedMethod {
  method: string;
  evidence: 'advertised';
}

export interface CapabilitySnapshot {
  endpointOrigin: string;
  discoveredAt: string;
  discoveryStatus: DiscoveryStatus;
  safeAdvertisedMethods: AdvertisedMethod[];
  rawMethodCount: number;
  latencyMs: number | null;
  error: string | null;
}
