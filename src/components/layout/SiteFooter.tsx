import type { LandingCopy } from '../../utils/landingLang';

// Shared site footer, used by the landing page and the /fees sub-landing
// so both carry byte-identical footer content and links.
export function SiteFooter({ t }: { t: LandingCopy }) {
  return (
      <footer className="relative overflow-hidden border-t border-line bg-deep px-4 pb-0 pt-12">
        <div className="relative mx-auto max-w-6xl">
          <p className="flex flex-wrap items-center gap-2.5 font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {t.footerLive}
          </p>
          <div className="mt-10 grid gap-10 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="" className="h-7 w-7 rounded-lg" />
                <span className="font-display text-base font-semibold text-white">NodeScope</span>
              </div>
              <p className="mt-3 max-w-xs text-[15px] leading-[1.85] text-slate-400">
                {t.footerDescription}
              </p>
              <p className="mt-4 font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">
                {t.footerDisclaimer}
              </p>
            </div>
            {t.footerColumns.map((col) => (
              <div key={col.header}>
                <p className="font-data text-[11px] uppercase tracking-[0.2em] text-slate-400">{col.header}</p>
                <ul className="mt-3.5 space-y-2.5 text-sm">
                  {col.links.map(({ label, href }) => (
                    <li key={label}>
                      {href ? (
                        <a
                          href={href}
                          {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                          className="inline-block text-slate-400 transition-all hover:translate-x-0.5 hover:text-white"
                        >
                          {label}
                        </a>
                      ) : (
                        <span className="text-slate-400">{label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <p
            aria-hidden="true"
            className="pointer-events-none -mb-[0.28em] mt-8 select-none text-center font-display text-[18vw] font-bold leading-none tracking-tight"
            style={{
              background: 'linear-gradient(to bottom, rgba(51, 82, 130, 0.95) 0%, rgba(30, 50, 90, 0.55) 55%, rgba(8, 12, 24, 0.15) 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            NODESCOPE
          </p>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[58%] h-px bg-gradient-to-r from-transparent via-slate-400/40 to-transparent blur-[1px]" />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-6 font-data text-[11px] uppercase tracking-[0.14em] text-slate-400">
          <span>{t.footerCopyright}</span>
          <span>{t.footerSchema}</span>
        </div>
      </footer>
  );
}
