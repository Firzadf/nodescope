export function liveBadgeStatus(
  evm: string,
  wss: string | null,
  deps?: Record<string, unknown>,
): Promise<{
  verdict: string;
  score: number | null;
  coverage: number;
  formula: string;
  checkedAt: string;
  bestHeight: string | null;
  finalizedHeight: string | null;
  finalityLag: number | null;
  peers: number | null;
  isSyncing: boolean | null;
  latencyMs: number | null;
  chain: string | null;
  explanation: string;
  detail: string;
  stall: string;
  band: string | null;
}>;
