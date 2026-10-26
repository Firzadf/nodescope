import { useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import type { Lang } from '../../utils/landingLang';

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
  accent,
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
  accent: 'blue' | 'amber';
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
    variant === 'landing' ? 'fixed inset-x-0 top-0 z-40 px-4 pt-3' : 'border-b border-line px-4 py-4';
  const containerClass =
    variant === 'landing'
      ? 'mx-auto flex max-w-6xl items-center gap-3 rounded-[20px] border border-line bg-ink/80 px-4 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur'
      : 'mx-auto flex max-w-6xl items-center gap-3';
  const wordmarkClass =
    variant === 'landing'
      ? 'hidden font-display text-[17px] font-semibold tracking-tight text-white sm:inline'
      : 'font-display text-[17px] font-semibold tracking-tight text-white';
  const toggleActive = accent === 'amber' ? 'bg-amber-400 text-black' : 'bg-[#0063CC] text-white';
  return (
    <header className={headerClass}>
      <div className={containerClass}>
        <a href="/" className="flex shrink-0 items-center gap-2.5">
          <img src="/logo.png" alt="NodeScope logo" className="h-7 w-7 rounded-lg shadow-[0_0_20px_rgba(1,129,251,0.35)] ring-1 ring-[#0181FB]/40" />
          <span className={wordmarkClass}>
            Node<span className="text-[#0181FB]">Scope</span>
          </span>
        </a>
        {variant === 'landing' ? (
          <nav className="mx-auto hidden items-center gap-7 text-sm text-slate-400 xl:flex">
            {nav.map(({ href, label }) => (
              <a key={href} href={href} className="group relative shrink-0 whitespace-nowrap transition-colors hover:text-white">
                {label}
                <span aria-hidden="true" className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-[#0181FB] transition-transform duration-300 group-hover:scale-x-100" />
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
        <span className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-black/30 p-1" role="group" aria-label={langGroupAria}>
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
              className={`rounded-full px-2.5 py-1 font-data text-[10px] uppercase tracking-[0.14em] transition-colors ${lang === l ? toggleActive : 'text-slate-400 hover:text-white'}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </span>
        {variant === 'landing' && (
          <span className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-data text-[10px] uppercase tracking-[0.18em] text-emerald-300 xl:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            V3 Testnet
          </span>
        )}
        {variant === 'landing' && launchLabel && launchHref && (
          <a href={launchHref} className="btn-primary ml-auto inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-semibold md:ml-0">
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
          className="btn-ghost flex h-9 w-9 shrink-0 items-center justify-center rounded-lg xl:hidden"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {mobileMenuOpen && (
        <div id={menuId} className="mx-auto mt-2 max-w-6xl rounded-[20px] border border-line bg-ink/95 px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur xl:hidden">
          <nav className="grid gap-1">
            {nav.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="whitespace-nowrap rounded-lg px-3 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white"
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
