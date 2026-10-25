import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowRight, ArrowUpRight, Pause, Play, X } from 'lucide-react';
import { sendJsonRpcRequest } from '../services/rpcClient';
import { BackToTop } from '../components/BackToTop';
import { IntroSplash } from '../components/common/IntroSplash';
import { DEFAULT_PORTALDOT_V3_EVM_RPC } from '../types/endpoint';
import { landingCopy, readStoredLang, storeLang, type Lang } from '../utils/landingLang';
import {
  ANCHOR_BLOCK,
  ANCHOR_TX,
  ANCHORED_REPORT_EXPORTED_AT,
  ANCHORED_REPORT_HASH,
  ANCHORED_REPORT_RECORDS,
  PORTALDOT_CHAIN_ID,
  REGISTRY_CONTRACT,
} from '../utils/siteConstants';

const APP_URL = '/app';
const DEMO_URL = 'https://www.youtube.com/watch?v=qne3_eZdcKA';
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

function LiveReadout({ lang }: { lang: Lang }) {
  const lr = landingCopy[lang];
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
        <span className="font-data text-[11px] text-slate-400">{lr.liveReadoutHeader}</span>
      </div>
      <div className="px-5 py-5">
        <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">{lr.liveReadoutLatest}</p>
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
                {' · '}{lr.liveReadoutAt}{' '}
                <span className="text-slate-100">
                  {state.at.toLocaleTimeString('en-GB', { hour12: false })} WIB
                </span>
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

function SectionHeading({ title, right, accent = 'blue' }: { title: string; right?: string; accent?: 'blue' | 'sky' | 'emerald' }) {
  const border = accent === 'emerald' ? 'border-emerald-500/30' : accent === 'sky' ? 'border-sky-500/30' : 'border-[#0181FB]/30';
  const label = accent === 'emerald' ? 'text-emerald-400/80' : accent === 'sky' ? 'text-sky-300/80' : 'text-slate-600';
  return (
    <div className={`mb-10 flex flex-wrap items-end justify-between gap-3 border-b ${border} pb-5`}>
      <p className="font-display text-2xl font-semibold tracking-tight text-white">{title}</p>
      {right && <p className={`font-data text-[11px] uppercase tracking-[0.18em] ${label}`}>{right}</p>}
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
    <div className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line bg-black/25 px-4 py-2.5">
        <span className="font-data text-[11px] text-slate-400">{ct.transcriptHeader}</span>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? ct.transcriptPause : ct.transcriptPlay}
          className="btn-ghost flex h-7 w-7 items-center justify-center rounded-full"
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
                  i === active ? 'bg-white/[0.045]' : 'hover:bg-white/[0.02]'
                }`}
              >
                {i === active && (
                  <span className="absolute left-0 top-0 h-full w-[3px] bg-[#0181FB]" />
                )}
                <span className="font-data text-xs text-slate-600">{String(i + 1).padStart(2, '0')}</span>
                <span className={`font-data text-sm ${i === active ? 'text-white' : 'text-slate-400'}`}>{s.method}</span>
                <span className={`ml-auto font-data text-xs ${i < active || !playing ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {i === active && playing ? ct.transcriptRunning : ct.transcriptPass}
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
            <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">{ct.transcriptObserved}</p>
            <p className="mt-2 font-data text-lg leading-snug text-white">{step.observed}</p>
            <p className="mt-4 font-data text-[11.5px] text-slate-400">
              {ct.transcriptLatency} <span className="text-slate-100">{step.latency} MS</span> · {ct.transcriptOutcome}{' '}
              <span className="text-emerald-400">{ct.transcriptSuccess}</span>
            </p>
            <p className="mt-5 border-t border-line pt-3.5 text-[13px] leading-relaxed text-slate-500">
              {ct.transcriptNote}
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
function FlowVisual({ lang }: { lang: Lang }) {
  const fv = landingCopy[lang];
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className={`mt-12 overflow-hidden rounded-xl border border-line bg-panel ${inView ? 'flow-in' : ''}`}>
      <div className="flex items-center justify-between border-b border-line bg-black/25 px-4 py-2.5">
        <span className="font-data text-[11px] text-slate-400">{fv.flowHeader}</span>
        <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">{fv.flowRight}</span>
      </div>
      <div className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
        {/* Console lane: one call, one answer, nothing kept. */}
        <div className="px-5 py-5">
          <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">{fv.flowConsoleLane}</p>
          <svg viewBox="0 0 320 44" className="mt-4 w-full" aria-hidden="true">
            <path pathLength={100} className="flow-draw" d="M8 22 H104" fill="none" stroke="#64748b" strokeWidth="1.6" />
            <line x1="128" y1="22" x2="312" y2="22" stroke="#475569" strokeWidth="1.2" strokeDasharray="3 6" opacity="0.5" />
            <circle className="flow-node" style={{ transitionDelay: '500ms' }} cx="116" cy="22" r="5" fill="#0a1226" stroke="#94a3b8" strokeWidth="1.6" />
          </svg>
          <p className="mt-3 font-data text-[12.5px] leading-relaxed text-slate-400">
            eth_blockNumber → <span className="text-slate-200">143,764</span>
            <span className="text-slate-600">{fv.flowConsoleBody}</span>
          </p>
        </div>
        {/* NodeScope lane: same call, kept twice, diffed, exported. */}
        <div className="px-5 py-5">
          <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-300">{fv.flowNodescopeLane}</p>
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
            <span className="text-emerald-400">{fv.flowDelta}</span>
            <span className="text-slate-300">{fv.flowReportExported}</span>
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
            {fv.flowNodescopeBody}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ evidence grid ----------------------------- */

function EvidenceGrid({ lang }: { lang: Lang }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);
  return (
    <div
      ref={ref}
      className={`grid grid-cols-12 gap-1.5 ${inView ? 'cells-in' : ''}`}
      role="img"
      aria-label={landingCopy[lang].evidenceGridAria}
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
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px] bg-black/40">
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
      // Words finish lighting once the heading's center reaches mid-viewport:
      // a fixed 35%-of-viewport scroll window, so a tall heading no longer
      // needs to be scrolled far past before its last word clears.
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
  { t: '"nodescope.diagnostic-report.v1"', c: "text-sky-300/90" },
  { t: ",", c: "text-slate-500" },
  { t: "\n  ", c: "" },
  { t: '"endpoint"', c: "text-slate-100" },
  { t: ": ", c: "text-slate-500" },
  { t: '"https://test-evm-rpc-v3.portaldot.dev"', c: "text-sky-300/90" },
  { t: ",", c: "text-slate-500" },
  { t: "\n  ", c: "" },
  { t: '"chainId"', c: "text-slate-100" },
  { t: ": ", c: "text-slate-500" },
  { t: '"0x190f1ca9 (420420777)"', c: "text-sky-300/90" },
  { t: ",", c: "text-slate-500" },
  { t: "\n  ", c: "" },
  { t: '"summary"', c: "text-slate-100" },
  { t: ": ", c: "text-slate-500" },
  { t: '{ "total":', c: "text-slate-500" },
  { t: " 13", c: "text-amber-200/90" },
  { t: ', "success":', c: "text-slate-500" },
  { t: " 13", c: "text-amber-200/90" },
  { t: ', "errors":', c: "text-slate-500" },
  { t: " 0 ", c: "text-amber-200/90" },
  { t: "}", c: "text-slate-500" },
  { t: ",", c: "text-slate-500" },
  { t: "\n  ", c: "" },
  { t: '"findings"', c: "text-slate-100" },
  { t: ": ", c: "text-slate-500" },
  { t: '[{ "ruleId":', c: "text-slate-500" },
  { t: ' "chain-id-verified"', c: "text-sky-300/90" },
  { t: ', "severity":', c: "text-slate-500" },
  { t: ' "info" ', c: "text-sky-300/90" },
  { t: "}]", c: "text-slate-500" },
  { t: "\n", c: "" },
  { t: "}", c: "text-slate-500" },
];
const JSON_TOTAL = JSON_TOKENS.reduce((a, tok) => a + tok.t.length, 0);
const JSON_PLAIN = JSON_TOKENS.map((tok) => tok.t).join("");

function TypewriterJson({ replayLabel }: { replayLabel: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const [count, setCount] = useState(0);
  const [run, setRun] = useState(0);
  const done = count >= JSON_TOTAL;
  useEffect(() => {
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(JSON_TOTAL);
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
          {inView && !done ? <span className="animate-pulse text-sky-300">▍</span> : null}
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
            className="font-data text-[11px] uppercase tracking-[0.16em] text-sky-300 hover:text-sky-200"
          >
            ↻ {replayLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ packet flow -------------------------------- */

/**
 * Packet flow: three dots travelling from YOU to NODE to RECEIPT along one
 * line, labelled with real method names. Pure decoration: it carries no live
 * data, no block height, and no result, and the caption says so.
 */
function PacketFlow({ lang }: { lang: Lang }) {
  const pk = landingCopy[lang];
  return (
    <div aria-hidden="true" className="mb-6 overflow-hidden rounded-[20px] border border-line bg-panel/70 px-6 py-5">
      <svg viewBox="0 0 600 60" preserveAspectRatio="none" className="h-[60px] w-full">
        <path d="M 20 30 H 580" fill="none" stroke="#1e293b" strokeWidth="1" />
        <circle r="3" fill="#0181FB">
          <animateMotion dur="6s" repeatCount="indefinite" path="M 20 30 H 580" />
        </circle>
        <circle r="3" fill="#38bdf8">
          <animateMotion dur="8s" begin="1s" repeatCount="indefinite" path="M 20 30 H 580" />
        </circle>
        <circle r="3" fill="#34d399">
          <animateMotion dur="10s" begin="2s" repeatCount="indefinite" path="M 20 30 H 580" />
        </circle>
      </svg>
      <div className="flex justify-between font-data text-[10px] uppercase tracking-[0.2em] text-slate-500">
        <span>{pk.packetYou}</span>
        <span className="text-slate-400">eth_chainId · eth_blockNumber · net_version</span>
        <span>{pk.packetReceipt}</span>
      </div>
      <p className="mt-2 text-center font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">
        {pk.packetNote}
      </p>
    </div>
  );
}


/* --------------------------- full background ------------------------------- */

/**
 * Full-page background animation, built from cheap parts:
 * radial-gradient glow orbs (no filter blur, so moving them is just
 * compositing), two SVG ribbon paths drifting on transform, and one light
 * streak sweeping across. A rAF-throttled scroll listener only shifts the
 * ribbon layer for parallax, it never polls and never fetches anything.
 * It is decoration only, carries no data, and sits behind all content.
 */
function FullBackground() {
  const [scroll, setScroll] = useState(0);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScroll(window.scrollY);
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div aria-hidden="true" className="ribbon-bg pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="ribbon-orb absolute -left-40 top-[10%] h-[560px] w-[560px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(1, 129, 251, 0.16), transparent 70%)' }}
      />
      <div
        className="ribbon-orb ribbon-orb-2 absolute -right-48 top-[45%] h-[640px] w-[640px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12), transparent 70%)' }}
      />
      <div
        className="ribbon-orb ribbon-orb-3 absolute left-[30%] top-[80%] h-[520px] w-[520px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(30, 50, 90, 0.35), transparent 70%)' }}
      />
      <div className="absolute inset-x-0 top-[18%]" style={{ transform: `translateY(${scroll * 0.08}px)` }}>
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="ribbon-path h-[320px] w-[110%] -translate-x-[5%]">
          <defs>
            <linearGradient id="ribbonGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0181FB" stopOpacity="0" />
              <stop offset="50%" stopColor="#0181FB" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M -100 160 Q 240 40 480 160 T 960 160 T 1540 160" fill="none" stroke="url(#ribbonGrad)" strokeWidth="1.5" />
          <path d="M -100 210 Q 240 90 480 210 T 960 210 T 1540 210" fill="none" stroke="url(#ribbonGrad)" strokeWidth="1" strokeOpacity="0.5" />
        </svg>
      </div>
      <div className="ribbon-streak absolute left-0 top-[62%] h-[2px] w-1/3 bg-gradient-to-r from-transparent via-[#0181FB]/70 to-transparent" />
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

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  return (
    <div className="landing-root min-h-screen bg-ink font-sans text-slate-200 antialiased selection:bg-[#8C1DEF]/40 selection:text-white">
      <IntroSplash scope="landing" />
      {/* Scroll progress lives here, as a direct child of the root: every
          section below is position:relative + z-index:1, which traps any
          fixed element rendered inside it — that is how the bar used to
          disappear behind later sections while scrolling. At z-[100] it
          stays above the nav (z-40), modals (z-50), and every section. */}
      <ScrollProgress />
      <FullBackground />
      {/* -------------------------------- nav ------------------------------- */}
      <header className="fixed inset-x-0 top-0 z-40 px-4 pt-3">
        <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-[20px] border border-line bg-ink/80 px-4 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="NodeScope logo" className="h-7 w-7 rounded-lg shadow-[0_0_20px_rgba(1,129,251,0.35)] ring-1 ring-[#0181FB]/40" />
            <span className="font-display text-[17px] font-semibold tracking-tight text-white">
              Node<span className="text-[#0181FB]">Scope</span>
            </span>
          </a>
          <nav className="mx-auto hidden items-center gap-7 text-sm text-slate-400 md:flex">
            {t.nav.map(({ href, label }) => (
              <a key={href} href={href} className="group relative transition-colors hover:text-white">
                {label}
                <span aria-hidden="true" className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-[#0181FB] transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
          </nav>
          <span className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-black/30 p-1" role="group" aria-label="Language">
            {(['en', 'id'] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                aria-label={l === 'en' ? 'English' : 'Bahasa Indonesia'}
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className={`rounded-full px-2.5 py-1 font-data text-[10px] uppercase tracking-[0.14em] transition-colors ${lang === l ? 'bg-[#0181FB] text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </span>
          <span className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-data text-[10px] uppercase tracking-[0.18em] text-emerald-300 lg:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            V3 Testnet
          </span>
          <a href={APP_URL} className="btn-primary ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold md:ml-0">
            {t.launchApp}
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </header>

      {/* -------------------------------- hero ------------------------------ */}
      <section className="relative overflow-hidden px-4 pb-24 pt-32 md:pt-40">
        <HudArc />
        <div aria-hidden="true" className="pointer-events-none absolute -top-32 right-[-10%] h-[480px] w-[480px] rounded-full bg-[#0181FB]/[0.14] blur-[120px]" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-[-10%] h-[360px] w-[360px] rounded-full bg-[#0181FB]/[0.08] blur-[100px]" />
        <div className="relative mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-12">
          <div className="stagger lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-black/30 px-3 py-1.5 font-data text-[10px] uppercase tracking-[0.22em] text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0181FB]" />
              {t.heroPill}
            </p>
            <h1 className="mt-7 font-display text-[52px] font-semibold leading-[0.98] tracking-tight text-white md:text-[88px]">
              {t.heroLine1}
              <br />
              NodeScope{' '}
              <span className="font-data font-medium tracking-tight text-[#0181FB]" style={{ textShadow: '0 0 32px rgba(1, 129, 251, 0.45)' }}>
                {t.heroAccent}<span className="cursor-blink">▊</span>
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 md:text-lg">
              {t.heroParagraph}
              <span className="text-slate-100">{t.heroParagraphEmphasis}</span>{t.heroParagraphTail}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <a href={APP_URL} className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold">
                {t.launchApp}
                <ArrowRight className="h-4.5 w-4.5" />
              </a>
              <a href={DEMO_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2 py-3.5 text-[15px] font-medium text-slate-300 underline decoration-slate-600 underline-offset-4 transition-colors hover:text-white">
                {t.watchDemo}
                <ArrowUpRight className="h-4.5 w-4.5" />
              </a>
            </div>
            <p className="mt-6 font-data text-[11px] uppercase tracking-[0.16em] text-slate-600">
              {t.heroFactLine}
            </p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">
              {t.heroMeta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
          </div>

          <div className="stagger relative lg:col-span-5">
            <span aria-hidden="true" className="absolute -left-2 -top-2 font-data text-sm text-[#0181FB]">+</span>
            <span aria-hidden="true" className="absolute -right-2 -top-2 font-data text-sm text-[#0181FB]">+</span>
            <LiveReadout lang={lang} />
            <div className="relative z-10 mx-3 -mt-3">
              <figure className="hero-media relative overflow-hidden rounded-[24px] border border-line bg-panel shadow-[0_32px_90px_rgba(0,0,0,0.55),0_0_60px_rgba(1,129,251,0.12)] transition-transform duration-500 [transform:perspective(1200px)_rotateY(-6deg)_rotateX(1.5deg)] hover:[transform:perspective(1200px)_rotateY(0deg)_rotateX(0deg)]" style={{ transitionTimingFunction: 'var(--ease-out)' }}>
                <img src="/screenshots/03-snapshot-comparison.png" alt={t.heroFigureCaption} className="aspect-[16/9] w-full object-cover object-top" />
                <div aria-hidden="true" className="scan-line pointer-events-none absolute inset-x-0 top-0 z-20 h-20" />
                <figcaption className="border-t border-line bg-black/30 px-4 py-2.5 font-data text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  {t.heroFigureCaption}
                </figcaption>
              </figure>
              <span aria-hidden="true" className="absolute -left-4 top-6 rounded-full border border-line bg-black/80 px-3 py-1.5 font-data text-[10px] uppercase tracking-[0.18em] text-slate-200 shadow-lg">{t.heroChipEvm}</span>
              <span aria-hidden="true" className="absolute -right-3 bottom-12 rounded-full border border-line bg-black/80 px-3 py-1.5 font-data text-[10px] uppercase tracking-[0.18em] text-slate-200 shadow-lg">{t.heroChipSchema}</span>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- announcement banner ----------------------- */}
      <div className="border-y border-line bg-black/30 px-4 py-3">
        <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          {t.banner}
        </p>
      </div>

      {/* ------------------------------- stats ------------------------------ */}
      <section className="border-y border-line bg-deep/60 px-4 py-14">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-10 lg:grid-cols-4">
          {t.stats.map((s, i) => (
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
            <SectionHeading title={t.problemTitle} right={t.problemRight} />
            <div className="grid gap-10 md:grid-cols-2">
              <h2 className="sr-only">{t.problemStatement}</h2>
              <WordFill sentence={t.problemStatement} />
              <div className="space-y-4 text-base leading-[1.85] text-slate-400">
                <p>
                  {t.problemPara1a}<span className="text-slate-200">{t.problemPara1Emphasis}</span>{t.problemPara1b}
                </p>
                <p>
                  {t.problemPara2}
                </p>
                <div className="space-y-2.5 pt-2 font-data text-[13px]">
                  <p className="flex gap-3"><span className="shrink-0 text-slate-600">{t.consoleLabel}</span> <span>{t.consoleQuote}</span></p>
                  <p className="flex gap-3"><span className="shrink-0 font-semibold text-slate-100">{t.nodescopeLabel}</span> <span className="text-slate-200">{t.nodescopeQuote}</span></p>
                </div>
              </div>
            </div>
            <div className="mt-10 rounded-xl border border-line bg-panel p-6">
              <h3 className="font-display text-lg font-semibold text-white">{t.whyTitle}</h3>
              <ul className="mt-3 space-y-2.5">
                {t.whyItems.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] leading-[1.85] text-slate-400">
                    <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0181FB]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <FlowVisual lang={lang} />
          </Reveal>
        </div>
      </section>

      {/* -------------------------------- how ------------------------------- */}
      <section id="how" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title={t.howTitle} right={t.howRight} />
            <PacketFlow lang={lang} />
            <div className="overflow-hidden rounded-xl border border-line">
              {t.howSteps.map((s) => (
                <div key={s.title} className="grid gap-2 border-b border-line bg-panel px-6 py-6 last:border-b-0 md:grid-cols-12">
                  <h3 className="font-display text-lg font-semibold text-white md:col-span-4">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400 md:col-span-8">{s.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-line bg-panel p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-lg font-semibold text-white">{t.archTitle}</h3>
                <span className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">{t.archRight}</span>
              </div>
              <ol className="mt-4">
                {t.archNodes.map((node, i) => (
                  <li key={node} className="flex gap-3">
                    <span className="flex flex-col items-center">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#0181FB]/50 bg-[#0181FB]/10 font-data text-[11px] text-[#7DB4FF]">{i + 1}</span>
                      {i < t.archNodes.length - 1 && <span aria-hidden="true" className="w-px flex-1 bg-line" />}
                    </span>
                    <span className="pb-4 text-sm leading-relaxed text-slate-300">{node}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="mt-6 overflow-hidden rounded-xl border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line bg-black/25 px-4 py-2.5">
                <span className="font-data text-[11px] text-slate-400">{t.reportSampleLabel}</span>
                <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">{t.reportSampleRight}</span>
              </div>
              <TypewriterJson replayLabel={t.typeReplay} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------ tutorial ------------------------------ */}
      <section id="tutorial" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title={t.tutorialTitle} right={t.tutorialRight} />
            <p className="max-w-3xl text-[15px] leading-[1.85] text-slate-400">
              {t.tutorialIntro}
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {t.tutorialSteps.map((s) => (
                <div key={s.n} className="rounded-[20px] border border-line bg-panel/70 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-slate-500/40">
                  <p className="font-data text-[11px] uppercase tracking-[0.2em] text-[#0181FB]">{s.n}</p>
                  <h3 className="mt-3 font-display text-lg font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.85] text-slate-400">{s.body}</p>
                </div>
              ))}
              <div className="flex flex-col justify-center rounded-[20px] border border-[#0181FB]/40 bg-[#0181FB]/10 p-6">
                <p className="font-display text-lg font-semibold text-white">{t.tutorialCtaTitle}</p>
                <p className="mt-2 text-[15px] leading-[1.85] text-slate-300">
                  {t.tutorialCtaBody}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a href={APP_URL} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold">
                    {t.tutorialCtaPrimary}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a href="/verify" className="btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium">
                    {t.tutorialCtaSecondary}
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- instrument ---------------------------- */}
      <section id="instrument" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title={t.instrumentTitle} right={t.instrumentRight} />
            <div className="grid items-start gap-6 lg:grid-cols-2">
              <CheckTranscript lang={lang} />
              {/* snapshot diff artifact */}
              <div className="overflow-hidden rounded-xl border border-line bg-panel">
                <div className="flex items-center justify-between border-b border-line bg-black/25 px-4 py-2.5">
                  <span className="font-data text-[11px] text-slate-400">{t.diffHeader}</span>
                  <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">{t.diffRight}</span>
                </div>
                <div className="px-5 py-5 font-data text-[12.5px] leading-[1.9]">
                  <p><span className="mr-4 text-slate-600">01</span><span className="text-slate-500"># nodescope.health-snapshot.v1 — diff A → B</span></p>
                  <p><span className="mr-4 text-slate-600">02</span><span className="text-slate-400">A · block 143,764 · 15:48:05 WIB</span></p>
                  <p><span className="mr-4 text-slate-600">03</span><span className="text-slate-400">B · block 143,776 · 15:49:21 WIB</span></p>
                  <p><span className="mr-4 text-slate-600">04</span><span className="text-slate-500">eth_chainId&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;0x190f1ca9 → 0x190f1ca9&nbsp;&nbsp;<span className="text-slate-500">{t.diffUnchanged}</span></span></p>
                  <p className="-mx-5 bg-red-400/[0.06] px-5"><span className="mr-4 text-slate-600">05</span><span className="text-red-300">− eth_blockNumber&nbsp;&nbsp;&nbsp;143,764</span></p>
                  <p className="-mx-5 bg-emerald-400/[0.07] px-5"><span className="mr-4 text-slate-600">06</span><span className="text-emerald-300">+ eth_blockNumber&nbsp;&nbsp;&nbsp;143,776&nbsp;&nbsp;Δ +12</span></p>
                  <p><span className="mr-4 text-slate-600">07</span><span className="text-slate-500">net_version&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;420420777 → 420420777&nbsp;&nbsp;{t.diffUnchanged}</span></p>
                  <p><span className="mr-4 text-slate-600">08</span><span className="text-slate-500">findings&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{t.diffFindings}</span></p>
                </div>
                <p className="border-t border-line px-5 py-3 font-data text-[10.5px] uppercase tracking-[0.14em] text-slate-600">
                  {t.diffFooter}
                </p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-6 hidden overflow-hidden rounded-[20px] border border-sky-500/25 shadow-[0_24px_60px_rgba(0,0,0,0.4)] md:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-sky-500/25 bg-sky-500/[0.06] font-data text-[11px] uppercase tracking-[0.18em] text-sky-300">
                    <th className="px-5 py-3.5 font-medium">{t.capabilityHeaders[0]}</th>
                    <th className="hidden px-5 py-3.5 font-medium md:table-cell">{t.capabilityHeaders[1]}</th>
                    <th className="px-5 py-3.5 font-medium">{t.capabilityHeaders[2]}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-panel/60 text-sm">
                  {t.capabilities.map((r, i) => (
                    <tr key={r.cap} className="group transition-colors hover:bg-white/[0.03]">
                      <td className="relative px-5 py-4 font-data text-[13px] font-medium text-white">
                        <span aria-hidden="true" className="absolute left-0 top-0 h-full w-[3px] bg-[#0181FB] opacity-0 transition-opacity group-hover:opacity-100" />
                        <span className="mr-3 text-slate-600">0{i + 1}</span>
                        {r.cap}
                      </td>
                      <td className="hidden max-w-md px-5 py-4 leading-relaxed text-slate-400 md:table-cell">{r.what}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-1 font-data text-[11px] ${
                            r.tone === 'emerald'
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : r.tone === 'amber'
                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                : r.tone === 'sky'
                                  ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                                  : 'border-line bg-white/[0.03] text-slate-300'
                          }`}
                        >
                          {r.proof}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 space-y-3 md:hidden">
              {t.capabilities.map((r, i) => (
                <div key={r.cap} className="rounded-xl border border-line bg-panel p-4">
                  <p className="font-data text-[13px] font-medium text-white">
                    <span className="mr-3 text-slate-600">0{i + 1}</span>
                    {r.cap}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{r.what}</p>
                  <span
                    className={`mt-2 inline-block rounded-full border px-2.5 py-1 font-data text-[11px] ${
                      r.tone === 'emerald'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : r.tone === 'amber'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : r.tone === 'sky'
                            ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                            : 'border-line bg-white/[0.03] text-slate-300'
                    }`}
                  >
                    {r.proof}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- evidence ----------------------------- */}
      <section id="evidence" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title={t.evidenceTitle} right={t.evidenceRight} accent="emerald" />
            <div className="rounded-xl border border-line bg-panel px-5 py-5">
              <EvidenceGrid lang={lang} />
              <p className="mt-3.5 font-data text-[11px] leading-relaxed text-slate-500">
                {t.evidenceGridCaption}
              </p>
            </div>
            <div className="mt-6 hidden overflow-hidden rounded-[20px] border border-emerald-500/25 shadow-[0_24px_60px_rgba(0,0,0,0.4)] md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-emerald-500/25 bg-emerald-500/[0.06] font-data text-[11px] uppercase tracking-[0.18em] text-emerald-300">
                    <th className="px-5 py-3.5 font-medium">{t.evidenceHeaders[0]}</th>
                    <th className="px-5 py-3.5 font-medium">{t.evidenceHeaders[1]}</th>
                    <th className="hidden px-5 py-3.5 font-medium md:table-cell">{t.evidenceHeaders[2]}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-panel/60 font-data text-[13px]">
                  {t.evidenceRows.map((r) => (
                    <tr key={r.block} className="group transition-colors hover:bg-white/[0.03]">
                      <td className="relative px-5 py-3.5 font-semibold text-white">
                        <span aria-hidden="true" className="absolute left-0 top-0 h-full w-[3px] bg-emerald-400 opacity-0 transition-opacity group-hover:opacity-100" />
                        {r.block}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {r.label}
                        {'delta' in r && r.delta ? (
                          <span className="ml-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                            Δ {r.delta}
                          </span>
                        ) : null}
                      </td>
                      <td className="hidden px-5 py-3.5 text-slate-500 md:table-cell">{r.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 space-y-3 md:hidden">
              {t.evidenceRows.map((r) => (
                <div key={r.block} className="rounded-xl border border-line bg-panel p-4 font-data text-[13px]">
                  <p className="font-semibold text-white">{r.block}</p>
                  <p className="mt-1 text-slate-300">
                    {r.label}
                    {'delta' in r && r.delta ? (
                      <span className="ml-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                        Δ {r.delta}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-slate-500">{r.when}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 font-data text-[11px] leading-relaxed text-slate-600">
              {t.evidenceFootnote}
            </p>
            <figure className="mt-8 overflow-hidden rounded-[20px] border border-line bg-panel shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
              <video
                className="motion-video aspect-[16/10] w-full"
                src="/motion/nodescope-flow.mp4"
                poster="/screenshots/01-endpoint-config.png"
                autoPlay
                muted
                loop
                playsInline
                aria-label={t.motionCaption}
              />
              <img
                src="/screenshots/01-endpoint-config.png"
                alt={t.motionCaption}
                className="motion-poster aspect-[16/10] w-full object-cover object-top"
              />
              <figcaption className="px-5 py-3.5">
                <p className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-300">{t.motionCaption}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{t.motionNote}</p>
              </figcaption>
            </figure>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
              {t.screenshots.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  onClick={() => setLightbox(i)}
                  className={`group relative overflow-hidden rounded-[21px] bg-gradient-to-br from-[#0181FB]/60 via-slate-500/20 to-transparent p-px text-left shadow-[0_20px_50px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(0,0,0,0.5)] ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}
                >
                  <span className="block rounded-[20px] bg-panel">
                    <span className="flex items-center gap-1.5 border-b border-line bg-black/30 px-4 py-2.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#0181FB]" />
                      <span className="ml-2 font-data text-[10px] uppercase tracking-[0.16em] text-slate-600">{t.galleryLabel}</span>
                    </span>
                    <span className="relative block overflow-hidden">
                      <img src={s.src} alt={s.caption} className="aspect-[16/10] w-full object-cover object-top opacity-90 transition-all duration-500 group-hover:scale-[1.04] group-hover:opacity-100" loading="lazy" />
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    </span>
                    <span className="flex items-center justify-between px-4 py-3 font-data text-[11px] uppercase tracking-[0.14em] text-slate-400">
                      {s.caption}
                      <span aria-hidden="true" className="opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">↗</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* --------------------------- on-chain evidence --------------------------- */}
      <section id="onchain" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title={t.onchainTitle} right={t.onchainRight} accent="emerald" />
            <p className="max-w-3xl text-[15px] leading-[1.85] text-slate-400">{t.onchainIntro}</p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-line bg-panel p-4">
                <p className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-500">Registry contract</p>
                <p className="mt-2 break-all font-data text-[13px] text-slate-200">{REGISTRY_CONTRACT}</p>
                <p className="mt-1 text-xs text-slate-500">Portaldot V3 testnet · chain {PORTALDOT_CHAIN_ID}</p>
              </div>
              <div className="rounded-xl border border-line bg-panel p-4">
                <p className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-500">Anchor transaction</p>
                <p className="mt-2 break-all font-data text-[13px] text-slate-200">{ANCHOR_TX}</p>
                <p className="mt-1 text-xs text-slate-500">Anchor block {ANCHOR_BLOCK} · receipt status success</p>
              </div>
              <div className="rounded-xl border border-line bg-panel p-4">
                <p className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-500">Anchored report hash</p>
                <p className="mt-2 break-all font-data text-[13px] text-slate-200">{ANCHORED_REPORT_HASH}</p>
                <p className="mt-1 text-xs text-slate-500">Exported {ANCHORED_REPORT_EXPORTED_AT} · {ANCHORED_REPORT_RECORDS} records</p>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-line bg-panel p-6">
              <h3 className="font-display text-lg font-semibold text-white">{t.onchainCheckTitle}</h3>
              <ol className="mt-3 space-y-2.5">
                {t.onchainCheckSteps.map((s, i) => (
                  <li key={s} className="flex gap-3 text-[15px] leading-[1.85] text-slate-400">
                    <span className="font-data text-slate-500">0{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <a
                href={`/verify?hash=${ANCHORED_REPORT_HASH}&contract=${REGISTRY_CONTRACT}&tx=${ANCHOR_TX}`}
                className="mt-4 inline-block rounded-lg bg-[#0181FB] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Verify this anchor on /verify
              </a>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">{t.onchainVerifyNote}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------ who uses ------------------------------ */}
      <section id="who" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title={t.whoTitle} right={t.whoRight} />
            <div className="grid gap-4 md:grid-cols-2">
              {t.whoItems.map((item) => (
                <div key={item.title} className="rounded-xl border border-line bg-panel p-6">
                  <h3 className="font-display text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.85] text-slate-400">{item.body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- V3 references ------------------------------ */}
      <section id="v3" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title={t.v3Title} right={t.v3Right} />
            <p className="mt-3 max-w-3xl text-[15px] leading-[1.85] text-slate-400">
              {t.v3Intro}
            </p>
            <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
              {t.v3Cards.map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="group relative block bg-panel/70 p-6 transition-colors hover:bg-panel">
                  <span aria-hidden="true" className="absolute left-0 top-0 h-[2px] w-full bg-[#0181FB] opacity-0 transition-opacity group-hover:opacity-100" />
                  <p className="flex items-center justify-between font-data text-[11px] uppercase tracking-[0.16em] text-sky-300">
                    {link.label}
                    <span aria-hidden="true" className="opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">↗</span>
                  </p>
                  <p className="mt-2 break-all font-data text-xs text-slate-300">{link.href}</p>
                  <p className="mt-1.5 text-xs text-slate-500">{link.note}</p>
                </a>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">
              {t.v3Footnote}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- roadmap ------------------------------ */}
      <section id="roadmap" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title={t.roadmapTitle} right={t.roadmapRight} accent="sky" />
            <div className="relative overflow-hidden rounded-[20px] border border-line">
              <div aria-hidden="true" className="absolute bottom-6 left-[27px] top-6 w-px bg-line" />
              <div aria-hidden="true" className="probe-bot absolute left-[14px] top-0 z-10">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M14 2 L25 8.5 V19.5 L14 26 L3 19.5 V8.5 Z" fill="#0b1220" stroke="#0181FB" strokeWidth="1.5" />
                  <circle cx="14" cy="14" r="3" fill="#0181FB">
                    <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <path d="M14 2 V0" stroke="#0181FB" strokeWidth="1.5" />
                </svg>
              </div>
              {t.roadmapItems.map((r) => (
                <div key={r.title} className="relative bg-panel/70 p-6 pl-16">
                  <span aria-hidden="true" className="absolute left-[20px] top-7 h-[14px] w-[14px] rounded-full border-2 border-[#0181FB] bg-deep" />
                  <span className="inline-flex items-center gap-2 font-data text-[11px] uppercase tracking-[0.16em] text-emerald-300">
                    <span className="h-2 w-2 bg-emerald-400" />
                    {t.roadmapShipped}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold text-white">{r.title}</h3>
                  <p className="mt-2 text-[15px] leading-[1.85] text-slate-400">{r.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-[20px] border border-dashed border-line bg-panel/50 p-6">
              <p className="font-data text-[11px] uppercase tracking-[0.16em] text-amber-300">{t.roadmapNextLabel}</p>
              <div className="mt-4 space-y-4">
                {t.roadmapNextItems.map((r) => (
                  <div key={r.title}>
                    <h3 className="font-display text-base font-semibold text-white">{r.title}</h3>
                    <p className="mt-1 text-[15px] leading-[1.85] text-slate-400">{r.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              {t.roadmapFootnote}
            </p>
          </Reveal>
        </div>
      </section>

      {/* --------------------------- judge quickstart ------------------------ */}
      <section id="judge" className="scroll-mt-28 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <SectionHeading title={t.judgeTitle} right={t.judgeRight} />
            <p className="max-w-3xl text-[15px] leading-[1.85] text-slate-400">
              {t.judgeIntro}
            </p>
            <div className="mt-6 overflow-hidden rounded-xl border border-line">
              {t.judgeSteps.map((s) => (
                <div key={s.title} className="grid gap-2 border-b border-line bg-panel px-6 py-6 last:border-b-0 md:grid-cols-12">
                  <h3 className="font-display text-lg font-semibold text-white md:col-span-4">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400 md:col-span-8">{s.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-500">
              {t.judgeFootnote}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------- CTA -------------------------------- */}
      <section className="relative overflow-hidden px-4 py-24">
        <Reveal className="relative mx-auto max-w-3xl rounded-[32px] border border-line bg-panel/70 px-8 py-16 text-center shadow-[0_32px_90px_rgba(0,0,0,0.5)]">
          <Activity className="mx-auto h-8 w-8 text-slate-500" />
          <h2 className="mt-6 font-display text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
            {t.ctaTitleA}<span className="font-data font-medium">{t.ctaTitleB}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-400">
            {t.ctaBody}
          </p>
          <a href={APP_URL} className="btn-primary mt-9 inline-flex items-center gap-2 rounded-xl px-7 py-4 text-base font-semibold">
            {t.launchApp}
            <ArrowRight className="h-5 w-5" />
          </a>
        </Reveal>
      </section>

      {/* ------------------------------ footer ------------------------------ */}
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
              <p className="mt-3 max-w-xs text-[15px] leading-[1.85] text-slate-500">
                {t.footerDescription}
              </p>
              <p className="mt-4 font-data text-[11px] uppercase tracking-[0.18em] text-slate-600">
                {t.footerDisclaimer}
              </p>
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
                          className="inline-block text-slate-400 transition-all hover:translate-x-0.5 hover:text-white"
                        >
                          {label}
                        </a>
                      ) : (
                        <span className="text-slate-500">{label}</span>
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
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-6 font-data text-[11px] uppercase tracking-[0.14em] text-slate-600">
          <span>{t.footerCopyright}</span>
          <span>{t.footerSchema}</span>
        </div>
      </footer>

      {/* ----------------------------- lightbox ----------------------------- */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={t.screenshots[lightbox].caption}
        >
          <button
            type="button"
            aria-label={t.lightboxClose}
            className="btn-ghost absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <figure className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <img src={t.screenshots[lightbox].src} alt={t.screenshots[lightbox].caption} className="mx-auto block max-h-[82vh] w-auto max-w-full rounded-xl border border-line" />
            <figcaption className="mt-3 text-center font-data text-xs uppercase tracking-[0.16em] text-slate-400">
              {t.screenshots[lightbox].caption}
            </figcaption>
          </figure>
        </div>
      )}
      <BackToTop label={t.backToTop} />
    </div>
  );
}
