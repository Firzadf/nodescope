import { useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import type { Lang } from '../../utils/landingLang';
import { BrandMark } from '../common/BrandMark';

// Shared site header, used by the landing page and the /fees sub-landing
// so both carry the same mobile menu behavior: full nav from xl, a
// hamburger below xl, and a collapsible menu that closes when a link is
// pressed. The two pages keep their own header chrome via variant
// (landing: fixed pill + V3 badge + Launch App; /fees: static bar, amber
// accent) but the menu implementation itself exists exactly once.
export type SiteNavLink = { href: string; label: string };

export function SiteHeader({
  nav,
  lang,
  setLang,
  menuId,
  variant,
  launchLabel,
  launchHref,
  langGroupAria = 'Language',
  menuToggleAria = 'Toggle navigation menu',
}: {
  nav: SiteNavLink[];
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Kept for callers; one signal accent now serves every page. */
  accent?: 'blue' | 'amber';
  menuId: string;
  variant: 'landing' | 'fees';
  /** Landing only: label and target of the Launch App button. */
  launchLabel?: string;
  launchHref?: string;
  /** Screen-reader labels for the language group and the mobile menu
   * toggle. English defaults keep older callers working; Landing and
   * /fees pass their session language so the labels are never
   * English-only on an Indonesian page. */
  langGroupAria?: string;
  menuToggleAria?: string;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerClass =
    variant === 'landing'
      ? 'fixed inset-x-0 top-0 z-40 border-b border-line bg-ink/95 px-4 backdrop-blur-sm md:px-8'
      : 'border-b border-line px-4 py-3 md:px-8';
  const containerClass = 'mx-auto flex h-14 max-w-[1240px] items-center gap-3';
  const wordmarkClass =
    variant === 'landing'
      ? 'hidden font-display text-[24px] leading-none tracking-[-0.01em] text-white sm:inline'
      : 'font-display text-[24px] leading-none tracking-[-0.01em] text-white';
  const toggleActive = 'bg-white text-ink';
  return (
    <header className={headerClass}>
      <div className={containerClass}>
        <a href="/" className="flex shrink-0 items-center gap-2.5">
          <BrandMark className="h-7 w-7 text-white" title="NodeScope logo" />
          <span className={wordmarkClass}>NodeScope</span>
        </a>
        {variant === 'landing' ? (
          <nav className="mx-auto hidden items-center gap-6 font-data text-[11px] uppercase tracking-[0.16em] text-slate-400 xl:flex">
            {nav.map(({ href, label }) => (
              <a key={href} href={href} className="group relative shrink-0 whitespace-nowrap transition-colors hover:text-white">
                {label}
                <span aria-hidden="true" className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-signal transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
          </nav>
        ) : (
          <nav className="mx-auto hidden items-center gap-5 font-data text-[11px] uppercase tracking-[0.18em] text-slate-400 xl:flex">
            {nav.map(({ href, label }) => (
              <a key={href} href={href} className="shrink-0 whitespace-nowrap transition-colors hover:text-white">
                {label}
              </a>
            ))}
          </nav>
        )}
        <span className={`flex shrink-0 items-center border border-line ml-auto xl:ml-0`} role="group" aria-label={langGroupAria}>
          {(['en', 'id'] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              // The accessible name contains the visible label verbatim
              // ("EN (English)"): a bare "English" fails axe's
              // label-content-name-mismatch for the visible "EN".
              aria-label={l === 'en' ? 'EN (English)' : 'ID (Bahasa Indonesia)'}
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={`px-2.5 py-1.5 font-data text-[10px] uppercase tracking-[0.14em] transition-colors ${lang === l ? toggleActive : 'text-slate-400 hover:text-white'}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </span>
        {variant === 'landing' && (
          <span className="hidden items-center gap-2 font-data text-[10px] uppercase tracking-[0.18em] text-slate-500 2xl:flex">
            <span aria-hidden="true" className="live-dot inline-block h-1.5 w-1.5 bg-signal" />
            V3 Testnet
          </span>
        )}
        {variant === 'landing' && launchLabel && launchHref && (
          <a href={launchHref} className="btn-ink inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-2 text-[13px] font-semibold sm:px-4">
            {launchLabel}
            <ArrowUpRight className="h-4 w-4" />
          </a>
        )}
        <button
          type="button"
          aria-label={menuToggleAria}
          aria-expanded={mobileMenuOpen}
          aria-controls={menuId}
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="btn-ghost flex h-9 w-9 shrink-0 items-center justify-center xl:hidden"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {mobileMenuOpen && (
        <div id={menuId} className="mx-auto max-w-[1240px] border-t border-line pb-3 pt-2 xl:hidden">
          <nav className="grid gap-1">
            {nav.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between whitespace-nowrap border-b border-line px-1 py-3 font-data text-[12px] uppercase tracking-[0.16em] text-slate-300 transition-colors last:border-b-0 hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
