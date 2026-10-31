import { useState } from 'react';
import { HEALTH_SCORE_FORMULA_V2, HEALTH_SCORE_V2_LABELS, type HealthScore } from '../../utils/healthScore';
import {
  V2_COMPONENT_IDS,
  canonicalWeights,
  loadCustomWeights,
  resetCustomWeights,
  saveCustomWeights,
  scoreWithCustomWeights,
  weightsMatchCanonical,
  type CustomWeightMap,
} from '../../utils/customWeights';

/**
 * View-only weights. The number next to the inputs is not the
 * canonical score and is not exported.
 */
export function CustomWeighting({ score }: { score: HealthScore }) {
  const [weights, setWeights] = useState<CustomWeightMap>(() => loadCustomWeights());
  const view = scoreWithCustomWeights(score, weights);
  const custom = !weightsMatchCanonical(weights);
  const sum = V2_COMPONENT_IDS.reduce((total, id) => total + weights[id], 0);

  const setOne = (id: (typeof V2_COMPONENT_IDS)[number], raw: string) => {
    const parsed = Number(raw);
    const next = { ...weights, [id]: Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 0 };
    setWeights(next);
    saveCustomWeights(next);
  };

  const reset = () => {
    const next = resetCustomWeights();
    setWeights(next);
  };

  return (
    <details className="disclosure mt-4">
      <summary className="cursor-pointer font-data text-[11px] uppercase tracking-[0.18em] text-slate-400 hover:text-slate-200">
        Custom weighting · view only
      </summary>
      <div className="mt-3 border border-line bg-black/20 p-3">
        <p className="text-sm leading-relaxed text-slate-300">
          Your weighting. This number is not <span className="font-data text-slate-200">{HEALTH_SCORE_FORMULA_V2}</span>.
          Exports and evidence anchors keep the canonical score. Reset restores the published weights. The weights stay in this browser.
        </p>
        <p className="mt-3 font-data text-2xl text-white">
          {view.score === null ? '––' : view.score}
          <span className="text-base text-slate-500">/100</span>
          <span className="ml-3 text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {custom ? 'your weighting' : 'matches the canonical score'}
          </span>
        </p>
        <p className="mt-1 font-data text-[11px] text-slate-500">
          Weights sum to {sum}. The view renormalizes over the weights you set. The canonical score ignores them.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {V2_COMPONENT_IDS.map((id) => (
            <label key={id} className="flex items-center justify-between gap-3 text-sm text-slate-300">
              <span>{HEALTH_SCORE_V2_LABELS[id]}</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={weights[id]}
                aria-label={`${HEALTH_SCORE_V2_LABELS[id]} weight`}
                onChange={(event) => setOne(id, event.target.value)}
                className="w-16 border border-line bg-black/40 px-2 py-1 text-right font-data text-slate-100"
              />
            </label>
          ))}
        </div>
        <button type="button" onClick={reset} className="mt-3 border border-line px-3 py-1.5 font-data text-[11px] uppercase tracking-[0.16em] text-slate-300 hover:text-white">
          Reset to published weights ({canonicalWeights().transport_parity} on WSS)
        </button>
      </div>
    </details>
  );
}
