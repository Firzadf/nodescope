export const HEAD_GAP_TOLERANCE_BLOCKS: number;

export type TransportHeadStatus = 'unmeasured' | 'within_tolerance' | 'gap_once' | 'persistent_gap';

export interface TransportHeadParity {
  status: TransportHeadStatus;
  persistent: boolean;
  gap: number | null;
  summary: string;
}

export function assessTransportHeads(input?: {
  evmHeight?: unknown;
  wssHeight?: unknown;
  priorAbsGaps?: number[];
}): TransportHeadParity;

export function assessEndpointParity(input?: {
  snapshots?: Array<{
    timestamp?: number;
    checks?: Array<{ method?: string; success?: boolean; outcome?: string; observedValue?: unknown }>;
  }>;
  wsProbe?: { headerNumberDecimal?: string | null; headerNumberHex?: string | null } | null;
  evmHeight?: unknown;
  wssHeight?: unknown;
  priorAbsGaps?: number[];
}): TransportHeadParity;
