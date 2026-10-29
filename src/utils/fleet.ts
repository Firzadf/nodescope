import type { OverallVerdict } from './overallVerdict';

/** Per-endpoint verdict. A single transport can be HEALTHY on its own. */
export function endpointVerdict(
  answered: boolean,
  stall: boolean,
  band: 'healthy' | 'degraded' | 'critical' | null,
): OverallVerdict {
  if (!answered) return 'down';
  if (stall) return 'stalled';
  if (band === null || band === 'healthy') return 'healthy';
  return 'degraded';
}

/** One row of the multi-node view. Numbers come from a check the user started. */
export interface FleetRow {
  id: string;
  label: string;
  url: string;
  kind: 'evm' | 'wss';
  verdict: OverallVerdict;
  score: number | null;
  block: string | null;
  finalityLag: number | null;
  peers: number | null;
  latencyMs: number | null;
  error: string | null;
  /** True for the node whose head is strictly behind another node that answered. */
  behind: boolean;
}

export type FleetSortKey = 'label' | 'verdict' | 'score' | 'block' | 'finalityLag' | 'peers' | 'latencyMs';

const VERDICT_RANK: Record<OverallVerdict, number> = {
  healthy: 4,
  degraded: 3,
  stalled: 2,
  down: 1,
  not_checked: 0,
};

function num(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

/** Mark the lowest answered head when at least one other node is ahead. */
export function flagMostBehind(rows: FleetRow[]): FleetRow[] {
  const heights = rows
    .map((row) => ({ id: row.id, height: num(row.block) }))
    .filter((row): row is { id: string; height: number } => row.height !== null);
  if (heights.length < 2) return rows.map((row) => ({ ...row, behind: false }));
  const min = Math.min(...heights.map((row) => row.height));
  const max = Math.max(...heights.map((row) => row.height));
  if (min === max) return rows.map((row) => ({ ...row, behind: false }));
  const behindIds = new Set(heights.filter((row) => row.height === min).map((row) => row.id));
  return rows.map((row) => ({ ...row, behind: behindIds.has(row.id) }));
}

export function sortFleet(rows: FleetRow[], key: FleetSortKey, direction: 'asc' | 'desc' = 'asc'): FleetRow[] {
  const sign = direction === 'asc' ? 1 : -1;
  const value = (row: FleetRow): number | string => {
    if (key === 'label') return row.label.toLowerCase();
    if (key === 'verdict') return VERDICT_RANK[row.verdict];
    if (key === 'block') return num(row.block) ?? Number.NEGATIVE_INFINITY;
    const raw = row[key];
    return typeof raw === 'number' ? raw : Number.NEGATIVE_INFINITY;
  };
  return [...rows].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * sign;
    return ((av as number) - (bv as number)) * sign;
  });
}
