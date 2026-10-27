import { BrandMark } from './BrandMark';

/**
 * The one loader, used by IntroSplash and by every Suspense fallback.
 * The reticle mark at 56px: the needle sweeps 360 degrees in ~1.6s while
 * the dashed ring turns the other way, slower. The mono line underneath
 * names what is happening; it never claims a percentage. Paper tone inks
 * the mark dark for public pages, graphite tone inks it light for /app.
 * Reduced motion stops both spins via CSS; the mark and the line stay.
 */
export function Loader({ tone }: { tone: 'paper' | 'graphite' }) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center gap-4 ${tone === 'paper' ? 'text-[#16130F]' : 'text-slate-300'}`}
    >
      <BrandMark animated className="h-14 w-14" title="NodeScope" />
      <p className="font-data text-[11px] uppercase tracking-[0.22em]">CALIBRATING · CHAIN 420420777</p>
    </div>
  );
}
