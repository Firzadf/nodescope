import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { feesCopy } from '../utils/feesLang';
import { landingCopy, readStoredLang, storeLang, type Lang } from '../utils/landingLang';
import { SiteFooter } from '../components/layout/SiteFooter';
import { SiteHeader } from '../components/layout/SiteHeader';
import { DeployCostCalculator } from '../components/fees/DeployCostCalculator';

// /fees: the Fees sub-landing. Same design system, fonts, and footer as the
// main landing: paper, numbered sections, one signal accent. All numbers on
// this page come from one documented measured run (26 Oct 2026 ~13:13 UTC);
// the live re-measurement lives in Fee Lab, linked below. Nothing here
// polls, signs, or opens a connection.
function AnimatedBars({ t }: { t: (typeof feesCopy)['en'] }) {
  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Reduced-motion visitors get the final widths on first paint, no effect.
  const [mounted, setMounted] = useState(reduceMotion);
  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(id);
  }, [reduceMotion]);
  const anim = reduceMotion ? '' : 'transition-[width] duration-1000 ease-out';
  // Scaled to the larger all-in total (124.098 tPOT). The native fee slice
  // (0.154 tPOT) is visually negligible at true scale, so it gets the same
  // 0.4% minimum the Fee Lab breakdown bars use; the values beside the
  // bars are exact, the widths are illustrative.
  const evmW = mounted ? 100 : 0;
  const nativeFeeW = mounted ? 0.4 : 0;
  const nativeDepW = mounted ? 98.3 : 0;
  return (
    <div className="mt-10 w-full space-y-6" role="img" aria-label={t.barAria}>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-400">{t.evmBarLabel}</span>
          <span className="font-data text-[28px] font-medium tracking-[-0.03em] text-white">124.098 <span className="text-sm text-slate-400">tPOT</span></span>
        </div>
        <div className="mt-2 flex h-6 w-full overflow-hidden border border-line bg-black/20">
          <div className={`h-full bg-signal ${anim}`} style={{ width: `${evmW}%` }} />
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-400">{t.nativeBarLabel}</span>
          <span className="font-data text-[28px] font-medium tracking-[-0.03em] text-white">122.191 <span className="text-sm text-slate-400">tPOT</span></span>
        </div>
        <div className="mt-2 flex h-6 w-full overflow-hidden border border-line bg-black/20">
          <div className={`h-full bg-emerald-500 ${anim}`} style={{ width: `${nativeFeeW}%` }} title={`${t.nativeFeeSegment}: 0.154 tPOT`} />
          <div className={`h-full bg-white ${anim}`} style={{ width: `${nativeDepW}%` }} title={`${t.nativeDepositSegment}: 122.037 tPOT`} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <span><span className="mr-1 inline-block h-2 w-2 bg-emerald-500" />{t.nativeFeeSegment}: 0.154 tPOT</span>
          <span><span className="mr-1 inline-block h-2 w-2 bg-white" />{t.nativeDepositSegment}: 122.037 tPOT</span>
        </div>
      </div>
      <p className="font-data text-[11px] text-slate-500">{t.barCaption}</p>
    </div>
  );
}

export function FeesPage() {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang());
  const setLang = (l: Lang) => {
    setLangState(l);
    storeLang(l);
  };
  const t = feesCopy[lang];
  const footerCopy = landingCopy[lang];
  return (
    <div className="paper landing-root min-h-screen bg-ink font-sans text-slate-200 antialiased">
      <SiteHeader
        nav={t.nav}
        lang={lang}
        setLang={setLang}
        accent="amber"
        menuId="fees-mobile-menu"
        variant="fees"
        langGroupAria={t.langGroupAria}
        menuToggleAria={t.menuToggleAria}
      />

      <main>
      {/* Hero: left-aligned editorial, the measured bars as the figure. */}
      <section className="hero-grid px-4 pb-16 pt-14 md:px-8 md:pb-24 md:pt-20">
        <div className="relative mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="font-data text-[11px] uppercase tracking-[0.2em] text-slate-500">
              <span className="text-signal-ink">00</span> — {t.heroKicker}
            </p>
            <h1 className="mt-8 font-display text-[60px] leading-[0.9] tracking-[-0.03em] text-white md:text-[104px]">
              {t.heroTitle}
            </h1>
            <p className="mt-8 max-w-[48ch] text-[17px] leading-relaxed text-slate-400 md:text-lg">{t.heroSub}</p>
          </div>
          <div className="lg:col-span-6 lg:pt-16">
            <p className="border-l-2 border-signal pl-5 text-[16px] leading-relaxed text-slate-200">{t.heroAnswer}</p>
            <AnimatedBars t={t} />
          </div>
        </div>
      </section>

      <section className="border-t border-line px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <h2 className="font-display text-[40px] leading-none tracking-[-0.02em] text-white md:text-[56px]"><span aria-hidden="true" className="mr-4 align-middle font-data text-[13px] tracking-normal text-signal-ink">01</span>{t.howTitle}</h2>
          <div className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {t.howSteps.map((s, i) => (
              <div key={s.title} className="bg-ink p-6">
                <p className="font-data text-[12px] text-signal-ink">0{i + 1}</p>
                <h3 className="mt-4 font-display text-[24px] leading-tight text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <h2 className="font-display text-[40px] leading-none tracking-[-0.02em] text-white md:text-[56px]"><span aria-hidden="true" className="mr-4 align-middle font-data text-[13px] tracking-normal text-signal-ink">02</span>{t.opsTitle}</h2>
          <div className="mt-10 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {t.ops.map((o) => (
              <div key={o.title} className="bg-ink p-6">
                <h3 className="font-display text-[24px] leading-tight text-white">{o.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{o.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <h2 className="font-display text-[40px] leading-none tracking-[-0.02em] text-white md:text-[56px]"><span aria-hidden="true" className="mr-4 align-middle font-data text-[13px] tracking-normal text-signal-ink">03</span>{t.findingsTitle}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">{t.findingsIntro}</p>
          <div className="mt-10 overflow-x-auto border-t border-white">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line font-data text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {t.findingsHead.map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.findingsRows.map((r) => (
                  <tr key={r.op} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 text-slate-200">{r.op}</td>
                    <td className="px-4 py-3 font-data tabular-nums text-slate-100">{r.evm}</td>
                    <td className="px-4 py-3 font-data tabular-nums text-slate-100">{r.nativeFee}</td>
                    <td className="px-4 py-3 font-data tabular-nums text-slate-300">{r.deposit}</td>
                    <td className="px-4 py-3 font-data text-[15px] font-medium tabular-nums text-signal-ink">{r.allIn}</td>
                    <td className="px-4 py-3 font-data tabular-nums text-slate-400">{r.feeOnly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-6 grid max-w-4xl gap-2.5 text-sm leading-relaxed text-slate-400">
            {t.findingsNotes.map((n) => (
              <li key={n} className="flex gap-2.5"><span aria-hidden="true" className="font-data text-signal-ink">—</span><span>{n}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <h2 className="font-display text-[40px] leading-none tracking-[-0.02em] text-white md:text-[56px]"><span aria-hidden="true" className="mr-4 align-middle font-data text-[13px] tracking-normal text-signal-ink">04</span>{t.calc.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">{t.calc.intro}</p>
          <div className="mt-10 border border-line bg-panel p-5 md:p-8">
            <DeployCostCalculator lang={lang} />
          </div>
        </div>
      </section>

      <section className="border-t border-line px-4 py-16 md:px-8 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <h2 className="font-display text-[40px] leading-none tracking-[-0.02em] text-white md:text-[56px]"><span aria-hidden="true" className="mr-4 align-middle font-data text-[13px] tracking-normal text-signal-ink">05</span>{t.limitsTitle}</h2>
          <ul className="mt-6 grid max-w-4xl gap-2.5 text-sm leading-relaxed text-slate-400">
            {t.limits.map((l) => (
              <li key={l} className="flex gap-2.5"><span aria-hidden="true" className="font-data text-signal-ink">—</span><span>{l}</span></li>
            ))}
          </ul>
          <div className="graphite mt-14 border border-graphite p-6 md:p-12">
            <h2 className="font-display text-[40px] leading-none tracking-[-0.02em] text-white md:text-[56px]"><span aria-hidden="true" className="mr-4 align-middle font-data text-[13px] tracking-normal text-signal-ink">06</span>{t.ctaTitle}</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400">{t.ctaBody}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="/app/fee-lab" className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-[15px] font-semibold">
                {t.ctaLab}
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="/" className="inline-flex items-center gap-1.5 px-2 py-3 text-[15px] font-medium text-slate-300 underline decoration-slate-600 underline-offset-4 transition-colors hover:text-white">
                {t.ctaLanding}
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      </main>
      <SiteFooter t={footerCopy} />
    </div>
  );
}
