/**
 * NodeScope mark: a calibration reticle — outer ring, dashed inner ring,
 * four crosshair ticks, centre pivot, and one orange needle to the signal
 * dot at 1-2 o'clock. Ink parts use currentColor so the mark inks itself
 * on paper and on graphite; only the needle and the dot carry #E8590C.
 * With `animated`, the dashed ring and the needle each spin (the Loader's
 * motion); the static rendering is unchanged.
 */
export function BrandMark({ className = 'h-7 w-7', title, animated = false }: { className?: string; title?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="2.5" />
      {animated ? (
        <g className="loader-ring">
          <circle cx="32" cy="32" r="15" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" />
        </g>
      ) : (
        <circle cx="32" cy="32" r="15" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" />
      )}
      <path d="M32 2v10M32 52v10M2 32h10M52 32h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
      {animated ? (
        <g className="loader-needle">
          <path d="M32 32 L45 19" stroke="#E8590C" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="45" cy="19" r="4" fill="#E8590C" />
        </g>
      ) : (
        <>
          <path d="M32 32 L45 19" stroke="#E8590C" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="45" cy="19" r="4" fill="#E8590C" />
        </>
      )}
      <circle cx="32" cy="32" r="3.5" fill="currentColor" />
    </svg>
  );
}
