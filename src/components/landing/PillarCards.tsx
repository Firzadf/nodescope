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
  autoMeasure = true,
}: {
  copy: PillarCardCopy;
  accent: 'blue' | 'amber';
  measure: () => Promise<string>;
  valueTestId: string;
  /**
   * Viewport entry measures once. The Fees card opts out: its measurement
   * lazy-loads the ~948 kB @polkadot/api chunk and opens a WSS connection,
   * too expensive to trigger just because the card scrolled into view, so
   * it only measures on an explicit Measure press.
   */
  autoMeasure?: boolean;
}) {
  const { state, run } = useOneShot(measure);
  const ref = useRef<HTMLDivElement>(null);
  // Viewport entry measures once; where IntersectionObserver is missing
  // (tests, old browsers) the card simply waits for the Measure press.
  useEffect(() => {
    const el = ref.current;
    if (!el || !autoMeasure || typeof IntersectionObserver === 'undefined') return;
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
  const numeral = accent === 'amber' ? '02' : '01';
  return (
    <div ref={ref} className="relative min-w-0 bg-panel p-6 md:p-8">
      <span aria-hidden="true" className="pointer-events-none absolute right-5 top-3 font-data text-[64px] font-medium leading-none tracking-[-0.06em] text-slate-800 md:text-[88px]">
        {numeral}
      </span>
      <p className="relative font-data text-[11px] uppercase tracking-[0.22em] text-signal-ink">{copy.kicker}</p>
      <h3 className="relative mt-4 font-display text-[34px] leading-none tracking-[-0.01em] text-white">{copy.title}</h3>
      <p className="relative mt-4 max-w-[46ch] text-[15px] leading-relaxed text-slate-400">{copy.body}</p>
      <div className="mt-6 min-h-[72px] border-y border-line py-4">
        {state.kind === 'idle' && (
          <button type="button" onClick={run} className="btn-primary px-4 py-2 text-sm font-semibold">
            {copy.measureLabel}
          </button>
        )}
        {state.kind === 'measuring' && <p className="text-sm text-slate-400">{copy.measuringLabel}</p>}
        {state.kind === 'done' && (
          <div>
            <p data-testid={valueTestId} className="font-data text-[30px] font-medium tracking-[-0.03em] tabular-nums text-white">
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
            <button type="button" onClick={run} className="btn-ghost px-3 py-1.5 text-sm">
              {copy.measureLabel}
            </button>
          </div>
        )}
      </div>
      <a href={copy.ctaHref} className="mt-5 inline-flex items-center gap-1.5 font-data text-[12px] uppercase tracking-[0.16em] text-white underline decoration-signal underline-offset-4 transition-colors hover:text-signal-ink">
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
    <div className="grid min-w-0 gap-px border border-line bg-line md:grid-cols-2">
      <PillarCard copy={health} accent="blue" measure={healthMeasure} valueTestId="health-proof-value" />
      <PillarCard copy={fees} accent="amber" measure={feesMeasure} valueTestId="fees-proof-value" autoMeasure={false} />
    </div>
  );
}
