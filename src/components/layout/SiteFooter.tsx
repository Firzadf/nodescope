import type { LandingCopy } from '../../utils/landingLang';
import { BrandMark } from '../common/BrandMark';

// Shared site footer, used by the landing page and the /fees sub-landing
// so both carry byte-identical footer content and links. Printed-report
// colophon: hairline columns, mono headers, and the wordmark set large in
// the serif as the last line of the page.
export function SiteFooter({ t }: { t: LandingCopy }) {
  return (
    <footer className="relative overflow-hidden border-t border-line bg-deep px-4 pt-12 md:px-8">
      <div className="relative mx-auto max-w-[1240px]">
        <p className="flex flex-wrap items-center gap-2.5 font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">
          <span aria-hidden="true" className="live-dot inline-block h-2 w-2 bg-signal" />
          {t.footerLive}
        </p>
        <div className="mt-10 grid gap-10 border-t border-white pt-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <BrandMark className="h-7 w-7 text-white" />
              <span className="font-display text-[26px] leading-none text-white">NodeScope</span>
            </div>
            <p className="mt-4 max-w-xs text-[15px] leading-[1.7] text-slate-400">{t.footerDescription}</p>
            <p className="mt-4 font-data text-[11px] uppercase leading-relaxed tracking-[0.18em] text-slate-500">{t.footerDisclaimer}</p>
          </div>
          {t.footerColumns.map((col) => (
            <div key={col.header}>
              <p className="font-data text-[11px] uppercase tracking-[0.2em] text-slate-500">{col.header}</p>
              <ul className="mt-3.5 space-y-2.5 text-sm">
                {col.links.map(({ label, href }) => (
                  <li key={label}>
                    {href ? (
                      <a
                        href={href}
                        {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                        className="inline-block text-slate-300 underline decoration-transparent underline-offset-4 transition-colors hover:text-white hover:decoration-signal"
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
      <p aria-hidden="true" className="pointer-events-none mx-auto mt-14 max-w-[1240px] select-none pb-[0.12em] font-display text-[22vw] leading-[0.8] tracking-[-0.04em] text-white lg:text-[17rem]">
        NodeScope<span className="text-signal">.</span>
      </p>
      <div className="relative mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 border-t border-line py-5 font-data text-[11px] uppercase tracking-[0.14em] text-slate-500">
        <span>{t.footerCopyright}</span>
        <span>{t.footerSchema}</span>
      </div>
    </footer>
  );
}
