export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export type MetricStatus =
  | 'not_tested'
  | 'success'
  | 'unsupported_method'
  | 'network_error'
  | 'invalid_response'
  | 'advertised';

export interface MetricItem<T> {
  status: MetricStatus;
  value: T | null;
  error?: string;
  sourceMethod?: string;
  timestamp?: number;
}

export interface NodeMetricsDetailed {
  latency: MetricItem<number>;
  clientVersion: MetricItem<string>;
  peerCount: MetricItem<number>;
  blockHeight: MetricItem<number | string>;
}

export interface NodeMetrics {
  connectionStatus: ConnectionStatus;
  latency: number | null; // milliseconds
  lastBlock: string | null;
  clientVersion: string | null;
  endpoint: string;
}

export interface RpcEndpoint {
  name: string;
  url: string;
  chainId?: string;
  isCustom?: boolean;
}
