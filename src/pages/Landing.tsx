import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowRight, ArrowUpRight, Pause, Play, X } from 'lucide-react';
import { sendJsonRpcRequest } from '../services/rpcClient';
import { DEFAULT_PORTALDOT_V3_EVM_RPC } from '../types/endpoint';

const APP_URL = '/app';
const DEMO_URL = 'https://www.youtube.com/watch?v=qne3_eZdcKA';
const GITHUB_URL = 'https://github.com/Firzadf/nodescope';
const BUIDL_URL = 'https://dorahacks.io/build/50146';
const DOCUMENTED_CHAIN_ID = 420420777;

/* ---------------------------------- hooks --------------------------------- */

function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
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
  const { ref, inView } = useInView<HTMLDivElement>(0.12);
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms`, transitionTimingFunction: 'var(--ease-out)' }}
      className={`reveal ${className} transition-transform transition-opacity duration-500 ${inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
    >
      {children}
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

type ReadoutState =
  | { kind: 'probing' }
  | { kind: 'live'; block: number; chainOk: boolean; latencyMs: number | null; at: Date }
  | { kind: 'unreachable'; at: Date };

function LiveReadout() {
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

  return (
    <div className="overflow-hidden rounded-[24px] border border-line bg-panel/90 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between border-b border-line bg-black/25 px-4 py-2.5">
        <span className="font-data text-[11px] text-slate-400">&gt;_ LIVE READOUT · PORTALDOT V3 EVM</span>
        <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">[ Fig. 00 — Now ]</span>
      </div>
      <div className="px-5 py-5">
        <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">Latest block — observed by this page</p>
        <div className="mt-2 font-data text-[44px] font-semibold leading-none text-white md:text-[54px]">
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
        <div className="mt-4 space-y-1.5 border-t border-line pt-3.5 font-data text-[11.5px] leading-relaxed">
          {state.kind === 'probing' && (
            <p key="probing" className="state-swap text-slate-400">
              STATUS <span className="text-slate-200">PROBING THE ENDPOINT…</span>
            </p>
          )}
          {state.kind === 'live' && (
            <div key="live" className="state-swap space-y-1.5">
              <p className="text-slate-400">
                CHAIN ID <span className="text-slate-100">0x190F1CA9</span>{' '}
                {state.chainOk ? (
                  <span className="text-emerald-400">— MATCHES THE DOCUMENTED CHAIN</span>
                ) : (
                  <span className="text-amber-300">— DID NOT MATCH 420420777</span>
                )}
              </p>
              <p className="text-slate-400">
                ANSWERED IN <span className="text-slate-100">{state.latencyMs !== null ? `${state.latencyMs} MS` : '—'}</span>
                {' · '}AT{' '}
                <span className="text-slate-100">
                  {state.at.toLocaleTimeString('en-GB', { hour12: false })} WIB
                </span>
              </p>
              <p className="text-slate-500">Fetched once, when this page loaded. Not a poll — reload to re-observe.</p>
            </div>
          )}
          {state.kind === 'unreachable' && (
            <div key="unreachable" className="state-swap space-y-1.5">
              <p className="text-amber-300">THE ENDPOINT DID NOT ANSWER WHILE THIS PAGE LOADED.</p>
              <p className="text-slate-400">
                NodeScope reports that too — it&apos;s the whole point. Last documented observation:{' '}
                <span className="text-slate-100">block 147,639 · 22 Oct 2026</span>.
              </p>
            </div>
          )}
        </div>
      </div>
      <svg viewBox="0 0 600 40" className="h-9 w-full border-t border-line bg-black/20" aria-hidden="true">
        <path
          className="ecg-path"
          d="M0 20 H180 L192 20 L200 6 L210 34 L220 20 H330 L342 12 L352 28 L360 20 H600"
          fill="none"
          stroke="#0181FB"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/* ----------------------------- section heading ---------------------------- */

function SectionHeading({ title, right }: { title: string; right?: string }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
      <p className="font-display text-xl font-semibold tracking-tight text-white">{title}</p>
      {right && <p className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-600">{right}</p>}
    </div>
  );
}

const SCREENSHOTS = [
  { src: '/screenshots/01-endpoint-config.png', caption: '01 — Endpoint configuration' },
  { src: '/screenshots/02-health-check-results.png', caption: '02 — Health check results' },
  { src: '/screenshots/03-snapshot-comparison.png', caption: '03 — Snapshot comparison' },
  { src: '/screenshots/04-findings-categorized.png', caption: '04 — Findings, categorized' },
  { src: '/screenshots/05-report-export.png', caption: '05 — Report export' },
];

/* ------------------------------ step player ------------------------------- */

const CHECK_STEPS = [
  { method: 'eth_chainId', observed: '0x190f1ca9 — chain 420420777', latency: 562 },
  { method: 'eth_blockNumber', observed: 'block 147,638', latency: 258 },
  { method: 'web3_clientVersion', observed: 'client string, recorded in snapshot', latency: 257 },
  { method: 'net_version', observed: '420420777', latency: 274 },
];

function CheckTranscript() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setActive((a) => (a + 1) % CHECK_STEPS.length), 1900);
    return () => clearInterval(t);
  }, [playing]);

  const step = CHECK_STEPS[active];

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line bg-black/25 px-4 py-2.5">
        <span className="font-data text-[11px] text-slate-400">&gt;_ HEALTH CHECK — RECORDED RUN</span>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause transcript' : 'Play transcript'}
          className="btn-ghost flex h-7 w-7 items-center justify-center rounded-full"
        >
          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="grid md:grid-cols-2">
        <ol className="divide-y divide-line border-b border-line md:border-b-0 md:border-r">
          {CHECK_STEPS.map((s, i) => (
            <li key={s.method}>
              <button
                type="button"
                onClick={() => {
                  setActive(i);
                  setPlaying(false);
                }}
                className={`relative flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors duration-200 ${
                  i === active ? 'bg-white/[0.045]' : 'hover:bg-white/[0.02]'
                }`}
              >
                {i === active && (
                  <span className="absolute left-0 top-0 h-full w-[3px] bg-[#0181FB]" />
                )}
                <span className="font-data text-xs text-slate-600">{String(i + 1).padStart(2, '0')}</span>
                <span className={`font-data text-sm ${i === active ? 'text-white' : 'text-slate-400'}`}>{s.method}</span>
                <span className={`ml-auto font-data text-xs ${i < active || !playing ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {i === active && playing ? 'RUNNING' : 'PASS'}
                </span>
                {i === active && playing && (
                  <span
                    key={active}
                    aria-hidden="true"
                    className="step-progress absolute bottom-0 left-0 h-[2px] w-full bg-[#0181FB]"
                  />
                )}
              </button>
            </li>
          ))}
        </ol>
        <div className="px-5 py-5" key={active}>
          <div className="state-swap">
            <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">Observed value</p>
            <p className="mt-2 font-data text-lg leading-snug text-white">{step.observed}</p>
            <p className="mt-4 font-data text-[11.5px] text-slate-400">
              LATENCY <span className="text-slate-100">{step.latency} MS</span> · OUTCOME{' '}
              <span className="text-emerald-400">SUCCESS</span>
            </p>
            <p className="mt-5 border-t border-line pt-3.5 text-[13px] leading-relaxed text-slate-500">
              One step of a real check recorded 22 Oct 2026. Four methods, four receipts — saved as snapshot{' '}
              <span className="font-data text-slate-300">nodescope.health-snapshot.v1</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- flow visual ------------------------------ */

/**
 * One question, two answers. The console lane asks eth_blockNumber once and
 * keeps nothing; the NodeScope lane turns the same method into two kept
 * snapshots and a diff. All values are the real demo pair (22 Oct 2026).
 * Pure SVG/CSS — paths draw in when the visual scrolls into view.
 */
function FlowVisual() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className={`mt-12 overflow-hidden rounded-xl border border-line bg-panel ${inView ? 'flow-in' : ''}`}>
      <div className="flex items-center justify-between border-b border-line bg-black/25 px-4 py-2.5">
        <span className="font-data text-[11px] text-slate-400">ONE QUESTION — eth_blockNumber — TWO ANSWERS</span>
        <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">Demo data · 22 Oct 2026</span>
      </div>
      <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
        {/* Console lane: one call, one answer, nothing kept. */}
        <div className="px-5 py-5">
          <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">Console — asks once</p>
          <svg viewBox="0 0 320 44" className="mt-4 w-full" aria-hidden="true">
            <path pathLength={100} className="flow-draw" d="M8 22 H104" fill="none" stroke="#64748b" strokeWidth="1.6" />
            <line x1="128" y1="22" x2="312" y2="22" stroke="#475569" strokeWidth="1.2" strokeDasharray="3 6" opacity="0.5" />
            <circle className="flow-node" style={{ transitionDelay: '500ms' }} cx="116" cy="22" r="5" fill="#0a1226" stroke="#94a3b8" strokeWidth="1.6" />
          </svg>
          <p className="mt-3 font-data text-[12.5px] leading-relaxed text-slate-400">
            eth_blockNumber → <span className="text-slate-200">143,764</span>
            <span className="text-slate-600"> — answered, then gone. Nothing is kept, nothing can be shown later.</span>
          </p>
        </div>
        {/* NodeScope lane: same call, kept twice, diffed, exported. */}
        <div className="px-5 py-5">
          <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-300">NodeScope — proves over time</p>
          <svg viewBox="0 0 320 44" className="mt-4 w-full" aria-hidden="true">
            <path pathLength={100} className="flow-draw" d="M8 22 H312" fill="none" stroke="#0181FB" strokeWidth="1.6" />
            <circle className="flow-node" style={{ transitionDelay: '150ms' }} cx="8" cy="22" r="5" fill="#0a1226" stroke="#0181FB" strokeWidth="1.8" />
            <circle className="flow-node" style={{ transitionDelay: '600ms' }} cx="140" cy="22" r="5" fill="#0a1226" stroke="#0181FB" strokeWidth="1.8" />
            <circle className="flow-node" style={{ transitionDelay: '1000ms' }} cx="238" cy="22" r="5" fill="#0a1226" stroke="#34d399" strokeWidth="1.8" />
            <circle className="flow-node" style={{ transitionDelay: '1350ms' }} cx="312" cy="22" r="5" fill="#0a1226" stroke="#e2e8f0" strokeWidth="1.8" />
          </svg>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-data text-[11px] text-slate-500">
            <span>A · <span className="text-slate-200">143,764</span></span>
            <span>B · <span className="text-slate-200">143,776</span></span>
            <span className="text-emerald-400">Δ +12 · 76 s</span>
            <span className="text-slate-300">report exported</span>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
            The same answers, kept as snapshots — so the change between them is a fact, not a memory.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ evidence grid ----------------------------- */

function EvidenceGrid() {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);
  return (
    <div
      ref={ref}
      className={`grid grid-cols-12 gap-1.5 ${inView ? 'cells-in' : ''}`}
      role="img"
      aria-label="48 consecutive blocks observed during one session, from 147,592 to 147,639"
    >
      {Array.from({ length: 48 }).map((_, i) => (
        <span
          key={i}
          className="evidence-cell h-6 rounded-[3px]"
          style={{
            transitionDelay: `${i * 18}ms`,
            backgroundColor:
              i === 47 ? 'rgba(52, 211, 153, 0.85)' : `rgba(1, 129, 251, ${0.1 + (i / 47) * 0.5})`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------ HUD hero arc ------------------------------ */

/**
 * Receipt HUD hero arc: one flat blue arc with a single dot travelling along
 * it. It is ambient decoration only, it carries no data, and it never implies
 * a live block height. The live number stays in the Live Readout card, which
 * is fetched once when the page loads.
 */
function HudArc() {
  return (
    <svg
      viewBox="0 0 1200 240"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="hud-arc pointer-events-none absolute inset-x-0 top-0 h-56 w-full opacity-60"
    >
      <path d="M -40 240 Q 600 -40 1240 240" fill="none" stroke="#0181FB" strokeOpacity="0.35" strokeWidth="1" />
      <circle r="3.5" fill="#0181FB">
        <animateMotion dur="14s" repeatCount="indefinite" path="M -40 240 Q 600 -40 1240 240" />
      </circle>
    </svg>
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
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-[2px] bg-black/40">
      <div className="h-full bg-[#0181FB]" style={{ width: `${progress}%` }} />
    </div>
  );
}

/* ------------------------------ word fill --------------------------------- */

/**
 * Scroll-scrubbed word fill for the problem statement. Pure presentation:
 * the full sentence is also rendered sr-only, so the text itself never
 * changes, only how brightly each word is lit as the reader scrolls.
 */
function WordFill({ sentence }: { sentence: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1);
      return;
    }
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const p = (window.innerHeight * 0.85 - rect.top) / (rect.height + window.innerHeight * 0.3);
      setProgress(Math.min(1, Math.max(0, p)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const words = sentence.split(' ');
  return (
    <p ref={ref} aria-hidden="true" className="font-display text-3xl font-semibold leading-tight tracking-tight md:text-[40px]">
      {words.map((w, i) => {
        const lit = progress * words.length > i;
        return (
          <span
            key={i}
            style={{ transition: 'color 0.3s ease, filter 0.3s ease', filter: lit ? 'blur(0px)' : 'blur(1.5px)' }}
            className={lit ? 'text-white' : 'text-slate-600'}
          >
            {w}{' '}
          </span>
        );
      })}
    </p>
  );
}

/* ---------------------------------- page ---------------------------------- */

export function Landing() {
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  return (
    <div className="min-h-screen bg-ink font-sans text-slate-200 antialiased selection:bg-[#8C1DEF]/40 selection:text-white">
      {/* -------------------------------- nav ------------------------------- */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-ink">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="NodeScope logo" className="h-7 w-7 rounded-lg" />
            <span className="font-display text-[17px] font-semibold tracking-tight text-white">NodeScope</span>
          </a>
          <nav className="mx-auto hidden items-center gap-7 text-sm text-slate-400 md:flex">
            <a href="#problem" className="transition-colors hover:text-white">The Problem</a>
            <a href="#how" className="transition-colors hover:text-white">How It Works</a>
            <a href="#instrument" className="transition-colors hover:text-white">The Instrument</a>
            <a href="#evidence" className="transition-colors hover:text-white">Evidence</a>
            <a href="#roadmap" className="transition-colors hover:text-white">Roadmap</a>
            <a href="/mainnet" className="transition-colors hover:text-white">Mainnet</a>
            <a href="/verify" className="transition-colors hover:text-white">Verify</a>
          </nav>
          <a href={APP_URL} className="btn-primary ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold md:ml-0">
            Launch App
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </header>

      {/* -------------------------------- hero ------------------------------ */}
      <section className="relative overflow-hidden px-4 pb-24 pt-32 md:pt-40">
        <HudArc />
        <div aria-hidden="true" className="pointer-events-none absolute -top-32 right-[-10%] h-[480px] w-[480px] rounded-full bg-[#0181FB]/[0.14] blur-[120px]" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-[-10%] h-[360px] w-[360px] rounded-full bg-[#0181FB]/[0.08] blur-[100px]" />
        <ScrollProgress />
        <div className="relative mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-12">
          <div className="stagger lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-black/30 px-3 py-1.5 font-data text-[10px] uppercase tracking-[0.22em] text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0181FB]" />
              HUD · Portaldot V3 EVM · Read-only by default
            </p>
            <h1 className="mt-7 font-display text-[52px] font-semibold leading-[0.98] tracking-tight text-white md:text-[88px]">
              Consoles interact.
              <br />
              NodeScope{' '}
              <span className="font-data font-medium tracking-tight text-[#0181FB]" style={{ textShadow: '0 0 32px rgba(1, 129, 251, 0.45)' }}>
                proves.<span className="cursor-blink">▊</span>
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 md:text-lg">
              A read-only diagnostics toolkit for Portaldot nodes. It records health checks as snapshots, diffs
              them deterministically, and exports the report — so a node&apos;s health is something you can{' '}
              <span className="text-slate-100">show</span>, not something you assert.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <a href={APP_URL} className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold">
                Launch App
                <ArrowRight className="h-4.5 w-4.5" />
              </a>
              <a href={DEMO_URL} target="_blank" rel="noreferrer" className="btn-ghost inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-medium">
                Watch the demo
                <ArrowUpRight className="h-4.5 w-4.5" />
              </a>
            </div>
            <p className="mt-6 font-data text-[11px] uppercase tracking-[0.16em] text-slate-600">
              Portaldot V3 EVM · Chain 420420777 · Testnet · Read-only by default · Optional on-chain anchor · Nothing polls
            </p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">
              <span>Chain 420420777</span>
              <span>Testnet</span>
              <span>No account</span>
              <span>No wallet required</span>
              <span>Nothing polls</span>
            </div>
          </div>

          <div className="relative lg:col-span-5">
            <span aria-hidden="true" className="absolute -left-2 -top-2 font-data text-sm text-[#0181FB]">+</span>
            <span aria-hidden="true" className="absolute -right-2 -top-2 font-data text-sm text-[#0181FB]">+</span>
            <LiveReadout />
            <div className="relative z-10 mx-3 -mt-3">
              <figure className="hero-media overflow-hidden rounded-[24px] border border-line bg-panel shadow-[0_32px_90px_rgba(0,0,0,0.55),0_0_60px_rgba(1,129,251,0.12)] transition-transform duration-500 [transform:perspective(1200px)_rotateY(-6deg)_rotateX(1.5deg)] hover:[transform:perspective(1200px)_rotateY(0deg)_rotateX(0deg)]" style={{ transitionTimingFunction: 'var(--ease-out)' }}>
                <img src="/screenshots/03-snapshot-comparison.png" alt="NodeScope snapshot comparison in a real session" className="aspect-[16/9] w-full object-cover object-top" />
                <figcaption className="border-t border-line bg-black/30 px-4 py-2.5 font-data text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  The app — snapshot comparison, cropped from a real session
                </figcaption>
              </figure>
              <span aria-hidden="true" className="absolute -left-4 top-6 rounded-full border border-line bg-black/80 px-3 py-1.5 font-data text-[10px] uppercase tracking-[0.18em] text-slate-200 shadow-lg">Portaldot V3 EVM</span>
              <span aria-hidden="true" className="absolute -right-3 bottom-12 rounded-full border border-line bg-black/80 px-3 py-1.5 font-data text-[10px] uppercase tracking-[0.18em] text-slate-200 shadow-lg">Report schema v1</span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------- stats ------------------------------ */}
      <section className="border-y border-line bg-deep/60 px-4 py-14">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-4">
          {[
            { value: '420420777', label: 'Chain ID', sub: 'Portaldot V3 EVM · hex 0x190F1CA9 · returned by eth_chainId' },
            { value: '314', label: 'Tests passing', sub: '33 files · Vitest · suite verified 25 Oct 2026' },
            { value: '38', label: 'RPC methods probed', sub: '7 supported on this EVM profile · the rest answered method-not-found — reported, not hidden' },
            { value: '+12', label: 'Blocks between demo snapshots', sub: 'A 143,764 at 15:48:05 → B 143,776 at 15:49:21 WIB · 76 seconds apart' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 80}>
              <p className="font-data text-3xl font-semibold text-white md:text-4xl">{s.value}</p>
              <p className="mt-2 font-data text-[11px] uppercase tracking-[0.2em] text-slate-300">{s.label}</p>
              <p className="mt-1.5 max-w-[26ch] text-xs leading-relaxed text-slate-500">{s.sub}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ------------------------------ problem ----------------------------- */}
      <section id="problem" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title="The Problem" right="Why NodeScope exists" />
            <div className="grid gap-10 md:grid-cols-2">
              <h2 className="sr-only">A green checkmark is not evidence.</h2>
              <WordFill sentence="A green checkmark is not evidence." />
              <div className="space-y-4 text-[15px] leading-relaxed text-slate-400">
                <p>
                  Consoles and explorers tell you a node answered <span className="text-slate-200">once</span>. They
                  don&apos;t show drift, silent regressions, or whether the same check still passes an hour later —
                  and they leave you nothing you can hand to anyone as proof.
                </p>
                <p>
                  NodeScope treats every check as an observation worth keeping: timestamped, structured, and
                  comparable. When something changes, the diff says exactly what — method by method.
                </p>
                <div className="space-y-2.5 pt-2 font-data text-[13px]">
                  <p className="flex gap-3"><span className="shrink-0 text-slate-600">CONSOLE —</span> <span>&ldquo;Reachable right now.&rdquo;</span></p>
                  <p className="flex gap-3"><span className="shrink-0 font-semibold text-slate-100">NODESCOPE —</span> <span className="text-slate-200">&ldquo;Healthy at 15:48 and 15:49 — 76 seconds apart — +12 blocks, zero regressions. Here&apos;s the report.&rdquo;</span></p>
                </div>
              </div>
            </div>
            <FlowVisual />
          </Reveal>
        </div>
      </section>

      {/* -------------------------------- how ------------------------------- */}
      <section id="how" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title="How It Works" right="Three steps, no setup" />
            <div className="overflow-hidden rounded-xl border border-line">
              {[
                { n: '01', title: 'Connect & check', body: 'Point NodeScope at any Portaldot V3 EVM endpoint. A health check runs the core JSON-RPC methods and records the result as a structured snapshot.' },
                { n: '02', title: 'Snapshot', body: 'Snapshots are timestamped observations — block height, chain ID, client version, latency, per-method outcomes — stored for the session, up to 20.' },
                { n: '03', title: 'Compare & export', body: 'Pick any two snapshots — or read the whole session. NodeScope diffs snapshots deterministically, trends latency and block progression across all of them, and ends in a verdict whose rules are printed, not hidden. Everything folds into an exportable diagnostic report (schema v1) you can share — stamped with a SHA-256 integrity hash, so anyone can verify the file was not altered after export.' },
              ].map((s) => (
                <div key={s.n} className="grid gap-2 border-b border-line bg-panel px-6 py-6 last:border-b-0 md:grid-cols-12">
                  <h3 className="font-display text-lg font-semibold text-white md:col-span-4">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400 md:col-span-8">{s.body}</p>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-6 overflow-hidden rounded-xl border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line bg-black/25 px-4 py-2.5">
                <span className="font-data text-[11px] text-slate-400">nodescope — diagnostic-report.v1</span>
                <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">Trimmed sample of a real export</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-slate-400">
                <code>
                  <span className="text-slate-500">{'{'}</span>{'\n'}
                  {'  '}<span className="text-slate-100">"schema"</span><span className="text-slate-500">:</span> <span className="text-sky-300/90">"nodescope.diagnostic-report.v1"</span><span className="text-slate-500">,</span>{'\n'}
                  {'  '}<span className="text-slate-100">"endpoint"</span><span className="text-slate-500">:</span> <span className="text-sky-300/90">"https://test-evm-rpc-v3.portaldot.dev"</span><span className="text-slate-500">,</span>{'\n'}
                  {'  '}<span className="text-slate-100">"chainId"</span><span className="text-slate-500">:</span> <span className="text-sky-300/90">"0x190f1ca9 (420420777)"</span><span className="text-slate-500">,</span>{'\n'}
                  {'  '}<span className="text-slate-100">"summary"</span><span className="text-slate-500">:</span> <span className="text-slate-500">{'{ "total":'}</span> <span className="text-amber-200/90">13</span><span className="text-slate-500">, "success":</span> <span className="text-amber-200/90">13</span><span className="text-slate-500">, "errors":</span> <span className="text-amber-200/90">0</span> <span className="text-slate-500">{'}'}</span><span className="text-slate-500">,</span>{'\n'}
                  {'  '}<span className="text-slate-100">"findings"</span><span className="text-slate-500">:</span> <span className="text-slate-500">[{'{ "ruleId":'}</span> <span className="text-sky-300/90">"chain-id-verified"</span><span className="text-slate-500">, "severity":</span> <span className="text-sky-300/90">"info"</span> <span className="text-slate-500">{'}]'}</span>{'\n'}
                  <span className="text-slate-500">{'}'}</span>
                </code>
              </pre>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- instrument ---------------------------- */}
      <section id="instrument" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title="The Instrument" right="Real output, not mockups" />
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <CheckTranscript />
              {/* snapshot diff artifact */}
              <div className="overflow-hidden rounded-xl border border-line bg-panel">
                <div className="flex items-center justify-between border-b border-line bg-black/25 px-4 py-2.5">
                  <span className="font-data text-[11px] text-slate-400">&gt;_ SNAPSHOT COMPARISON — REAL OUTPUT</span>
                  <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">Demo · 22 Oct 2026</span>
                </div>
                <div className="px-5 py-5 font-data text-[12.5px] leading-[1.9]">
                  <p><span className="mr-4 text-slate-600">01</span><span className="text-slate-500"># nodescope.health-snapshot.v1 — diff A → B</span></p>
                  <p><span className="mr-4 text-slate-600">02</span><span className="text-slate-400">A · block 143,764 · 15:48:05 WIB</span></p>
                  <p><span className="mr-4 text-slate-600">03</span><span className="text-slate-400">B · block 143,776 · 15:49:21 WIB</span></p>
                  <p><span className="mr-4 text-slate-600">04</span><span className="text-slate-500">eth_chainId&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;0x190f1ca9 → 0x190f1ca9&nbsp;&nbsp;<span className="text-slate-500">UNCHANGED</span></span></p>
                  <p className="-mx-5 bg-red-400/[0.06] px-5"><span className="mr-4 text-slate-600">05</span><span className="text-red-300">− eth_blockNumber&nbsp;&nbsp;&nbsp;143,764</span></p>
                  <p className="-mx-5 bg-emerald-400/[0.07] px-5"><span className="mr-4 text-slate-600">06</span><span className="text-emerald-300">+ eth_blockNumber&nbsp;&nbsp;&nbsp;143,776&nbsp;&nbsp;Δ +12</span></p>
                  <p><span className="mr-4 text-slate-600">07</span><span className="text-slate-500">net_version&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;420420777 → 420420777&nbsp;&nbsp;UNCHANGED</span></p>
                  <p><span className="mr-4 text-slate-600">08</span><span className="text-slate-500">findings&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;0 new · 0 resolved · 0 regressions</span></p>
                </div>
                <p className="border-t border-line px-5 py-3 font-data text-[10.5px] uppercase tracking-[0.14em] text-slate-600">
                  Deterministic — same two snapshots, same diff, every time
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-6 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line bg-panel font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-5 py-3.5 font-medium">Capability</th>
                    <th className="hidden px-5 py-3.5 font-medium md:table-cell">What it does</th>
                    <th className="px-5 py-3.5 font-medium">Proof</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-panel/60 text-sm">
                  {[
                    { cap: 'Trends & verdict', what: 'Across a session of snapshots: per-method latency trends, block progression with stall and regression findings, and a deterministic verdict whose rules are printed with their evidence.', proof: 'Needs ≥2 health checks · rules shown, no score' },
                    { cap: 'Capability discovery', what: 'Probes 38 JSON-RPC methods; an unsupported answer is reported as data, never dressed up as success.', proof: '7 supported on Portaldot V3 EVM' },
                    { cap: 'RPC console', what: 'Run any method by hand — presets, custom params, and evidence badges drawn from your own run history.', proof: 'User-triggered only · nothing polls' },
                    { cap: 'Diagnostic reports', what: 'Every run folds into one shareable JSON report with categorized findings and recommendations.', proof: 'Schema nodescope.diagnostic-report.v1' },
                    { cap: 'Combined verdict', what: 'The latest EVM health snapshot and the Substrate WebSocket probe, read together in one panel — with each number shown with its own timestamp, and the two counters never subtracted from each other.', proof: 'Panel 07 in Overview · both transports, no score' },
                    { cap: 'Report verification', what: 'Exports are stamped with SHA-256 over a canonical form of the report. Anyone can drop the file back into NodeScope and check the stamp — changing any value in the file breaks it.', proof: 'Verify in History, or at /verify · no server, no account, no wallet' },
                    { cap: 'Command palette', what: '⌘K drives navigation, connection, health checks, diagnostics, and copying evidence — keyboard first.', proof: 'Press ⌘K inside the app' },
                  ].map((r) => (
                    <tr key={r.cap} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-5 py-4 font-data text-[13px] font-medium text-white">{r.cap}</td>
                      <td className="hidden max-w-md px-5 py-4 leading-relaxed text-slate-400 md:table-cell">{r.what}</td>
                      <td className="px-5 py-4 font-data text-[12px] text-slate-300">{r.proof}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- evidence ----------------------------- */}
      <section id="evidence" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title="Live Evidence" right="Observed on the real testnet" />
            <div className="rounded-xl border border-line bg-panel px-5 py-5">
              <EvidenceGrid />
              <p className="mt-3.5 font-data text-[11px] leading-relaxed text-slate-500">
                BLOCKS 147,592 → 147,639 · ONE CELL PER BLOCK · SHADE = POSITION IN RANGE · THE RANGE WAS OBSERVED
                END-TO-END IN ONE SESSION — THE CHAIN DIDN&apos;T PAUSE FOR US
              </p>
            </div>
            <div className="mt-6 overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-panel font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-5 py-3.5 font-medium">Block height</th>
                    <th className="px-5 py-3.5 font-medium">Observation</th>
                    <th className="hidden px-5 py-3.5 font-medium md:table-cell">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-panel/60 font-data text-[13px]">
                  {[
                    { block: '133,242', label: 'First recorded observation', when: 'Oct 2026' },
                    { block: '143,764', label: 'Demo Snapshot A', when: '22 Oct 2026 · 15:48 WIB' },
                    { block: '143,776', label: 'Demo Snapshot B — delta +12', when: '22 Oct 2026 · 15:49 WIB' },
                    { block: '147,639', label: 'QA session — delta +1 in 7 seconds', when: '22 Oct 2026 · 22:16 WIB' },
                  ].map((r) => (
                    <tr key={r.block} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-5 py-3.5 font-semibold text-white">{r.block}</td>
                      <td className="px-5 py-3.5 text-slate-300">{r.label}</td>
                      <td className="hidden px-5 py-3.5 text-slate-500 md:table-cell">{r.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 font-data text-[11px] leading-relaxed text-slate-600">
              Endpoint: test-evm-rpc-v3.portaldot.dev · Chain ID 420420777 · NodeScope deploys no contracts and sends
              no transactions — evidence is observed, never manufactured.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
              {SCREENSHOTS.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  onClick={() => setLightbox(i)}
                  className={`group overflow-hidden rounded-xl border border-line bg-panel text-left transition-colors hover:border-slate-500/40 ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}
                >
                  <img src={s.src} alt={s.caption} className="aspect-[16/10] w-full object-cover object-top opacity-90 transition-opacity group-hover:opacity-100" loading="lazy" />
                  <span className="block px-4 py-3 font-data text-[11px] uppercase tracking-[0.14em] text-slate-400">{s.caption}</span>
                </button>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- V3 references ------------------------------ */}
      <section id="v3" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title="Portaldot V3, as published" right="Official references, not guesses" />
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
              Portaldot V3.0 rolled out 23 Oct 2026, 23:00 UTC (24 Oct 2026, 06:00 WIB), per the
              official @PortaldotL0 and @Portaldot_Dev posts. NodeScope tags every health snapshot
              Pre-V3 or Post-V3 against that instant, so evidence from before and after the upgrade
              is never silently mixed. The testnet EVM RPC below is the endpoint NodeScope checks;
              the WebSocket node is probed separately in the app with Substrate methods.
            </p>
            <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Mainnet · Node Console', href: 'https://node-console.portaldot.dev/', note: 'Official mainnet access point' },
                { label: 'Mainnet · Block Explorer', href: 'https://scanner-live-v3.portaldot.dev/', note: 'Substrate explorer, not an EVM explorer' },
                { label: 'Mainnet · Cross-Chain Bridge', href: 'https://bridge.portaldot.dev/', note: 'Official bridge' },
                { label: 'Testnet · EVM RPC', href: 'https://test-evm-rpc-v3.portaldot.dev', note: 'Checked by NodeScope · chain 420420777' },
                { label: 'Testnet · WebSocket Node', href: 'https://x.com/Portaldot_Dev/status/2113571130527318088', note: 'Probed by NodeScope as wss://test-node-v3.portaldot.dev · endpoint list by @Portaldot_Dev' },
                { label: 'Testnet · Block Explorer', href: 'https://scanner-testnet-v3.portaldot.dev/', note: 'Substrate testnet explorer' },
              ].map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="block bg-panel/70 p-6 transition-colors hover:bg-panel">
                  <p className="font-data text-[11px] uppercase tracking-[0.16em] text-sky-300">{link.label}</p>
                  <p className="mt-2 break-all font-data text-xs text-slate-300">{link.href}</p>
                  <p className="mt-1.5 text-xs text-slate-500">{link.note}</p>
                </a>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">
              No public mainnet EVM RPC is published in those references, so NodeScope does not
              claim a mainnet EVM check. That absence is stated here on purpose.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- roadmap ------------------------------ */}
      <section id="roadmap" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title="Roadmap" right="Honestly labeled" />
            <div className="overflow-hidden rounded-xl border border-line">
              {[
                { title: 'Trends & Verdict', status: 'shipped' as const, body: 'Per-method latency trends and block progression across a whole session of snapshots, ending in a deterministic verdict — HEALTHY, DEGRADED, or UNSTABLE — with every rule that fired printed next to it. No score, no black box.' },
                { title: 'Multi-Endpoint Comparison', status: 'shipped' as const, body: 'Health snapshots from different endpoints, compared side by side — with comparability discipline: matching chain IDs earn a caveated block delta, different chains are declared not comparable instead of subtracted, and method-support and client differences surface as findings. (Not a watchlist — nothing is monitored in the background; you bring the snapshots.)' },
                { title: 'Portaldot Mainnet Profile', status: 'shipped' as const, body: 'Mainnet V3 is live since 24 Oct 2026, 06:00 WIB, but no public mainnet EVM RPC is published yet, so NodeScope does not fake a mainnet check. The Mainnet Profile page at /mainnet links the official console, explorer, and bridge and states that absence plainly, and the same snapshot and evidence engine is ready the day a mainnet RPC is published.' },
              ].map((r) => (
                <div key={r.title} className="bg-panel/70 p-6">
                  {r.status === 'shipped' ? (
                    <span className="inline-flex items-center gap-2 font-data text-[11px] uppercase tracking-[0.16em] text-emerald-300">
                      <span className="h-2 w-2 bg-emerald-400" />
                      Shipped — live in the app
                    </span>
                  ) : (
                    <span className="inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-data text-[10px] uppercase tracking-[0.16em] text-amber-300">
                      Planned — not shipped
                    </span>
                  )}
                  <h3 className="mt-4 font-display text-lg font-semibold text-white">{r.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{r.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-slate-500">
              NodeScope&apos;s whole point is evidence — so planned work is labeled planned. Nothing on this page claims to exist before it does.
            </p>
          </Reveal>
        </div>
      </section>

      {/* --------------------------- judge quickstart ------------------------ */}
      <section id="judge" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title="For judges: 60 seconds to verify" right="No account · No wallet · No setup" />
            <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
              Do not take any number on this page on trust. Every claim below is a button you can
              press yourself, in the live app, against the live testnet.
            </p>
            <div className="mt-6 overflow-hidden rounded-xl border border-line">
              {[
                { step: 'Launch the app', body: 'Open /app. The Portaldot V3 EVM endpoint is already filled in. Nothing to configure, nothing to sign.' },
                { step: 'Connect and check', body: 'Press Connect & Test, then Run Health Check. Four methods run and the result is saved as a timestamped snapshot.' },
                { step: 'Probe the second transport', body: 'In Overview, panel 06, press Probe WSS Node. Panel 07 then reads the EVM snapshot and the Substrate probe together, with each number carrying its own timestamp.' },
                { step: 'Export and verify', body: 'In History, export the diagnostic report, then drop the same file at /verify. The SHA-256 stamp covers everything except the stamp itself, so changing any value in the file breaks it.' },
                { step: 'Anchor, optionally', body: 'If a registry contract is deployed, anchor the report hash on chain with your own wallet tool, then verify the transaction in History, panel 04. Until then, the panel honestly reports that there is nothing to verify.' },
              ].map((s) => (
                <div key={s.step} className="grid gap-2 border-b border-line bg-panel px-6 py-6 last:border-b-0 md:grid-cols-12">
                  <h3 className="font-display text-lg font-semibold text-white md:col-span-4">{s.step}</h3>
                  <p className="text-sm leading-relaxed text-slate-400 md:col-span-8">{s.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">
              If any step fails, that failure is itself the result: NodeScope reports a node that did
              not answer, it does not dress it up as success.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------- CTA -------------------------------- */}
      <section className="relative overflow-hidden px-4 py-24">
        <Reveal className="relative mx-auto max-w-3xl rounded-[32px] border border-line bg-panel/70 px-8 py-16 text-center shadow-[0_32px_90px_rgba(0,0,0,0.5)]">
          <Activity className="mx-auto h-8 w-8 text-slate-500" />
          <h2 className="mt-6 font-display text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
            Put your node <span className="font-data font-medium">under the scope.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-400">
            Open the live toolkit, run a health check against the Portaldot V3 testnet, and keep the receipt.
          </p>
          <a href={APP_URL} className="btn-primary mt-9 inline-flex items-center gap-2 rounded-xl px-7 py-4 text-base font-semibold">
            Launch App
            <ArrowRight className="h-5 w-5" />
          </a>
        </Reveal>
      </section>

      {/* ------------------------------ footer ------------------------------ */}
      <footer className="border-t border-line bg-deep px-4 pb-10 pt-12">
        <div className="mx-auto max-w-6xl">
          <p className="flex flex-wrap items-center gap-2.5 font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Live · Chain 420420777 · Portaldot V3 EVM Testnet · Status: Check-in submitted
          </p>
          <div className="mt-10 grid gap-10 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="" className="h-7 w-7 rounded-lg" />
                <span className="font-display text-base font-semibold text-white">NodeScope</span>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
                The Portaldot diagnostics toolkit. Consoles interact — NodeScope proves.
              </p>
            </div>
            {[
              { h: 'Product/', links: [['Launch App', APP_URL], ['Demo video', DEMO_URL], ['GitHub', GITHUB_URL]] },
              { h: 'Resources/', links: [['DoraHacks BUIDL', BUIDL_URL], ['Repository README', `${GITHUB_URL}#readme`], ['Screenshots & docs', `${GITHUB_URL}/tree/main/docs`]] },
              { h: 'Project/', links: [['Portaldot Hacker House 2026', BUIDL_URL], ['X — @dutzozan', 'https://x.com/dutzozan'], ['Built solo by Firza Duta Fauzan', GITHUB_URL]] },
            ].map((col) => (
              <div key={col.h}>
                <p className="font-data text-[11px] uppercase tracking-[0.2em] text-slate-500">{col.h}</p>
                <ul className="mt-3.5 space-y-2.5 text-sm">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <a
                        href={href}
                        {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                        className="text-slate-400 transition-colors hover:text-white"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 font-data text-[11px] uppercase tracking-[0.14em] text-slate-600">
            <span>© 2026 NodeScope</span>
            <span>Report schema · nodescope.diagnostic-report.v1</span>
          </div>
        </div>
      </footer>

      {/* ----------------------------- lightbox ----------------------------- */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={SCREENSHOTS[lightbox].caption}
        >
          <button
            type="button"
            aria-label="Close"
            className="btn-ghost absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <figure className="max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <img src={SCREENSHOTS[lightbox].src} alt={SCREENSHOTS[lightbox].caption} className="w-full rounded-xl border border-line" />
            <figcaption className="mt-3 text-center font-data text-xs uppercase tracking-[0.16em] text-slate-400">
              {SCREENSHOTS[lightbox].caption}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
