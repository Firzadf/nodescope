import { BrandMark } from '../common/BrandMark';

export interface PaperNavLink {
  href: string;
  label: string;
}

/**
 * Header for the single-purpose public pages (/judges, /verify, /docs,
 * /mainnet, 404). Mark + wordmark on the left, mono nav on the right. On a
 * narrow screen the nav scrolls sideways in one line instead of wrapping
 * under the wordmark.
 */
export function PaperHeader({ links, current }: { links: PaperNavLink[]; current?: string }) {
  return (
    <header className="border-b border-line px-4 md:px-8">
      <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 sm:gap-4">
        <a href="/" className="flex shrink-0 items-center gap-2.5">
          <BrandMark className="h-7 w-7 text-white" title="NodeScope logo" />
          <span className="hidden font-display text-[24px] leading-none text-white sm:inline">NodeScope</span>
        </a>
        <nav aria-label="Site" className="no-scrollbar ml-auto flex min-w-0 items-center gap-3 overflow-x-auto whitespace-nowrap font-data text-[10px] uppercase tracking-[0.06em] sm:gap-5 sm:text-[11px] sm:tracking-[0.16em] text-slate-400">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              aria-current={current === l.href ? 'page' : undefined}
              className={`shrink-0 py-2 transition-colors hover:text-white ${current === l.href ? 'text-white underline decoration-signal decoration-2 underline-offset-[6px]' : ''}`}
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
