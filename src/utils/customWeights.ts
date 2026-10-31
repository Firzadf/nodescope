/**
 * View-only custom weighting. Stored in this browser. It never replaces
 * nodescope.health-score.v2 and is not written into an exported report.
 */
import { HEALTH_SCORE_V2_WEIGHTS, type HealthScore, type HealthScoreComponent, type HealthScoreV2ComponentId } from './healthScore';

export const CUSTOM_WEIGHTS_KEY = 'nodescope.custom-weights.v1';

export type CustomWeightMap = Record<HealthScoreV2ComponentId, number>;

export const V2_COMPONENT_IDS = Object.keys(HEALTH_SCORE_V2_WEIGHTS) as HealthScoreV2ComponentId[];

export function canonicalWeights(): CustomWeightMap {
  return { ...HEALTH_SCORE_V2_WEIGHTS };
}

export function weightsMatchCanonical(weights: CustomWeightMap): boolean {
  return V2_COMPONENT_IDS.every((id) => weights[id] === HEALTH_SCORE_V2_WEIGHTS[id]);
}

function clampWeight(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function sanitizeWeights(value: unknown): CustomWeightMap | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const next = canonicalWeights();
  for (const id of V2_COMPONENT_IDS) {
    const parsed = clampWeight(raw[id]);
    if (parsed === null) return null;
    next[id] = parsed;
  }
  return next;
}

type WeightStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storageOrNull(storage?: WeightStorage): WeightStorage | null {
  if (storage) return storage;
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadCustomWeights(storage?: WeightStorage): CustomWeightMap {
  const box = storageOrNull(storage);
  if (!box) return canonicalWeights();
  try {
    const raw = box.getItem(CUSTOM_WEIGHTS_KEY);
    if (!raw) return canonicalWeights();
    const parsed = JSON.parse(raw) as { weights?: unknown };
    return sanitizeWeights(parsed?.weights) ?? canonicalWeights();
  } catch {
    return canonicalWeights();
  }
}

export function saveCustomWeights(weights: CustomWeightMap, storage?: WeightStorage): void {
  const box = storageOrNull(storage);
  const clean = sanitizeWeights(weights);
  if (!box || !clean) return;
  try {
    if (weightsMatchCanonical(clean)) {
      box.removeItem(CUSTOM_WEIGHTS_KEY);
      return;
    }
    box.setItem(CUSTOM_WEIGHTS_KEY, JSON.stringify({ schema: CUSTOM_WEIGHTS_KEY, weights: clean }));
  } catch {
    // Storage full or blocked: the view stays in memory for this render.
  }
}

export function resetCustomWeights(storage?: WeightStorage): CustomWeightMap {
  const box = storageOrNull(storage);
  try {
    box?.removeItem(CUSTOM_WEIGHTS_KEY);
  } catch {
    // ignore
  }
  return canonicalWeights();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Rescale the canonical points onto the viewer's weights. When the
 * weights equal the published ones, the number matches the canonical
 * score, including the same rounding. Missing components stay missing.
 */
export function scoreWithCustomWeights(score: HealthScore, weights: CustomWeightMap): HealthScore {
  const clean = sanitizeWeights(weights) ?? canonicalWeights();
  const components: HealthScoreComponent[] = score.components.map((c) => {
    const weight = clean[c.id] ?? c.weight;
    if (!c.measured || c.points === null || c.weight <= 0) {
      return { ...c, weight, points: c.measured ? c.points : null };
    }
    const scaled = round1((c.points / c.weight) * weight);
    return { ...c, weight, points: scaled };
  });
  const coverage = components.filter((c) => c.measured).reduce((sum, c) => sum + c.weight, 0);
  const earned = components.reduce((sum, c) => sum + (c.points ?? 0), 0);
  const next = coverage >= 50 ? Math.round((100 * earned) / coverage) : null;
  return {
    formula: score.formula,
    score: next,
    band: next === null ? null : next >= 90 ? 'healthy' : next >= 70 ? 'degraded' : 'critical',
    coverage,
    components,
  };
}
