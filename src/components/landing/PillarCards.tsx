import { useEffect, useRef, useState } from 'react';
import { measureFeesProof, measureHealthProof } from '../../utils/pillarProof';

import type { PillarCardCopy } from '../../utils/landingLang';

export type { PillarCardCopy };

type ProofState =
  | { kind: 'idle' }
  | { kind: 'measuring' }
  | { kind: 'done'; value: string; at: Date }
  | { kind: 'error' };

function useOneShot(measure: () => Promise<string>) {
  const [state, setState] = useState<ProofState>({ kind: 'idle' });
  const startedRef = useRef(false);
  const aliveRef = useRef(true);
  useEffect(
    () => () => {
      aliveRef.current = false;
    },
    [],
  );
  const run = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setState({ kind: 'measuring' });
    measure().then(
      (value) => {
        if (aliveRef.current) setState({ kind: 'done', value, at: new Date() });
      },
      () => {
        if (aliveRef.current) {
          setState({ kind: 'error' });
          startedRef.current = false;
        }
      },
    );
  };
  return { state, run };
}

function PillarCard({
  copy,
  accent,
  measure,
  valueTestId,
}: {
  copy: PillarCardCopy;
  accent: 'blue' | 'amber';
  measure: () => Promise<string>;
  valueTestId: string;
}) {
  const { state, run } = useOneShot(measure);
  const ref = useRef<HTMLDivElement>(null);
  // Viewport entry measures once; where IntersectionObserver is missing
  // (tests, old browsers) the card simply waits for the Measure press.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // run is stable-by-ref-guard (startedRef); intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const accentText = accent === 'amber' ? 'text-amber-300' : 'text-[#7DB4FF]';
  const accentBorder = accent === 'amber' ? 'border-amber-400/30' : 'border-[#0181FB]/30';
  return (
    <div ref={ref} className={`min-w-0 rounded-3xl border ${accentBorder} bg-panel p-6 md:p-7`}>
      <p className={`font-data text-[11px] uppercase tracking-[0.22em] ${accentText}`}>{copy.kicker}</p>
      <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight text-white">{copy.title}</h3>
      <p className="mt-2.5 text-sm leading-relaxed text-slate-400">{copy.body}</p>
      <div className="mt-5 min-h-[64px] rounded-2xl border border-line bg-black/25 px-4 py-3.5">
        {state.kind === 'idle' && (
          <button type="button" onClick={run} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium">
            {copy.measureLabel}
          </button>
        )}
        {state.kind === 'measuring' && <p className="text-sm text-slate-400">{copy.measuringLabel}</p>}
        {state.kind === 'done' && (
          <div>
            <p data-testid={valueTestId} className="font-data text-2xl font-semibold tabular-nums text-white">
              {state.value}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {copy.measuredLabel} {state.at.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Jakarta' })} WIB
            </p>
          </div>
        )}
        {state.kind === 'error' && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-amber-300">{copy.unavailableLabel}</p>
            <button type="button" onClick={run} className="btn-ghost rounded-lg px-3 py-1.5 text-sm">
              {copy.measureLabel}
            </button>
          </div>
        )}
      </div>
      <a href={copy.ctaHref} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-200 underline decoration-slate-600 underline-offset-4 transition-colors hover:text-white">
        {copy.ctaLabel} →
      </a>
    </div>
  );
}

export function PillarCards({
  health,
  fees,
  healthMeasure = measureHealthProof,
  feesMeasure = measureFeesProof,
}: {
  health: PillarCardCopy;
  fees: PillarCardCopy;
  healthMeasure?: () => Promise<string>;
  feesMeasure?: () => Promise<string>;
}) {
  return (
    <div className="grid min-w-0 gap-5 md:grid-cols-2">
      <PillarCard copy={health} accent="blue" measure={healthMeasure} valueTestId="health-proof-value" />
      <PillarCard copy={fees} accent="amber" measure={feesMeasure} valueTestId="fees-proof-value" />
    </div>
  );
}
