import { describe, expect, it } from 'vitest';
import { computeHealthScoreV2 } from './healthScore';
import {
  canonicalWeights,
  loadCustomWeights,
  resetCustomWeights,
  saveCustomWeights,
  scoreWithCustomWeights,
  weightsMatchCanonical,
} from './customWeights';

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe('custom weighting', () => {
  it('matches the canonical score when the weights are the published ones', () => {
    const snapshots = [{
      timestamp: 1_000_000,
      endpointOrigin: 'https://rpc.example',
      endpointProfile: 'portaldot_v3_evm' as const,
      checks: [
        { method: 'eth_chainId', success: true, outcome: 'success' as const, observedValue: '0x190f1ca9', latencyMs: 100, error: null },
        { method: 'eth_blockNumber', success: true, outcome: 'success' as const, observedValue: '0x10', latencyMs: 100, error: null },
      ],
    }];
    const canonical = computeHealthScoreV2({ snapshots });
    const again = computeHealthScoreV2({ snapshots });
    const view = scoreWithCustomWeights(canonical, canonicalWeights());
    expect(again).toEqual(canonical);
    expect(canonical.formula).toBe('nodescope.health-score.v2');
    expect(view.score).toBe(canonical.score);
    expect(view.components.map((c) => c.points)).toEqual(canonical.components.map((c) => c.points));
  });

  it('renormalizes a view-only weighting and leaves the canonical object alone', () => {
    const snapshots = [{
      timestamp: 1_000_000,
      endpointOrigin: 'https://rpc.example',
      endpointProfile: 'portaldot_v3_evm' as const,
      checks: [
        { method: 'eth_chainId', success: true, outcome: 'success' as const, observedValue: '0x190f1ca9', latencyMs: 100, error: null },
        { method: 'eth_blockNumber', success: true, outcome: 'success' as const, observedValue: '0x10', latencyMs: 100, error: null },
      ],
    }];
    const canonical = computeHealthScoreV2({ snapshots });
    const weights = canonicalWeights();
    weights.latency = 50;
    weights.availability = 0;
    const view = scoreWithCustomWeights(canonical, weights);
    expect(canonical.components.find((c) => c.id === 'latency')?.weight).toBe(10);
    expect(view.components.find((c) => c.id === 'latency')?.weight).toBe(50);
    expect(view.formula).toBe('nodescope.health-score.v2');
    expect(view.score).not.toBe(canonical.score);
  });

  it('persists locally and resets back to the published weights', () => {
    const box = memory();
    const weights = canonicalWeights();
    weights.transport_parity = 40;
    weights.latency = 0;
    saveCustomWeights(weights, box);
    const loaded = loadCustomWeights(box);
    expect(loaded.transport_parity).toBe(40);
    expect(weightsMatchCanonical(loaded)).toBe(false);
    expect(resetCustomWeights(box)).toEqual(canonicalWeights());
    expect(weightsMatchCanonical(loadCustomWeights(box))).toBe(true);
  });

  it('ignores a stored map that is missing a component', () => {
    const box = memory();
    box.setItem('nodescope.custom-weights.v1', JSON.stringify({ weights: { latency: 10 } }));
    expect(weightsMatchCanonical(loadCustomWeights(box))).toBe(true);
  });
});
