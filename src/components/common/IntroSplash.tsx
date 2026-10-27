import { useEffect, useState } from 'react';
import { Loader } from './Loader';

/**
 * Brand intro splash, shown once per tab session per route (landing vs
 * app). It renders the shared Loader on a full-screen backdrop: paper on
 * public pages, graphite in /app. Click anywhere to skip it instantly.
 * Total time is about 1.2 seconds. Reduced motion stops the Loader's
 * spins via CSS, but the mark and the line stay; the splash still
 * dismisses itself on the same timers.
 */
export function IntroSplash({ scope }: { scope: 'landing' | 'app' }) {
  const key = `nodescope-intro-${scope}`;
  const [phase, setPhase] = useState<'show' | 'fade' | 'done'>(() => {
    try {
      if (sessionStorage.getItem(key)) return 'done';
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
      className={`fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-300 ${
        phase === 'fade' ? 'opacity-0' : 'opacity-100'
      } ${scope === 'landing' ? 'bg-paper' : 'bg-deep'}`}
    >
      <Loader tone={scope === 'landing' ? 'paper' : 'graphite'} />
    </div>
  );
}
