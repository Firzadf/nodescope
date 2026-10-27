/**
 * NodeScope mark: a calibration reticle — square frame, crosshair, and one
 * signal dot (the observed value). Drawn in currentColor so it inks itself
 * on paper and on graphite; only the dot carries the signal color.
 */
export function BrandMark({ className = 'h-7 w-7', title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect x="1" y="1" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 1v7M14 20v7M1 14h7M20 14h7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="17.5" cy="10.5" r="2.2" fill="#ff5b14" />
    </svg>
  );
}
