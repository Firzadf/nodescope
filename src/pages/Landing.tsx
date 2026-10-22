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
      className={`reveal ${className} transition-all duration-700 ${inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
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
    <div className="overflow-hidden rounded-xl border border-line bg-panel/90 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.8)]">
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
        <defs>
          <linearGradient id="ecg-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8C1DEF" />
            <stop offset="100%" stopColor="#0181FB" />
          </linearGradient>
        </defs>
        <path
          className="ecg-path"
          d="M0 20 H180 L192 20 L200 6 L210 34 L220 20 H330 L342 12 L352 28 L360 20 H600"
          fill="none"
          stroke="url(#ecg-grad)"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/* ----------------------------- section heading ---------------------------- */

function SectionHeading({ index, title, right }: { index: string; title: string; right?: string }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
      <p className="font-data text-[11px] uppercase tracking-[0.24em] text-slate-500">
        <span className="font-semibold text-slate-200">{index}</span> / {title}
      </p>
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
                  <span className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-[#8C1DEF] to-[#0181FB]" />
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
                    className="step-progress absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-[#8C1DEF] to-[#0181FB]"
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
            <defs>
              <linearGradient id="flow-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8C1DEF" />
                <stop offset="100%" stopColor="#0181FB" />
              </linearGradient>
            </defs>
            <path pathLength={100} className="flow-draw" d="M8 22 H312" fill="none" stroke="url(#flow-grad)" strokeWidth="1.6" />
            <circle className="flow-node" style={{ transitionDelay: '150ms' }} cx="8" cy="22" r="5" fill="#0a1226" stroke="#8C1DEF" strokeWidth="1.8" />
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
      <header className="fixed inset-x-0 top-0 z-40 px-4 pt-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-full border border-line bg-deep/85 py-2 pl-4 pr-2 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md">
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
          </nav>
          <a href={APP_URL} className="btn-primary ml-auto inline-flex items-center gap-2 rounded-full px-4.5 py-2 text-sm font-semibold md:ml-0">
            Launch App
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </header>

      {/* -------------------------------- hero ------------------------------ */}
      <section className="bg-blueprint relative overflow-hidden px-4 pb-20 pt-36 md:pt-44">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(720px_300px_at_30%_0%,rgba(140,29,239,0.11),transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-12">
          <div className="stagger lg:col-span-7">
            <p className="flex items-center gap-2.5 font-data text-[11px] uppercase tracking-[0.24em] text-slate-400">
              <span className="h-2 w-2 shrink-0 bg-gradient-to-br from-[#8C1DEF] to-[#0181FB]" />
              Portaldot V3 EVM — Chain 420420777 — Testnet
            </p>
            <h1 className="mt-7 font-display text-[44px] font-semibold leading-[1.02] tracking-tight text-white md:text-7xl">
              Consoles interact.
              <br />
              NodeScope{' '}
              <span className="font-data font-medium tracking-tight">
                proves.<span className="cursor-blink text-[#0181FB]">▊</span>
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
              Read-only · No keys · No transactions · Nothing polls
            </p>
          </div>

          <div className="lg:col-span-5">
            <LiveReadout />
            <figure className="relative z-10 mx-3 -mt-3 rotate-[1.3deg] overflow-hidden rounded-xl border border-line bg-panel shadow-[0_30px_60px_-25px_rgba(0,0,0,0.85)] transition-transform duration-500 hover:rotate-0" style={{ transitionTimingFunction: 'var(--ease-out)' }}>
              <img src="/screenshots/03-snapshot-comparison.png" alt="NodeScope snapshot comparison in a real session" className="aspect-[16/9] w-full object-cover object-top" />
              <figcaption className="border-t border-line bg-black/30 px-4 py-2.5 font-data text-[10px] uppercase tracking-[0.16em] text-slate-500">
                The app — snapshot comparison, cropped from a real session
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ------------------------------- stats ------------------------------ */}
      <section className="border-y border-line bg-deep/60 px-4 py-14">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-4">
          {[
            { value: '420420777', label: 'Chain ID', sub: 'Portaldot V3 EVM · hex 0x190F1CA9 · returned by eth_chainId' },
            { value: '242', label: 'Tests passing', sub: '20 files · Vitest · suite verified 23 Oct 2026' },
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
            <SectionHeading index="01" title="The Problem" right="Why NodeScope exists" />
            <div className="grid gap-10 md:grid-cols-2">
              <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-white md:text-[40px]">
                A green checkmark is not evidence.
              </h2>
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
            <SectionHeading index="02" title="How It Works" right="Three steps, no setup" />
            <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
              {[
                { n: '01', title: 'Connect & check', body: 'Point NodeScope at any Portaldot V3 EVM endpoint. A health check runs the core JSON-RPC methods and records the result as a structured snapshot.' },
                { n: '02', title: 'Snapshot', body: 'Snapshots are timestamped observations — block height, chain ID, client version, latency, per-method outcomes — stored for the session, up to 20.' },
                { n: '03', title: 'Compare & export', body: 'Pick any two snapshots — or read the whole session. NodeScope diffs snapshots deterministically, trends latency and block progression across all of them, and ends in a verdict whose rules are printed, not hidden. Everything folds into an exportable diagnostic report (schema v1) you can share.' },
              ].map((s) => (
                <div key={s.n} className="bg-panel p-6">
                  <p className="font-data text-sm text-slate-500">{s.n}</p>
                  <h3 className="mt-3 font-display text-lg font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
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
            <SectionHeading index="03" title="The Instrument" right="Real output, not mockups" />
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
            <SectionHeading index="04" title="Live Evidence" right="Observed on the real testnet" />
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

      {/* ----------------------------- roadmap ------------------------------ */}
      <section id="roadmap" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading index="05" title="Roadmap" right="Honestly labeled" />
            <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
              {[
                { title: 'Trends & Verdict', status: 'shipped' as const, body: 'Per-method latency trends and block progression across a whole session of snapshots, ending in a deterministic verdict — HEALTHY, DEGRADED, or UNSTABLE — with every rule that fired printed next to it. No score, no black box.' },
                { title: 'Multi-Endpoint Watchlist', status: 'planned' as const, body: 'Save several endpoints and compare their health side by side — built for operators running more than one node.' },
                { title: 'Portaldot Mainnet Profile', status: 'planned' as const, body: 'A first-class profile for Portaldot V3 mainnet the day it opens, reusing the same snapshot and evidence engine.' },
              ].map((r) => (
                <div key={r.title} className="bg-panel/70 p-6">
                  {r.status === 'shipped' ? (
                    <span className="inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-data text-[10px] uppercase tracking-[0.16em] text-emerald-300">
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

      {/* ------------------------------- CTA -------------------------------- */}
      <section className="relative overflow-hidden px-4 py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[380px] bg-[radial-gradient(680px_280px_at_50%_100%,rgba(1,129,251,0.12),transparent_70%)]"
        />
        <Reveal className="relative mx-auto max-w-3xl text-center">
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
