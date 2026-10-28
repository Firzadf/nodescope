import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, Pause, Play, X } from 'lucide-react';
import { sendJsonRpcRequest } from '../services/rpcClient';
import { BackToTop } from '../components/BackToTop';
import { IntroSplash } from '../components/common/IntroSplash';
import { DEFAULT_PORTALDOT_V3_EVM_RPC } from '../types/endpoint';
import { landingCopy, readStoredLang, storeLang, type Lang } from '../utils/landingLang';
import { PillarCards } from '../components/landing/PillarCards';
import { SiteFooter } from '../components/layout/SiteFooter';
import { SiteHeader } from '../components/layout/SiteHeader';
import {
  ANCHOR_BLOCK,
  ANCHOR_TX,
  ANCHORED_REPORT_EXPORTED_AT,
  ANCHORED_REPORT_HASH,
  ANCHORED_REPORT_RECORDS,
  ANCHORED_REPORTS,
  PORTALDOT_CHAIN_ID,
  REGISTRY_CONTRACT,
  SITE_TEST_FILES,
  SITE_TESTS,
} from '../utils/siteConstants';
import { HEALTH_SCORE_FORMULA } from '../utils/healthScore';

const APP_URL = '/app';
const JUDGES_URL = '/judges';
const DEMO_URL = 'https://youtu.be/TyTudF3MUaI';
const DOCUMENTED_CHAIN_ID = 420420777;
const SIGNAL = '#ff5b14';
const INK_MUTED = '#8a8478';

/*
 * Landing — "calibration sheet" edition.
 *
 * The page reads like a printed lab report: warm paper, ink type, hairline
 * rules, numbered sections (01 — …), one signal orange reserved for what
 * is live. The live readout and the marquee sit on graphite bands: the
 * instrument showing through the report. Every number on the page is
 * real (measured, documented, or fetched once on load) — nothing counts
 * up, nothing polls.
 */

/* ---------------------------------- hooks --------------------------------- */

function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.08);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms`, transitionTimingFunction: 'var(--ease-out)' }}
      className={`reveal ${className} transition-transform transition-opacity duration-500 ${inView ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      {children}
    </div>
  );
}

type ReadoutState =
  | { kind: 'probing' }
  | { kind: 'live'; block: number; chainOk: boolean; latencyMs: number | null; at: Date }
  | { kind: 'unreachable'; at: Date };

/** One fetch on load, shared by the readout and the marquee. Never polls. */
function useLiveChain(): ReadoutState {
  const [state, setState] = useState<ReadoutState>({ kind: 'probing' });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [blockRes, chainRes] = await Promise.all([
        sendJsonRpcRequest(DEFAULT_PORTALDOT_V3_EVM_RPC, 'eth_blockNumber', [], 6000),
        sendJsonRpcRequest(DEFAULT_PORTALDOT_V3_EVM_RPC, 'eth_chainId', [], 6000),
      ]);
      if (cancelled) return;
      const raw = blockRes.response?.result;
      if (blockRes.success && typeof raw === 'string') {
        const chainRaw = chainRes.response?.result;
        setState({
          kind: 'live',
          block: parseInt(raw, 16),
          chainOk: chainRes.success && typeof chainRaw === 'string' && parseInt(chainRaw, 16) === DOCUMENTED_CHAIN_ID,
          latencyMs: blockRes.latency,
          at: new Date(),
        });
      } else {
        setState({ kind: 'unreachable', at: new Date() });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

/**
 * Motion video, deferred until scrolled into view (see git history for the
 * Lighthouse reasoning). Only a same-aspect placeholder renders until
 * viewport entry; where IntersectionObserver is missing everything renders.
 */
function MotionVideo({ caption }: { caption: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.12);
  return (
    <div ref={ref} className="w-full">
      {inView ? (
        <>
          <video
            className="motion-video plate aspect-[16/10] w-full"
            src="/motion/nodescope-flow.mp4"
            poster="/screenshots/01-endpoint-config.jpg"
            autoPlay
            muted
            loop
            playsInline
            aria-label={caption}
          />
          <img
            src="/screenshots/01-endpoint-config.jpg"
            alt={caption}
            className="motion-poster plate aspect-[16/10] w-full object-cover object-top"
          />
        </>
      ) : (
        <div className="aspect-[16/10] w-full bg-panel" aria-hidden="true" data-testid="motion-placeholder" />
      )}
    </div>
  );
}

/* -------------------------------- odometer -------------------------------- */

function Odometer({ value }: { value: string }) {
  return (
    <span className="odometer" aria-label={value}>
      {value.split('').map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} className="odometer-col" aria-hidden="true">
            <span className="odometer-strip" style={{ transform: `translateY(-${Number(ch)}em)` }}>
              {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true">
            {ch}
          </span>
        ),
      )}
    </span>
  );
}

/* ------------------------------ live readout ------------------------------ */

function LiveReadout({ lang, state }: { lang: Lang; state: ReadoutState }) {
  const lr = landingCopy[lang];
  return (
    <div className="graphite relative border border-graphite">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="font-data text-[11px] text-slate-300">{lr.liveReadoutHeader}</span>
        <span aria-hidden="true" className="font-data text-[10px] uppercase tracking-[0.2em] text-slate-500">
          RPC · {state.kind === 'live' ? <span className="text-signal-ink">● live</span> : state.kind === 'probing' ? '○ …' : '× off'}
        </span>
      </div>
      <div className="px-5 py-5">
        <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-400">{lr.liveReadoutLatest}</p>
        <div className="mt-3 font-data text-[52px] font-medium leading-none tracking-[-0.04em] text-white sm:text-[64px]">
          {state.kind === 'live' ? (
            <Odometer value={state.block.toLocaleString('en-US')} />
          ) : state.kind === 'probing' ? (
            <span className="text-slate-600">
              <Odometer value="0" />
            </span>
          ) : (
            <span className="text-slate-500">— — —</span>
          )}
        </div>
        <div className="mt-5 space-y-1.5 border-t border-line pt-3.5 font-data text-[11.5px] leading-relaxed">
          {state.kind === 'probing' && (
            <p key="probing" className="state-swap text-slate-400">
              STATUS <span className="text-slate-200">{lr.liveReadoutProbing}</span>
            </p>
          )}
          {state.kind === 'live' && (
            <div key="live" className="state-swap space-y-1.5">
              <p className="text-slate-400">
                CHAIN ID <span className="text-slate-100">0x190F1CA9</span>{' '}
                {state.chainOk ? (
                  <span className="text-emerald-400">{lr.liveReadoutMatch}</span>
                ) : (
                  <span className="text-amber-300">{lr.liveReadoutMismatch}</span>
                )}
              </p>
              <p className="text-slate-400">
                {lr.liveReadoutAnsweredIn} <span className="text-slate-100">{state.latencyMs !== null ? `${state.latencyMs} MS` : '—'}</span>
                {' · '}
                {lr.liveReadoutAt}{' '}
                <span className="text-slate-100">{state.at.toLocaleTimeString('en-GB', { hour12: false })} WIB</span>
              </p>
              <p className="text-slate-500">{lr.liveReadoutFetchedOnce}</p>
            </div>
          )}
          {state.kind === 'unreachable' && (
            <div key="unreachable" className="state-swap space-y-1.5">
              <p className="text-amber-300">{lr.liveReadoutUnreachable}</p>
              <p className="text-slate-400">
                {lr.liveReadoutUnreachableBody}
                <span className="text-slate-100">{lr.liveReadoutLastObserved}</span>.
              </p>
            </div>
          )}
        </div>
      </div>
      <svg viewBox="0 0 600 44" className="block h-11 w-full border-t border-line" aria-hidden="true">
        {[11, 22, 33].map((y) => (
          <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="rgba(236,229,212,0.08)" />
        ))}
        <path
          className="ecg-path"
          d="M0 22 H180 L192 22 L200 6 L210 38 L220 22 H330 L342 13 L352 31 L360 22 H600"
          fill="none"
          stroke={SIGNAL}
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/* ------------------------------- marquee ---------------------------------- */

function ChainMarquee({ lang, state }: { lang: Lang; state: ReadoutState }) {
  const t = landingCopy[lang];
  const live =
    state.kind === 'live'
      ? `${t.marqueeLive} ${state.block.toLocaleString('en-US')}`
      : state.kind === 'probing'
        ? `${t.marqueeLive} …`
        : `${t.marqueeLive} — RPC unreachable`;
  const items = [live, ...t.marqueeItems, `${SITE_TESTS} tests · ${SITE_TEST_FILES} test files`];
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {items.map((it, i) => (
        <li key={i} className="flex items-center whitespace-nowrap px-5 font-data text-[11px] uppercase tracking-[0.2em] text-slate-300">
          {i === 0 && <span aria-hidden="true" className="live-dot mr-2.5 inline-block h-1.5 w-1.5 bg-signal" />}
          <span className={i === 0 ? 'text-white' : ''}>{it}</span>
          <span aria-hidden="true" className="ml-10 text-slate-600">/</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="graphite overflow-hidden border-y border-graphite">
      <div className="marquee-track flex w-max py-2.5">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/* ----------------------------- section frame ------------------------------ */

/**
 * Numbered editorial section: a sticky index column ("03 — How it works")
 * on the left, the content on the right. The title is the section's real
 * heading text, rendered once.
 */
function Section({
  id,
  index,
  label,
  title,
  right,
  children,
  tone = 'paper',
}: {
  id?: string;
  index: string;
  label: string;
  title: string;
  right?: string;
  children: ReactNode;
  tone?: 'paper' | 'deep';
}) {
  return (
    <section id={id} className={`scroll-mt-24 border-t border-line px-4 py-16 md:px-8 md:py-24 ${tone === 'deep' ? 'bg-deep' : ''}`}>
      <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-3">
          <div className="lg:sticky lg:top-24">
            <p className="flex items-baseline gap-3 font-data text-[12px] uppercase tracking-[0.2em] text-slate-500">
              <span className="text-[13px] text-signal-ink">{index}</span>
              <span aria-hidden="true">—</span>
              <span>{label}</span>
            </p>
            {right && <p className="mt-3 max-w-[28ch] font-data text-[11px] uppercase leading-relaxed tracking-[0.16em] text-slate-500">{right}</p>}
          </div>
        </div>
        <div className="min-w-0 lg:col-span-9">
          <h2 className="font-display text-[44px] leading-[0.95] tracking-[-0.02em] text-white md:text-[72px]">{title}</h2>
          <div className="mt-10">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** Hairline-framed figure with a mono caption bar, used for every artifact. */
function Plate({ label, right, children, dark = false, className = '' }: { label: string; right?: string; children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <div className={`${dark ? 'graphite' : 'bg-panel'} overflow-hidden border border-line ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="min-w-0 truncate font-data text-[11px] text-slate-400">{label}</span>
        {right && <span className="shrink-0 font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">{right}</span>}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------ step player ------------------------------- */

function CheckTranscript({ lang }: { lang: Lang }) {
  const ct = landingCopy[lang];
  const steps = [
    { method: 'eth_chainId', observed: '0x190f1ca9 — chain 420420777', latency: 562 },
    { method: 'eth_blockNumber', observed: 'block 147,638', latency: 258 },
    { method: 'web3_clientVersion', observed: ct.checkObservedClient, latency: 257 },
    { method: 'net_version', observed: '420420777', latency: 274 },
  ];
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 1900);
    return () => clearInterval(t);
  }, [playing, steps.length]);

  const step = steps[active];

  return (
    <div className="graphite overflow-hidden border border-graphite">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="font-data text-[11px] text-slate-400">{ct.transcriptHeader}</span>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? ct.transcriptPause : ct.transcriptPlay}
          className="btn-ghost flex h-7 w-7 items-center justify-center"
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="grid md:grid-cols-2">
        <ol className="divide-y divide-line border-b border-line md:border-b-0 md:border-r">
          {steps.map((s, i) => (
            <li key={s.method}>
              <button
                type="button"
                onClick={() => {
                  setActive(i);
                  setPlaying(false);
                }}
                className={`relative flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors duration-200 ${
                  i === active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.025]'
                }`}
              >
                {i === active && <span className="absolute left-0 top-0 h-full w-[3px] bg-signal" />}
                <span className="font-data text-xs text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                <span className={`font-data text-sm ${i === active ? 'text-white' : 'text-slate-400'}`}>{s.method}</span>
                <span className={`ml-auto font-data text-xs ${i < active || !playing ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {i === active && playing ? ct.transcriptRunning : ct.transcriptPass}
                </span>
                {i === active && playing && (
                  <span key={active} aria-hidden="true" className="step-progress absolute bottom-0 left-0 h-[2px] w-full bg-signal" />
                )}
              </button>
            </li>
          ))}
        </ol>
        <div className="px-5 py-5" key={active}>
          <div className="state-swap">
            <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">{ct.transcriptObserved}</p>
            <p className="mt-2 font-data text-lg leading-snug text-white">{step.observed}</p>
            <p className="mt-4 font-data text-[11.5px] text-slate-400">
              {ct.transcriptLatency} <span className="text-slate-100">{step.latency} MS</span> · {ct.transcriptOutcome}{' '}
              <span className="text-emerald-400">{ct.transcriptSuccess}</span>
            </p>
            <p className="mt-5 border-t border-line pt-3.5 text-[13px] leading-relaxed text-slate-400">
              {ct.transcriptNote}
              <span className="font-data text-slate-200">nodescope.health-snapshot.v1</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- flow visual ------------------------------ */

function FlowVisual({ lang }: { lang: Lang }) {
  const fv = landingCopy[lang];
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className={`mt-10 overflow-hidden border border-line bg-panel ${inView ? 'flow-in' : ''}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <span className="min-w-0 truncate font-data text-[11px] text-slate-400">{fv.flowHeader}</span>
        <span className="shrink-0 font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">{fv.flowRight}</span>
      </div>
      <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
        <div className="px-5 py-5">
          <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">{fv.flowConsoleLane}</p>
          <svg viewBox="0 0 320 44" className="mt-4 w-full" aria-hidden="true">
            <path pathLength={100} className="flow-draw" d="M8 22 H104" fill="none" stroke={INK_MUTED} strokeWidth="1.6" />
            <line x1="128" y1="22" x2="312" y2="22" stroke={INK_MUTED} strokeWidth="1.2" strokeDasharray="3 6" opacity="0.5" />
            <circle className="flow-node" style={{ transitionDelay: '500ms' }} cx="116" cy="22" r="5" fill="#f8f5ee" stroke={INK_MUTED} strokeWidth="1.6" />
          </svg>
          <p className="mt-3 font-data text-[12.5px] leading-relaxed text-slate-400">
            eth_blockNumber → <span className="text-slate-100">143,764</span>
            <span className="text-slate-500">{fv.flowConsoleBody}</span>
          </p>
        </div>
        <div className="px-5 py-5">
          <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-300">{fv.flowNodescopeLane}</p>
          <svg viewBox="0 0 320 44" className="mt-4 w-full" aria-hidden="true">
            <path pathLength={100} className="flow-draw" d="M8 22 H312" fill="none" stroke={SIGNAL} strokeWidth="1.6" />
            <circle className="flow-node" style={{ transitionDelay: '150ms' }} cx="8" cy="22" r="5" fill="#f8f5ee" stroke={SIGNAL} strokeWidth="1.8" />
            <circle className="flow-node" style={{ transitionDelay: '600ms' }} cx="140" cy="22" r="5" fill="#f8f5ee" stroke={SIGNAL} strokeWidth="1.8" />
            <circle className="flow-node" style={{ transitionDelay: '1000ms' }} cx="238" cy="22" r="5" fill="#f8f5ee" stroke="#15803d" strokeWidth="1.8" />
            <circle className="flow-node" style={{ transitionDelay: '1350ms' }} cx="312" cy="22" r="5" fill="#16140f" stroke="#16140f" strokeWidth="1.8" />
          </svg>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-data text-[11px] text-slate-500">
            <span>
              A · <span className="text-slate-100">143,764</span>
            </span>
            <span>
              B · <span className="text-slate-100">143,776</span>
            </span>
            <span className="text-emerald-400">{fv.flowDelta}</span>
            <span className="text-slate-300">{fv.flowReportExported}</span>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">{fv.flowNodescopeBody}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ evidence grid ----------------------------- */

function EvidenceGrid({ lang }: { lang: Lang }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);
  return (
    <div ref={ref} className={`grid grid-cols-12 gap-1 ${inView ? 'cells-in' : ''}`} role="img" aria-label={landingCopy[lang].evidenceGridAria}>
      {Array.from({ length: 48 }).map((_, i) => (
        <span
          key={i}
          className="evidence-cell h-7"
          style={{
            transitionDelay: `${i * 18}ms`,
            backgroundColor: i === 47 ? '#15803d' : `rgba(255, 91, 20, ${0.12 + (i / 47) * 0.7})`,
          }}
        />
      ))}
    </div>
  );
}

/* --------------------------- scroll progress ------------------------------ */

function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px] bg-transparent">
      <div className="h-full bg-signal" style={{ width: `${progress}%` }} />
    </div>
  );
}

/* ------------------------------ word fill --------------------------------- */

function WordFill({ sentence }: { sentence: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [progress, setProgress] = useState(() =>
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0,
  );
  useEffect(() => {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const p = (window.innerHeight * 0.85 - center) / (window.innerHeight * 0.35);
      setProgress(Math.min(1, Math.max(0, p)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const words = sentence.split(' ');
  return (
    <p ref={ref} aria-hidden="true" className="font-display text-[40px] italic leading-[1.02] tracking-[-0.01em] md:text-[56px]">
      {words.map((w, i) => {
        const lit = progress * words.length > i;
        return (
          <span key={i} style={{ transition: 'color 0.3s ease' }} className={lit ? 'text-white' : 'text-slate-700'}>
            {w}{' '}
          </span>
        );
      })}
    </p>
  );
}

/* ------------------------------ typewriter -------------------------------- */
/**
 * Typewriter for the report JSON sample in How It Works only. Types once
 * when scrolled into view, then stops with the full text plus a replay
 * button. Reduced motion shows the full text immediately. The visible
 * block is aria-hidden; screen readers get the complete plain sample.
 */
const JSON_TOKENS: { t: string; c: string }[] = [
  { t: "{", c: "text-slate-500" },
  { t: "\n  ", c: "" },
  { t: '"schema"', c: "text-slate-100" },
  { t: ": ", c: "text-slate-500" },
  { t: '"nodescope.diagnostic-report.v1"', c: "text-signal-soft" },
  { t: ",", c: "text-slate-500" },
  { t: "\n  ", c: "" },
  { t: '"endpoint"', c: "text-slate-100" },
  { t: ": ", c: "text-slate-500" },
  { t: '"https://test-evm-rpc-v3.portaldot.dev"', c: "text-signal-soft" },
  { t: ",", c: "text-slate-500" },
  { t: "\n  ", c: "" },
  { t: '"chainId"', c: "text-slate-100" },
  { t: ": ", c: "text-slate-500" },
  { t: '"0x190f1ca9 (420420777)"', c: "text-signal-soft" },
  { t: ",", c: "text-slate-500" },
  { t: "\n  ", c: "" },
  { t: '"summary"', c: "text-slate-100" },
  { t: ": ", c: "text-slate-500" },
  { t: '{ "total":', c: "text-slate-500" },
  { t: " 13", c: "text-emerald-300" },
  { t: ', "success":', c: "text-slate-500" },
  { t: " 13", c: "text-emerald-300" },
  { t: ', "errors":', c: "text-slate-500" },
  { t: " 0 ", c: "text-emerald-300" },
  { t: "}", c: "text-slate-500" },
  { t: ",", c: "text-slate-500" },
  { t: "\n  ", c: "" },
  { t: '"findings"', c: "text-slate-100" },
  { t: ": ", c: "text-slate-500" },
  { t: '[{ "ruleId":', c: "text-slate-500" },
  { t: ' "chain-id-verified"', c: "text-signal-soft" },
  { t: ', "severity":', c: "text-slate-500" },
  { t: ' "info" ', c: "text-signal-soft" },
  { t: "}]", c: "text-slate-500" },
  { t: "\n", c: "" },
  { t: "}", c: "text-slate-500" },
];
const JSON_TOTAL = JSON_TOKENS.reduce((a, tok) => a + tok.t.length, 0);
const JSON_PLAIN = JSON_TOKENS.map((tok) => tok.t).join("");

function TypewriterJson({ replayLabel }: { replayLabel: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  // Reduced-motion readers see the full JSON at once, decided at first
  // render instead of an effect that sets state after mount.
  const [count, setCount] = useState(() =>
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? JSON_TOTAL : 0,
  );
  const [run, setRun] = useState(0);
  const done = count >= JSON_TOTAL;
  useEffect(() => {
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    if (!inView || done) return;
    const id = window.setInterval(() => {
      setCount((c) => {
        const n = Math.min(JSON_TOTAL, c + 2);
        if (n >= JSON_TOTAL) window.clearInterval(id);
        return n;
      });
    }, 24);
    return () => window.clearInterval(id);
  }, [inView, run, done]);
  let remaining = count;
  const parts = [];
  for (let i = 0; i < JSON_TOKENS.length && remaining > 0; i++) {
    const tok = JSON_TOKENS[i];
    const take = tok.t.slice(0, remaining);
    parts.push(
      <span key={i} className={tok.c}>
        {take}
      </span>,
    );
    remaining -= take.length;
  }
  return (
    <div ref={ref}>
      <pre aria-hidden="true" className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-slate-400">
        <code>
          {parts}
          {inView && !done ? <span className="animate-pulse text-signal">▍</span> : null}
        </code>
      </pre>
      <pre className="sr-only">{JSON_PLAIN}</pre>
      {done ? (
        <div className="flex justify-end border-t border-line px-4 py-2.5">
          <button
            type="button"
            onClick={() => {
              setCount(0);
              setRun((r) => r + 1);
            }}
            className="font-data text-[11px] uppercase tracking-[0.16em] text-signal-ink hover:text-white"
          >
            ↻ {replayLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}


/* ---------------------------------- page ---------------------------------- */

export function Landing() {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [lang, setLangState] = useState<Lang>(() => readStoredLang());
  const setLang = (l: Lang) => {
    setLangState(l);
    storeLang(l);
  };
  const t = landingCopy[lang];
  const live = useLiveChain();
  const sl = t.sectionLabels;

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const toneClass = (tone: string) =>
    tone === 'emerald'
      ? 'border-emerald-500/50 text-emerald-300'
      : tone === 'amber'
        ? 'border-amber-500/50 text-amber-300'
        : tone === 'sky'
          ? 'border-signal/50 text-signal-ink'
          : 'border-line text-slate-300';

  return (
    <div className="paper landing-root min-h-screen bg-ink font-sans text-slate-200 antialiased">
      <IntroSplash scope="landing" />
      {/* Scroll progress: direct child of the root so no section's stacking
          context can trap it (regression-tested). */}
      <ScrollProgress />
      <SiteHeader
        nav={t.nav}
        lang={lang}
        setLang={setLang}
        accent="blue"
        menuId="landing-mobile-menu"
        variant="landing"
        launchLabel={t.launchApp}
        launchHref={APP_URL}
        langGroupAria={t.langGroupAria}
        menuToggleAria={t.menuToggleAria}
      />

      <main className="pt-[57px]">
        <ChainMarquee lang={lang} state={live} />

        {/* -------------------------------- hero ------------------------------ */}
        <section className="hero-grid relative px-4 pb-16 pt-12 md:px-8 md:pb-24 md:pt-20">
          <div className="relative mx-auto grid max-w-[1240px] items-start gap-12 lg:grid-cols-12">
            <div className="stagger min-w-0 lg:col-span-7">
              <p className="flex items-center gap-3 font-data text-[11px] uppercase tracking-[0.2em] text-slate-500">
                <span className="text-signal-ink">00</span>
                <span aria-hidden="true">—</span>
                <span>{t.heroPill}</span>
              </p>
              <h1 className="mt-8 font-display text-[64px] leading-[0.9] tracking-[-0.03em] text-white sm:text-[88px] lg:text-[124px]">
                {t.heroLine1}
                <br />
                NodeScope{' '}
                <span className="italic text-signal-ink">
                  {t.heroAccent}
                  <span aria-hidden="true" className="cursor-blink not-italic">_</span>
                </span>
              </h1>
              <p className="mt-8 max-w-[56ch] text-[17px] leading-[1.6] text-slate-400 md:text-lg">
                {t.heroParagraph}
                <span className="font-medium text-white underline decoration-signal decoration-2 underline-offset-4">{t.heroParagraphEmphasis}</span>
                {t.heroParagraphTail}
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <a href={APP_URL} className="btn-primary inline-flex items-center gap-2.5 px-6 py-3.5 text-[15px] font-semibold">
                  {t.launchApp}
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a href={JUDGES_URL} className="btn-ghost inline-flex items-center gap-2 px-5 py-3.5 text-[15px] font-medium">
                  {lang === 'id' ? 'Halaman juri' : 'For judges'}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <a href={DEMO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2 py-3.5 text-[15px] font-medium text-slate-300 underline decoration-slate-700 underline-offset-4 transition-colors hover:text-white">
                  {t.watchDemo}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
              <p className="mt-10 max-w-[60ch] border-t border-line pt-4 text-sm leading-relaxed text-slate-400">{t.heroPillarLine}</p>
              <p className="mt-3 font-data text-[11px] uppercase leading-relaxed tracking-[0.16em] text-slate-500">{t.heroFactLine}</p>
              <ul className="mt-4 flex flex-wrap gap-2 font-data text-[10px] uppercase tracking-[0.18em] text-slate-400">
                {t.heroMeta.map((m) => (
                  <li key={m} className="border border-line px-2 py-1">
                    {m}
                  </li>
                ))}
              </ul>
            </div>

            <div className="stagger min-w-0 lg:col-span-5 lg:pt-14">
              <LiveReadout lang={lang} state={live} />
              <figure className="mt-6 border border-line bg-panel">
                <div className="hero-media relative overflow-hidden">
                  <img src="/screenshots/03-snapshot-comparison.jpg" alt={t.heroFigureCaption} fetchPriority="high" className="plate aspect-[16/9] w-full object-cover object-top" />
                </div>
                <figcaption className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 font-data text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <span>
                    <span className="text-signal-ink">Fig. 01</span> — {t.heroFigureCaption}
                  </span>
                  <span className="hidden shrink-0 sm:inline" aria-hidden="true">
                    {t.heroChipEvm} · {t.heroChipSchema}
                  </span>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* ------------------------------- stats ------------------------------ */}
        <section className="border-y border-line bg-panel px-4 md:px-8">
          <div className="mx-auto grid max-w-[1240px] grid-cols-2 lg:grid-cols-4">
            {t.stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 70} className={`border-line py-8 pr-4 ${i % 2 === 1 ? 'border-l pl-4 lg:pl-6' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l lg:pl-6' : ''}`}>
                <p className="font-data text-[34px] font-medium leading-none tracking-[-0.04em] text-white md:text-[52px]">{s.value}</p>
                <p className="mt-3 font-data text-[11px] uppercase tracking-[0.2em] text-signal-ink">{s.label}</p>
                <p className="mt-1.5 max-w-[30ch] text-xs leading-relaxed text-slate-500">{s.sub}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <div className="border-b border-line px-4 py-3 md:px-8">
          <p className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-3 gap-y-1 font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">
            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 bg-emerald-500" />
            {t.banner}
          </p>
        </div>

        {/* ------------------------------ pillars ----------------------------- */}
        <Section index="01" label={sl.pillars} title={t.pillarSectionTitle}>
          <p className="max-w-[62ch] text-[17px] leading-relaxed text-slate-400">{t.pillarSectionIntro}</p>
          <div className="mt-10">
            <PillarCards health={t.pillarHealth} fees={t.pillarFees} />
          </div>
          <div className="graphite mt-10 border border-graphite p-6 md:p-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="font-display text-[30px] leading-tight text-white md:text-[40px]" style={{ fontFamily: 'var(--font-serif)' }}>
                {t.feeBlockTitle}
              </h3>
              <span className="font-data text-[10px] uppercase tracking-[0.2em] text-slate-500">Fee Lab · 26 Oct 2026</span>
            </div>
            <div className="mt-8 grid gap-px bg-line sm:grid-cols-2">
              <div className="bg-ink p-5">
                <p className="font-data text-[11px] uppercase tracking-[0.2em] text-slate-400">Fee-only</p>
                <p className="mt-2 font-data text-[56px] font-medium leading-none tracking-[-0.05em] text-slate-500 line-through decoration-signal decoration-[3px] md:text-[88px]">~804×</p>
                <p className="mt-2 text-xs text-slate-500">EVM ÷ native partialFee — the headline denominator</p>
              </div>
              <div className="bg-ink p-5">
                <p className="font-data text-[11px] uppercase tracking-[0.2em] text-signal-ink">All-in</p>
                <p className="mt-2 font-data text-[56px] font-medium leading-none tracking-[-0.05em] text-white md:text-[88px]">1.016×</p>
                <p className="mt-2 text-xs text-slate-400">EVM ÷ (native fee + refundable storage deposit)</p>
              </div>
            </div>
            <p className="mt-6 max-w-[70ch] text-sm leading-relaxed text-slate-300">{t.feeBlockBody}</p>
            <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2 font-data text-[13px] tabular-nums">
              <span className="text-white">{t.feeBlockEvm}</span>
              <span className="text-signal-soft">{t.feeBlockNative}</span>
            </div>
            <p className="mt-4 text-xs text-slate-500">{t.feeBlockFootnote}</p>
            <a href="/app/fee-lab" className="mt-6 inline-flex items-center gap-2 font-data text-[12px] uppercase tracking-[0.16em] text-signal-ink underline decoration-signal/50 underline-offset-4 hover:text-white">
              {t.feeBlockCta} →
            </a>
          </div>
        </Section>

        {/* --------------------------- health score --------------------------- */}
        <Section id="score" index="02" label={sl.score} title={t.scoreTitle} right={t.scoreRight}>
          <p className="max-w-[62ch] text-[17px] leading-relaxed text-slate-400">{t.scoreIntro}</p>
          <div className="mt-10 grid gap-8 xl:grid-cols-12">
            <div className="xl:col-span-4">
              <div className="graphite border border-graphite p-6">
                <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-400">{HEALTH_SCORE_FORMULA}</p>
                <p className="mt-4 font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">{lang === 'id' ? 'Total bobot' : 'Total weight'}</p>
                <p className="mt-1 font-data text-[96px] font-medium leading-none tracking-[-0.06em] text-white">
                  Σ100
                </p>
                <p className="mt-3 font-data text-[11px] uppercase tracking-[0.16em] text-slate-400">30 + 15 + 20 + 20 + 15</p>
                <div className="mt-5 flex h-3 w-full" aria-hidden="true">
                  {t.scoreRows.map((r, i) => (
                    <span key={r.label} style={{ width: `${r.weight}%`, opacity: 1 - i * 0.16 }} className="h-full border-r border-ink bg-signal last:border-r-0" />
                  ))}
                </div>
              </div>
            </div>
            <div className="min-w-0 xl:col-span-8">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <th className="py-2.5 pr-4 font-medium">{t.scoreHeaders[0]}</th>
                    <th className="py-2.5 pr-4 text-right font-medium">{t.scoreHeaders[1]}</th>
                    <th className="hidden py-2.5 font-medium sm:table-cell">{t.scoreHeaders[2]}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {t.scoreRows.map((r, i) => (
                    <tr key={r.label} className="align-top">
                      <td className="py-3.5 pr-4">
                        <span className="mr-2 font-data text-[11px] text-slate-500">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-white">{r.label}</span>
                        <p className="mt-1 text-[13px] leading-relaxed text-slate-500 sm:hidden">{r.rule}</p>
                      </td>
                      <td className="py-3.5 pr-4 text-right font-data text-lg tabular-nums text-white">{r.weight}</td>
                      <td className="hidden py-3.5 text-[13px] leading-relaxed text-slate-400 sm:table-cell">{r.rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-5 border border-line bg-panel px-4 py-3 font-data text-[12px] leading-relaxed text-slate-300">{t.scoreFormula}</p>
              <p className="mt-3 text-[13px] leading-relaxed text-slate-500">{t.scoreFootnote}</p>
              <a href="/docs#health-score" className="mt-5 inline-flex items-center gap-2 font-data text-[12px] uppercase tracking-[0.16em] text-signal-ink underline decoration-signal/50 underline-offset-4 hover:text-white">
                {t.scoreCta} →
              </a>
            </div>
          </div>
        </Section>

        {/* ------------------------------ problem ----------------------------- */}
        <Section id="problem" index="03" label={sl.problem} title={t.problemTitle} right={t.problemRight}>
          <Reveal>
            <div className="grid gap-10 md:grid-cols-2">
              <h3 className="sr-only">{t.problemStatement}</h3>
              <WordFill sentence={t.problemStatement} />
              <div className="space-y-4 text-base leading-[1.75] text-slate-400">
                <p>
                  {t.problemPara1a}
                  <span className="text-white">{t.problemPara1Emphasis}</span>
                  {t.problemPara1b}
                </p>
                <p>{t.problemPara2}</p>
                <div className="space-y-2.5 border-l-2 border-signal pl-4 pt-1 font-data text-[13px]">
                  <p className="flex gap-3">
                    <span className="shrink-0 text-slate-500">{t.consoleLabel}</span> <span>{t.consoleQuote}</span>
                  </p>
                  <p className="flex gap-3">
                    <span className="shrink-0 font-semibold text-white">{t.nodescopeLabel}</span> <span className="text-slate-200">{t.nodescopeQuote}</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-12 border-t border-white pt-6">
              <h3 className="font-data text-[12px] uppercase tracking-[0.2em] text-slate-500">{t.whyTitle}</h3>
              <ol className="mt-4 grid gap-x-10 gap-y-6 md:grid-cols-2">
                {t.whyItems.map((item, i) => (
                  <li key={item} className="flex gap-4 text-[15px] leading-[1.7] text-slate-300">
                    <span className="font-data text-[13px] text-signal-ink">{String(i + 1).padStart(2, '0')}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
            <FlowVisual lang={lang} />
          </Reveal>
        </Section>

        {/* -------------------------------- how ------------------------------- */}
        <Section id="how" index="04" label={sl.how} title={t.howTitle} right={t.howRight} tone="deep">
          <Reveal>
            <div aria-hidden="true" className="mb-8 border border-line bg-panel px-5 py-4">
              <svg viewBox="0 0 600 40" preserveAspectRatio="none" className="h-10 w-full">
                <path d="M 10 20 H 590" fill="none" stroke={INK_MUTED} strokeWidth="1" strokeDasharray="2 5" />
                <circle r="3.5" fill={SIGNAL}>
                  <animateMotion dur="6s" repeatCount="indefinite" path="M 10 20 H 590" />
                </circle>
                <circle r="3" fill="#16140f">
                  <animateMotion dur="9s" begin="1.5s" repeatCount="indefinite" path="M 10 20 H 590" />
                </circle>
              </svg>
              <div className="flex justify-between gap-3 font-data text-[10px] uppercase tracking-[0.2em] text-slate-500">
                <span>{t.packetYou}</span>
                <span className="hidden text-slate-400 sm:inline">eth_chainId · eth_blockNumber · net_version</span>
                <span>{t.packetReceipt}</span>
              </div>
              <p className="mt-2 text-center font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">{t.packetNote}</p>
            </div>
            <ol className="border-t border-white">
              {t.howSteps.map((s, i) => (
                <li key={s.title} className="grid gap-3 border-b border-line py-7 md:grid-cols-12">
                  <p className="font-data text-[44px] font-medium leading-none tracking-[-0.04em] text-slate-700 md:col-span-2">{String(i + 1).padStart(2, '0')}</p>
                  <h3 className="font-display text-[30px] leading-tight text-white md:col-span-4">{s.title}</h3>
                  <p className="text-[15px] leading-relaxed text-slate-400 md:col-span-6">{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="border border-line bg-panel p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-[26px] text-white">{t.archTitle}</h3>
                  <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">{t.archRight}</span>
                </div>
                <ol className="mt-5">
                  {t.archNodes.map((node, i) => (
                    <li key={node} className="flex gap-3">
                      <span className="flex flex-col items-center">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-white font-data text-[11px] text-white">{i + 1}</span>
                        {i < t.archNodes.length - 1 && <span aria-hidden="true" className="w-px flex-1 bg-line" />}
                      </span>
                      <span className="pb-4 text-sm leading-relaxed text-slate-300">{node}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <Plate label={t.reportSampleLabel} right={t.reportSampleRight} dark>
                <TypewriterJson replayLabel={t.typeReplay} />
              </Plate>
            </div>
          </Reveal>
        </Section>

        {/* ------------------------------ tutorial ---------------------------- */}
        <Section id="tutorial" index="05" label={sl.tutorial} title={t.tutorialTitle} right={t.tutorialRight}>
          <Reveal>
            <p className="max-w-[62ch] text-[17px] leading-relaxed text-slate-400">{t.tutorialIntro}</p>
            <div className="mt-10 grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
              {t.tutorialSteps.map((s) => (
                <div key={s.n} className="bg-ink p-6">
                  <p className="font-data text-[12px] uppercase tracking-[0.2em] text-signal-ink">{s.n}</p>
                  <h3 className="mt-4 font-display text-[26px] leading-tight text-white">{s.title}</h3>
                  <p className="mt-3 text-[15px] leading-[1.7] text-slate-400">{s.body}</p>
                </div>
              ))}
              <div className="graphite flex flex-col justify-center p-6">
                <p className="font-display text-[30px] leading-tight text-white" style={{ fontFamily: 'var(--font-serif)' }}>
                  {t.tutorialCtaTitle}
                </p>
                <p className="mt-2 text-[15px] leading-[1.7] text-slate-300">{t.tutorialCtaBody}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a href={APP_URL} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold">
                    {t.tutorialCtaPrimary}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a href="/verify" className="btn-ghost inline-flex items-center gap-2 px-5 py-3 text-sm font-medium">
                    {t.tutorialCtaSecondary}
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </Section>

        {/* ----------------------------- instrument --------------------------- */}
        <Section id="instrument" index="06" label={sl.instrument} title={t.instrumentTitle} right={t.instrumentRight} tone="deep">
          <Reveal>
            <div className="grid items-start gap-6 xl:grid-cols-2">
              <CheckTranscript lang={lang} />
              <Plate label={t.diffHeader} right={t.diffRight}>
                <div className="overflow-x-auto px-5 py-5 font-data text-[12.5px] leading-[1.9]">
                  <p className="whitespace-nowrap"><span className="mr-4 text-slate-500">01</span><span className="text-slate-500"># nodescope.health-snapshot.v1 — diff A → B</span></p>
                  <p className="whitespace-nowrap"><span className="mr-4 text-slate-500">02</span><span className="text-slate-400">A · block 143,764 · 15:48:05 WIB</span></p>
                  <p className="whitespace-nowrap"><span className="mr-4 text-slate-500">03</span><span className="text-slate-400">B · block 143,776 · 15:49:21 WIB</span></p>
                  <p className="whitespace-nowrap"><span className="mr-4 text-slate-500">04</span><span className="text-slate-500">eth_chainId&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;0x190f1ca9 → 0x190f1ca9&nbsp;&nbsp;{t.diffUnchanged}</span></p>
                  <p className="-mx-5 whitespace-nowrap bg-red-400/[0.08] px-5"><span className="mr-4 text-slate-500">05</span><span className="text-red-400">− eth_blockNumber&nbsp;&nbsp;&nbsp;143,764</span></p>
                  <p className="-mx-5 whitespace-nowrap bg-emerald-400/[0.09] px-5"><span className="mr-4 text-slate-500">06</span><span className="text-emerald-400">+ eth_blockNumber&nbsp;&nbsp;&nbsp;143,776&nbsp;&nbsp;Δ +12</span></p>
                  <p className="whitespace-nowrap"><span className="mr-4 text-slate-500">07</span><span className="text-slate-500">net_version&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;420420777 → 420420777&nbsp;&nbsp;{t.diffUnchanged}</span></p>
                  <p className="whitespace-nowrap"><span className="mr-4 text-slate-500">08</span><span className="text-slate-500">findings&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{t.diffFindings}</span></p>
                </div>
                <p className="border-t border-line px-5 py-3 font-data text-[10.5px] uppercase tracking-[0.14em] text-slate-500">{t.diffFooter}</p>
              </Plate>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="mt-10 hidden md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <th className="py-3 pr-5 font-medium">{t.capabilityHeaders[0]}</th>
                    <th className="py-3 pr-5 font-medium">{t.capabilityHeaders[1]}</th>
                    <th className="py-3 font-medium">{t.capabilityHeaders[2]}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-sm">
                  {t.capabilities.map((r, i) => (
                    <tr key={r.cap} className="group align-top transition-colors hover:bg-panel">
                      <td className="py-4 pr-5 font-data text-[13px] font-medium text-white">
                        <span className="mr-3 text-slate-500">0{i + 1}</span>
                        {r.cap}
                      </td>
                      <td className="max-w-md py-4 pr-5 leading-relaxed text-slate-400">{r.what}</td>
                      <td className="py-4">
                        <span className={`inline-block border px-2 py-1 font-data text-[11px] ${toneClass(r.tone)}`}>{r.proof}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-10 divide-y divide-line border-y border-line md:hidden">
              {t.capabilities.map((r, i) => (
                <div key={r.cap} className="py-4">
                  <p className="font-data text-[13px] font-medium text-white">
                    <span className="mr-3 text-slate-500">0{i + 1}</span>
                    {r.cap}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{r.what}</p>
                  <span className={`mt-2 inline-block border px-2 py-1 font-data text-[11px] ${toneClass(r.tone)}`}>{r.proof}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </Section>

        {/* ------------------------------ evidence ---------------------------- */}
        <Section id="evidence" index="07" label={sl.evidence} title={t.evidenceTitle} right={t.evidenceRight}>
          <Reveal>
            <div className="border border-line bg-panel px-5 py-5">
              <EvidenceGrid lang={lang} />
              <p className="mt-3.5 font-data text-[10.5px] leading-relaxed tracking-[0.04em] text-slate-500">{t.evidenceGridCaption}</p>
            </div>
            <div className="mt-8 hidden md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <th className="py-3 pr-5 font-medium">{t.evidenceHeaders[0]}</th>
                    <th className="py-3 pr-5 font-medium">{t.evidenceHeaders[1]}</th>
                    <th className="py-3 font-medium">{t.evidenceHeaders[2]}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-data text-[13px]">
                  {t.evidenceRows.map((r) => (
                    <tr key={r.block} className="transition-colors hover:bg-panel">
                      <td className="py-3.5 pr-5 text-[20px] font-medium tracking-[-0.02em] text-white">{r.block}</td>
                      <td className="py-3.5 pr-5 text-slate-300">
                        {r.label}
                        {'delta' in r && r.delta ? <span className="ml-2 border border-emerald-500/50 px-1.5 py-0.5 text-[11px] text-emerald-300">Δ {r.delta}</span> : null}
                      </td>
                      <td className="py-3.5 text-slate-500">{r.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-8 divide-y divide-line border-y border-line md:hidden">
              {t.evidenceRows.map((r) => (
                <div key={r.block} className="py-4 font-data text-[13px]">
                  <p className="text-[20px] font-medium text-white">{r.block}</p>
                  <p className="mt-1 text-slate-300">
                    {r.label}
                    {'delta' in r && r.delta ? <span className="ml-2 border border-emerald-500/50 px-1.5 py-0.5 text-[11px] text-emerald-300">Δ {r.delta}</span> : null}
                  </p>
                  <p className="mt-1 text-slate-500">{r.when}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 font-data text-[11px] leading-relaxed text-slate-500">{t.evidenceFootnote}</p>
            <figure className="mt-10 border border-line bg-panel">
              <MotionVideo caption={t.motionCaption} />
              <figcaption className="border-t border-line px-5 py-3.5">
                <p className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-300">
                  <span className="text-signal-ink">Fig. 02</span> — {t.motionCaption}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{t.motionNote}</p>
              </figcaption>
            </figure>
          </Reveal>
          <Reveal delay={80}>
            <div className="mt-8 grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-3">
              {t.screenshots.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  onClick={() => setLightbox(i)}
                  className={`group relative flex flex-col justify-start bg-panel text-left ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}
                >
                  <span className="block overflow-hidden">
                    <img src={s.src} alt={s.caption} className="plate aspect-[16/10] w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]" loading="lazy" />
                  </span>
                  <span className="flex flex-1 items-start justify-between gap-2 border-t border-line px-4 py-3 font-data text-[11px] uppercase tracking-[0.14em] text-slate-400">
                    <span>{s.caption}</span>
                    <span aria-hidden="true" className="text-signal-ink opacity-0 transition-opacity group-hover:opacity-100">↗</span>
                  </span>
                </button>
              ))}
              <div className="hidden items-end bg-panel p-4 font-data text-[10px] uppercase leading-relaxed tracking-[0.16em] text-slate-500 lg:flex">{t.galleryLabel}</div>
            </div>
          </Reveal>
        </Section>

        {/* --------------------------- on-chain proof ------------------------- */}
        <Section id="onchain" index="08" label={sl.onchain} title={t.onchainTitle} right={t.onchainRight} tone="deep">
          <Reveal>
            <p className="max-w-[62ch] text-[17px] leading-relaxed text-slate-400">{t.onchainIntro}</p>
            <dl className="mt-10 border-t border-white">
              <div className="grid gap-2 border-b border-line py-5 md:grid-cols-12">
                <dt className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500 md:col-span-3">Registry contract</dt>
                <dd className="md:col-span-9">
                  <p className="break-all font-data text-[15px] text-white md:text-[17px]">{REGISTRY_CONTRACT}</p>
                  <p className="mt-1 text-xs text-slate-500">Portaldot V3 testnet · chain {PORTALDOT_CHAIN_ID} · ownerless</p>
                </dd>
              </div>
              <div className="grid gap-2 border-b border-line py-5 md:grid-cols-12">
                <dt className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500 md:col-span-3">Anchor transaction</dt>
                <dd className="md:col-span-9">
                  <p className="break-all font-data text-[15px] text-white md:text-[17px]">{ANCHOR_TX}</p>
                  <p className="mt-1 text-xs text-slate-500">Anchor block {ANCHOR_BLOCK} · receipt status success</p>
                </dd>
              </div>
              <div className="grid gap-2 border-b border-line py-5 md:grid-cols-12">
                <dt className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500 md:col-span-3">Anchored report hash</dt>
                <dd className="md:col-span-9">
                  <p className="break-all font-data text-[15px] text-white md:text-[17px]">{ANCHORED_REPORT_HASH}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Exported {ANCHORED_REPORT_EXPORTED_AT} · {ANCHORED_REPORT_RECORDS} records
                  </p>
                </dd>
              </div>
            </dl>
            <div className="mt-8 grid gap-px border border-line bg-line sm:grid-cols-3">
              {ANCHORED_REPORTS.map((a) => (
                <a key={a.tx} href={`/verify?hash=${a.hash}&contract=${REGISTRY_CONTRACT}&tx=${a.tx}`} className="group block bg-panel p-5 transition-colors hover:bg-ink">
                  <p className="font-data text-[10px] uppercase tracking-[0.2em] text-slate-500">{a.label}</p>
                  <p className="mt-2 font-data text-[30px] font-medium leading-none tracking-[-0.03em] text-white">#{a.block}</p>
                  <p className="mt-2 font-data text-[11px] text-slate-500">
                    {a.hash.slice(0, 10)}…{a.hash.slice(-6)} · {a.records} records
                  </p>
                  <p className="mt-3 font-data text-[11px] uppercase tracking-[0.16em] text-signal-ink group-hover:underline">verify ↗</p>
                </a>
              ))}
            </div>
            <div className="mt-10 grid gap-8 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <h3 className="font-display text-[28px] text-white">{t.onchainCheckTitle}</h3>
                <ol className="mt-4 space-y-3">
                  {t.onchainCheckSteps.map((s, i) => (
                    <li key={s} className="flex gap-4 text-[15px] leading-[1.7] text-slate-400">
                      <span className="font-data text-signal-ink">0{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="lg:col-span-5">
                <a href={`/verify?hash=${ANCHORED_REPORT_HASH}&contract=${REGISTRY_CONTRACT}&tx=${ANCHOR_TX}`} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold">
                  Verify this anchor on /verify
                  <ArrowRight className="h-4 w-4" />
                </a>
                <p className="mt-4 text-xs leading-relaxed text-slate-500">{t.onchainVerifyNote}</p>
                <p className="mt-4 font-data text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {SITE_TESTS} tests · {SITE_TEST_FILES} files · CI on Ubuntu + Windows
                </p>
              </div>
            </div>
          </Reveal>
        </Section>

        {/* ------------------------------ who uses ---------------------------- */}
        <Section id="who" index="09" label={sl.who} title={t.whoTitle} right={t.whoRight}>
          <Reveal>
            <ul className="border-t border-white">
              {t.whoItems.map((item, i) => (
                <li key={item.title} className="grid gap-2 border-b border-line py-6 md:grid-cols-12">
                  <span className="font-data text-[12px] text-slate-500 md:col-span-1">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="font-display text-[26px] leading-tight text-white md:col-span-5">{item.title}</h3>
                  <p className="text-[15px] leading-[1.7] text-slate-400 md:col-span-6">{item.body}</p>
                </li>
              ))}
            </ul>
          </Reveal>
        </Section>

        {/* ----------------------------- V3 references ------------------------ */}
        <Section id="v3" index="10" label={sl.v3} title={t.v3Title} right={t.v3Right} tone="deep">
          <Reveal>
            <p className="max-w-[62ch] text-[15px] leading-[1.75] text-slate-400">{t.v3Intro}</p>
            <div className="mt-8 grid gap-px border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
              {t.v3Cards.map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="group relative block bg-panel p-5 transition-colors hover:bg-ink">
                  <p className="flex items-center justify-between font-data text-[11px] uppercase tracking-[0.16em] text-signal-ink">
                    {link.label}
                    <span aria-hidden="true" className="opacity-0 transition-opacity group-hover:opacity-100">↗</span>
                  </p>
                  <p className="mt-2 break-all font-data text-xs text-slate-300">{link.href}</p>
                  <p className="mt-1.5 text-xs text-slate-500">{link.note}</p>
                </a>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">{t.v3Footnote}</p>
          </Reveal>
        </Section>

        {/* ------------------------------ roadmap ----------------------------- */}
        <Section id="roadmap" index="11" label={sl.roadmap} title={t.roadmapTitle} right={t.roadmapRight}>
          <Reveal>
            <div className="grid gap-px border border-line bg-line lg:grid-cols-3">
              {t.roadmapItems.map((r) => (
                <div key={r.title} className="bg-ink p-6">
                  <span className="inline-flex items-center gap-2 font-data text-[11px] uppercase tracking-[0.16em] text-emerald-400">
                    <span aria-hidden="true" className="h-2 w-2 bg-emerald-500" />
                    {t.roadmapShipped}
                  </span>
                  <h3 className="mt-4 font-display text-[26px] leading-tight text-white">{r.title}</h3>
                  <p className="mt-3 text-[14px] leading-[1.7] text-slate-400">{r.body}</p>
                </div>
              ))}
            </div>
            <div className="graphite mt-6 border border-graphite p-6 md:p-8">
              <p className="inline-flex items-center gap-2 font-data text-[11px] uppercase tracking-[0.16em] text-signal-ink">
                <span aria-hidden="true" className="h-2 w-2 bg-signal" />
                {t.roadmapNewLabel}
              </p>
              <div className="mt-5 grid gap-8 lg:grid-cols-3">
                {t.roadmapNewItems.map((r) => (
                  <div key={r.title} className="border-t border-line pt-4">
                    <h3 className="font-display text-[26px] leading-tight text-white" style={{ fontFamily: 'var(--font-serif)' }}>
                      {r.title}
                    </h3>
                    <p className="mt-3 text-[14px] leading-[1.7] text-slate-400">{r.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 border border-dashed border-slate-700 p-6 md:p-8">
              <p className="font-data text-[11px] uppercase tracking-[0.16em] text-amber-400">{t.roadmapNextLabel}</p>
              <div className="mt-5 grid gap-6 md:grid-cols-2">
                {t.roadmapNextItems.map((r) => (
                  <div key={r.title}>
                    <h3 className="font-display text-[22px] leading-tight text-white">{r.title}</h3>
                    <p className="mt-2 text-[14px] leading-[1.7] text-slate-400">{r.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-5 text-sm text-slate-500">{t.roadmapFootnote}</p>
          </Reveal>
        </Section>

        {/* --------------------------- judge quickstart ----------------------- */}
        <Section id="judge" index="12" label={sl.judge} title={t.judgeTitle} right={t.judgeRight} tone="deep">
          <Reveal>
            <p className="max-w-[62ch] text-[17px] leading-relaxed text-slate-400">{t.judgeIntro}</p>
            <ol className="mt-8 border-t border-white">
              {t.judgeSteps.map((s, i) => (
                <li key={s.title} className="grid gap-2 border-b border-line py-6 md:grid-cols-12">
                  <span className="font-data text-[12px] text-signal-ink md:col-span-1">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="font-display text-[26px] leading-tight text-white md:col-span-4">{s.title}</h3>
                  <p className="text-[15px] leading-[1.7] text-slate-400 md:col-span-7">{s.body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href={JUDGES_URL} className="btn-ink inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold">
                {lang === 'id' ? 'Tabel bukti untuk juri' : 'Evidence table for judges'}
                <ArrowRight className="h-4 w-4" />
              </a>
              <p className="text-sm text-slate-500">{t.judgeFootnote}</p>
            </div>
          </Reveal>
        </Section>

        {/* -------------------------------- CTA ------------------------------- */}
        <section className="graphite relative overflow-hidden px-4 py-24 md:px-8 md:py-32">
          <div aria-hidden="true" className="cta-glow pointer-events-none absolute left-1/2 top-full h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          <Reveal className="relative mx-auto max-w-[1240px]">
            <p className="font-data text-[12px] uppercase tracking-[0.2em] text-slate-500">
              <span className="text-signal-ink">13</span> — {lang === 'id' ? 'Mulai' : 'Start'}
            </p>
            <h2 className="mt-6 max-w-[16ch] font-display text-[56px] leading-[0.92] tracking-[-0.02em] text-white md:text-[112px]" style={{ fontFamily: 'var(--font-serif)' }}>
              {t.ctaTitleA}
              <span className="italic text-signal">{t.ctaTitleB}</span>
            </h2>
            <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-line pt-6">
              <p className="max-w-[48ch] text-[15px] leading-relaxed text-slate-400">{t.ctaBody}</p>
              <a href={APP_URL} className="btn-primary inline-flex items-center gap-2.5 px-7 py-4 text-base font-semibold">
                {t.launchApp}
                <ArrowRight className="h-5 w-5" />
              </a>
            </div>
          </Reveal>
        </section>
      </main>
      <SiteFooter t={t} />

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#16140f]/90 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={t.screenshots[lightbox].caption}
        >
          <button
            type="button"
            aria-label={t.lightboxClose}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center border border-[#f1ede4]/40 text-[#f1ede4]"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <figure className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <img src={t.screenshots[lightbox].src} alt={t.screenshots[lightbox].caption} className="mx-auto block max-h-[82vh] w-auto max-w-full border border-[#f1ede4]/20" />
            <figcaption className="mt-3 text-center font-data text-xs uppercase tracking-[0.16em] text-[#cdc8bc]">{t.screenshots[lightbox].caption}</figcaption>
          </figure>
        </div>
      )}
      <BackToTop label={t.backToTop} />
    </div>
  );
}
