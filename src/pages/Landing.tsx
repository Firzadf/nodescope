import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Command,
  FileJson,
  GitCompare,
  HeartPulse,
  Radar,
  Terminal,
  X,
} from 'lucide-react';

const APP_URL = '/app';
const DEMO_URL = 'https://www.youtube.com/watch?v=qne3_eZdcKA';
const GITHUB_URL = 'https://github.com/Firzadf/nodescope';
const BUIDL_URL = 'https://dorahacks.io/build/50146';

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
      style={{ transitionDelay: `${delay}ms` }}
      className={`${className} transition-all duration-700 ease-out ${inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
    >
      {children}
    </div>
  );
}

function CountUp({ target, prefix = '', className = '' }: { target: number; prefix?: string; className?: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.4);
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1400;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target]);
  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString('en-US')}
    </span>
  );
}

/* --------------------------------- pieces --------------------------------- */

function SectionHeading({ index, title, right }: { index: string; title: string; right?: string }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
      <div>
        <p className="font-data text-[11px] uppercase tracking-[0.24em] text-slate-500">
          <span className="text-gradient font-semibold">{index}</span> / {title}
        </p>
      </div>
      {right && <p className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-600">{right}</p>}
    </div>
  );
}

const TICKER_METHODS = [
  'eth_chainId',
  'eth_blockNumber',
  'net_version',
  'web3_clientVersion',
  'system_health',
  'system_chain',
  'chain_getHeader',
  'eth_gasPrice',
  'eth_syncing',
  'rpc_modules',
];

const SCREENSHOTS = [
  { src: '/screenshots/01-endpoint-config.png', caption: '01 — Endpoint configuration' },
  { src: '/screenshots/02-health-check-results.png', caption: '02 — Health check results' },
  { src: '/screenshots/03-snapshot-comparison.png', caption: '03 — Snapshot comparison' },
  { src: '/screenshots/04-findings-categorized.png', caption: '04 — Findings, categorized' },
  { src: '/screenshots/05-report-export.png', caption: '05 — Report export' },
];

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
      {/* ------------------------------- nav ------------------------------- */}
      <header className="fixed inset-x-0 top-0 z-40 px-4 pt-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-full border border-line bg-deep/85 py-2 pl-4 pr-2 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="NodeScope logo" className="h-7 w-7 rounded-lg" />
            <span className="font-display text-[17px] font-semibold tracking-tight text-white">NodeScope</span>
          </a>
          <nav className="mx-auto hidden items-center gap-7 text-sm text-slate-400 md:flex">
            <a href="#problem" className="transition-colors hover:text-white">The Problem</a>
            <a href="#how" className="transition-colors hover:text-white">How It Works</a>
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#evidence" className="transition-colors hover:text-white">Evidence</a>
            <a href="#roadmap" className="transition-colors hover:text-white">Roadmap</a>
          </nav>
          <a
            href={APP_URL}
            className="btn-primary ml-auto inline-flex items-center gap-2 rounded-full px-4.5 py-2 text-sm font-semibold md:ml-0"
          >
            Launch App
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </header>

      {/* ------------------------------- hero ------------------------------ */}
      <section className="bg-blueprint relative overflow-hidden px-4 pb-16 pt-36 md:pt-44">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(720px_300px_at_50%_0%,rgba(140,29,239,0.13),transparent_70%)]"
        />
        <div className="stagger relative mx-auto max-w-6xl">
          <p className="inline-flex items-center gap-2.5 rounded-full border border-line bg-white/[0.03] px-3.5 py-1.5 font-data text-[11px] uppercase tracking-[0.2em] text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Portaldot V3 EVM · Chain 420420777 · Testnet
          </p>
          <h1 className="mt-7 font-display text-[44px] font-semibold leading-[1.02] tracking-tight text-white md:text-7xl">
            Consoles interact.
            <br />
            NodeScope <span className="text-gradient">proves.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg">
            A read-only diagnostics toolkit for Portaldot nodes. Health checks, snapshot comparisons, and
            exportable reports that prove a node is healthy <em className="text-slate-200 not-italic underline decoration-[#0181FB]/60 underline-offset-4">over time</em> —
            not just reachable once.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3.5">
            <a href={APP_URL} className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold">
              Launch App
              <ArrowRight className="h-4.5 w-4.5" />
            </a>
            <a
              href={DEMO_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-medium"
            >
              Watch the demo
              <ArrowUpRight className="h-4.5 w-4.5" />
            </a>
            <span className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-600">Read-only · No keys · No transactions</span>
          </div>

          {/* pulse readout */}
          <div className="mt-14 overflow-hidden rounded-xl border border-line bg-panel/80">
            <div className="flex items-center justify-between border-b border-line bg-black/25 px-4 py-2">
              <span className="font-data text-[11px] text-slate-400">&gt;_ LIVE PULSE · ETH_BLOCKNUMBER</span>
              <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">[ Fig. 00 — Pulse ]</span>
            </div>
            <svg viewBox="0 0 600 64" className="h-16 w-full" role="img" aria-label="Stylized node pulse trace">
              <defs>
                <linearGradient id="ecg-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8C1DEF" />
                  <stop offset="100%" stopColor="#0181FB" />
                </linearGradient>
              </defs>
              <path
                className="ecg-path"
                d="M0 32 H168 L182 32 L192 10 L204 54 L216 32 H318 L330 20 L342 44 L352 32 H600"
                fill="none"
                stroke="url(#ecg-grad)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* ------------------------------ ticker ------------------------------ */}
      <div className="overflow-hidden border-y border-line bg-deep/70 py-3" aria-hidden="true">
        <div className="animate-marquee flex w-max items-center gap-8 whitespace-nowrap pr-8">
          {[...TICKER_METHODS, ...TICKER_METHODS].map((m, i) => (
            <span key={i} className="flex items-center gap-8 font-data text-xs uppercase tracking-[0.22em] text-slate-500">
              {m}
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-[#8C1DEF] to-[#0181FB]" />
            </span>
          ))}
        </div>
      </div>

      {/* ------------------------------- stats ------------------------------ */}
      <section className="px-4 py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
          {[
            { target: 420420777, prefix: '', label: 'Chain ID', sub: 'Portaldot V3 EVM' },
            { target: 204, prefix: '', label: 'Tests passing', sub: 'Vitest suite, all green' },
            { target: 38, prefix: '', label: 'RPC methods probed', sub: 'Capability discovery' },
            { target: 12, prefix: '+', label: 'Blocks', sub: 'Demo snapshots A → B delta' },
          ].map((s) => (
            <div key={s.label} className="bg-panel px-6 py-7">
              <CountUp target={s.target} prefix={s.prefix} className="font-data text-3xl font-semibold text-white md:text-4xl" />
              <p className="mt-2 font-data text-[11px] uppercase tracking-[0.2em] text-slate-400">{s.label}</p>
              <p className="mt-1 text-xs text-slate-500">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------ problem ----------------------------- */}
      <section id="problem" className="scroll-mt-28 px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading index="01" title="The Problem" right="Why NodeScope exists" />
            <div className="grid gap-10 md:grid-cols-2">
              <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-white md:text-[40px]">
                A green checkmark is <span className="text-gradient">not evidence.</span>
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
                  <p className="flex gap-3"><span className="text-slate-600">CONSOLE —</span> <span>&ldquo;Reachable right now.&rdquo;</span></p>
                  <p className="flex gap-3"><span className="text-gradient font-semibold">NODESCOPE —</span> <span className="text-slate-200">&ldquo;Healthy at 15:48 and 15:49, +12 blocks, zero regressions. Here&apos;s the report.&rdquo;</span></p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------- how ------------------------------- */}
      <section id="how" className="scroll-mt-28 px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading index="02" title="How It Works" right="Three steps, no setup" />
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { n: '01', title: 'Connect & check', body: 'Point NodeScope at any Portaldot V3 EVM endpoint. A health check runs the core JSON-RPC methods and records the result as a structured snapshot.' },
                { n: '02', title: 'Snapshot', body: 'Snapshots are timestamped observations — block height, chain ID, client version, latency, per-method outcomes — stored for the session, up to 20.' },
                { n: '03', title: 'Compare & export', body: 'Pick any two snapshots. NodeScope diffs them deterministically and folds everything into an exportable diagnostic report (schema v1) you can share.' },
              ].map((s) => (
                <div key={s.n} className="rounded-xl border border-line bg-panel p-6">
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

      {/* ----------------------------- features ----------------------------- */}
      <section id="features" className="scroll-mt-28 px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading index="03" title="Features" right="Shipped & verified" />
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { icon: HeartPulse, title: 'Health Check Snapshots', body: 'One click captures a full, structured health observation of the node — every core method, its outcome, latency, and observed value.', tag: 'Schema · nodescope.health-snapshot.v1', wide: true },
                { icon: GitCompare, title: 'Snapshot Comparison', body: 'Deterministic diffs between any two snapshots: block-height delta, per-method changes, new and resolved findings.', tag: 'Pure · Deterministic' },
                { icon: Radar, title: 'Capability Discovery', body: 'Probes 38 JSON-RPC methods and reports honestly which the endpoint actually supports — unsupported methods are data, not errors.', tag: '38 methods probed' },
                { icon: Terminal, title: 'RPC Console', body: 'Run any JSON-RPC method by hand, with presets, evidence badges from your own history, and full request/response inspection.', tag: 'User-triggered only' },
                { icon: FileJson, title: 'Diagnostic Reports', body: 'Every run folds into an exportable JSON report with categorized findings — the receipt you can hand to anyone.', tag: 'Schema · nodescope.diagnostic-report.v1' },
                { icon: Command, title: 'Command Palette', body: 'Press ⌘K and drive the whole toolkit from the keyboard — navigate, connect, run checks and diagnostics, copy evidence.', tag: '⌘K · Linear-style' },
              ].map((f) => (
                <div
                  key={f.title}
                  className={`group rounded-xl border border-line bg-panel p-6 transition-colors hover:border-slate-500/40 ${f.wide ? 'md:col-span-2' : ''}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-black/30">
                    <f.icon className="h-5 w-5 text-slate-300" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">{f.body}</p>
                  <p className="mt-4 font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">{f.tag}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- evidence ----------------------------- */}
      <section id="evidence" className="scroll-mt-28 px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading index="04" title="Live Evidence" right="Observed on the real testnet" />
            <div className="overflow-hidden rounded-xl border border-line">
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
                    { block: '147,639', label: 'Latest QA session — delta +1 in 7s', when: '22 Oct 2026 · 22:16 WIB' },
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
            <p className="mt-3 font-data text-[11px] text-slate-600">
              Endpoint: test-evm-rpc-v3.portaldot.dev · Chain ID 420420777 · NodeScope deploys no contracts and sends no transactions — evidence is observed, never manufactured.
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
      <section id="roadmap" className="scroll-mt-28 px-4 py-14">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading index="05" title="Roadmap" right="Honestly labeled" />
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { title: 'Trends & Verdict', body: 'Session sparkline of block height and latency across snapshots, with a plain-language health verdict per endpoint.' },
                { title: 'Multi-Endpoint Watchlist', body: 'Save several endpoints and compare their health side by side — built for operators running more than one node.' },
                { title: 'Portaldot Mainnet Profile', body: 'A first-class profile for Portaldot V3 mainnet the day it opens, reusing the same snapshot and evidence engine.' },
              ].map((r) => (
                <div key={r.title} className="rounded-xl border border-dashed border-line bg-panel/50 p-6">
                  <span className="inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-data text-[10px] uppercase tracking-[0.16em] text-amber-300">
                    Planned — not shipped
                  </span>
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
            Put your node <span className="text-gradient">under the scope.</span>
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
