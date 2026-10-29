import { describe, expect, it } from 'vitest';
import { endpointVerdict, flagMostBehind, sortFleet, type FleetRow } from './fleet';

function row(id: string, block: string | null, score: number | null = 90): FleetRow {
  return {
    id,
    label: id,
    url: `https://${id}.example.test`,
    kind: 'evm',
    verdict: 'healthy',
    score,
    block,
    finalityLag: 1,
    peers: 2,
    latencyMs: 40,
    error: null,
    behind: false,
  };
}

describe('fleet', () => {
  it('flags only the node whose head is strictly behind', () => {
    const flagged = flagMostBehind([row('a', '100'), row('b', '90'), row('c', '100')]);
    expect(flagged.find((r) => r.id === 'b')?.behind).toBe(true);
    expect(flagged.filter((r) => r.behind)).toHaveLength(1);
    expect(flagMostBehind([row('a', '100'), row('b', '100')]).every((r) => !r.behind)).toBe(true);
    expect(flagMostBehind([row('a', '100')]).every((r) => !r.behind)).toBe(true);
  });

  it('sorts by block and keeps a missing block at the low end', () => {
    const sorted = sortFleet([row('a', '10'), row('b', null), row('c', '30')], 'block', 'desc');
    expect(sorted.map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('lets one transport be healthy, and a stall outrank the score', () => {
    expect(endpointVerdict(true, false, 'healthy')).toBe('healthy');
    expect(endpointVerdict(true, true, 'healthy')).toBe('stalled');
    expect(endpointVerdict(false, true, 'critical')).toBe('down');
    expect(endpointVerdict(true, false, 'critical')).toBe('degraded');
  });
});
