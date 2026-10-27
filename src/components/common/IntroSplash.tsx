import { useEffect, useState } from 'react';

/**
 * Brand intro splash, shown once per tab session per route (landing vs
 * app). It is a motion moment, not a loader: it never claims data is
 * loading, shows no percentage and no fake progress, and the page
 * underneath is already rendered. Click anywhere to skip it instantly.
 * Total time is about 1.2 seconds; reduced motion shows nothing at all.
 */
export function IntroSplash({ scope }: { scope: 'landing' | 'app' }) {
  const key = `nodescope-intro-${scope}`;
  const [phase, setPhase] = useState<'show' | 'fade' | 'done'>(() => {
    try {
      if (sessionStorage.getItem(key)) return 'done';
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'done';
    } catch {
      return 'done';
    }
    return 'show';
  });

  const finish = () => {
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      // Private mode or blocked storage: the splash just shows again
      // next load, which is harmless.
    }
    setPhase('done');
  };

  // One-shot timers, set once on mount. They must not be re-armed when
  // the phase flips to 'fade', or the finish timer would be cancelled
  // and the invisible overlay would stay mounted, blocking clicks.
  useEffect(() => {
    if (phase !== 'show') return;
    const t0 = window.setTimeout(() => setPhase('fade'), 900);
    const t1 = window.setTimeout(finish, 1200);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      aria-hidden="true"
      onClick={finish}
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-deep transition-opacity duration-300 ${
        phase === 'fade' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <img
        src="/logo.png"
        alt=""
        className="intro-rise h-16 w-16 rounded-2xl shadow-[0_0_40px_rgba(1,129,251,0.45)] ring-1 ring-signal/40"
      />
      <p
        className="intro-rise font-display text-3xl font-semibold tracking-tight text-white"
        style={{ animationDelay: '120ms' }}
      >
        Node<span className="text-signal-ink">Scope</span>
      </p>
      <div className="intro-sweep h-[2px] w-40 bg-gradient-to-r from-transparent via-signal to-transparent" />
      <p
        className="intro-rise font-data text-[11px] uppercase tracking-[0.22em] text-slate-500"
        style={{ animationDelay: '240ms' }}
      >
        {scope === 'landing' ? 'Read the node. Keep the receipt.' : 'Portaldot V3 EVM · Chain 420420777'}
      </p>
    </div>
  );
}
