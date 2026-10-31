import { useEffect, useRef, useState } from 'react';
import {
  WATCH_INTERVALS,
  alertKindForCycle,
  detectWebhookKind,
  loadWebhookUrl,
  maskWebhookUrl,
  saveWebhookUrl,
  sendWebhook,
  type AlertEvent,
  type SendOutcome,
  type WatchInterval,
} from '../../utils/alertWebhook';
import type { OverallVerdict } from '../../utils/overallVerdict';
import type { StallState } from '../../utils/stall';
import { planOperatorActions } from '../../../shared/operatorActions.mjs';

export interface WatchCycleResult {
  verdict: OverallVerdict;
  endpointOrigin: string;
  blockHeight: string | null;
  score: number | null;
  coverage: number | null;
  /** Where the missing points went, from the same score object as the gauge. */
  scoreNote?: string;
  stall?: StallState;
  stallExplanation?: string | null;
}

interface WatchAlertsPanelProps {
  /** One full cycle: health check + Substrate probe, user-started only. */
  runCycle: () => Promise<WatchCycleResult>;
  /** Current state, used for "Send test". */
  current: WatchCycleResult;
  onToast?: (message: string) => void;
  /** Test hook: overrides the interval in milliseconds. */
  tickMsOverride?: number;
}

interface LogLine {
  at: Date;
  text: string;
  tone: 'ok' | 'warn' | 'bad' | 'muted';
}

function outcomeLine(o: SendOutcome): { text: string; tone: LogLine['tone'] } {
  if (o.status === 'delivered') return { text: `webhook delivered (HTTP ${o.httpStatus})`, tone: 'ok' };
  if (o.status === 'sent_unconfirmed') return { text: o.reason, tone: 'warn' };
  return { text: `webhook failed — ${o.reason}`, tone: 'bad' };
}

/**
 * Watch & alerts. Opt-in, tab-scoped monitoring: nothing runs until the
 * user presses Start, it stops on Stop or when the tab closes, and the
 * interval floor is 30 s. A Discord/Slack message goes out only on a
 * degrade/recover transition, on stall/resume, or on "Send test".
 * Stall/resume replaces the generic verdict message for that cycle.
 * The webhook URL stays in this browser's localStorage and is shown masked.
 */
export function WatchAlertsPanel({ runCycle, current, onToast, tickMsOverride }: WatchAlertsPanelProps) {
  const [url, setUrl] = useState(() => loadWebhookUrl());
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [interval, setIntervalSec] = useState<WatchInterval>(60);
  const [watching, setWatching] = useState(false);
  const [cycles, setCycles] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const [sendingTest, setSendingTest] = useState(false);
  const prevVerdict = useRef<OverallVerdict | null>(null);
  const prevStall = useRef<StallState | null>(null);
  const timer = useRef<number | null>(null);
  const alive = useRef(true);
  const urlRef = useRef(url);
  const cycleRef = useRef(runCycle);
  useEffect(() => {
    urlRef.current = url;
    cycleRef.current = runCycle;
  });

  const kind = url ? detectWebhookKind(url) : null;

  const pushLog = (text: string, tone: LogLine['tone']) => {
    setLog((prev) => [{ at: new Date(), text, tone }, ...prev].slice(0, 6));
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!watching) return;
    let cancelled = false;
    const tick = async () => {
      let r: WatchCycleResult;
      try {
        r = await cycleRef.current();
      } catch (e) {
        if (!cancelled) pushLog(`cycle failed — ${e instanceof Error ? e.message : 'error'}`, 'bad');
        schedule();
        return;
      }
      if (cancelled || !alive.current) return;
      setCycles((c) => c + 1);
      const stall = r.stall ?? 'unknown';
      const transition = alertKindForCycle(prevVerdict.current, r.verdict, prevStall.current, stall);
      const from = prevVerdict.current;
      prevVerdict.current = r.verdict;
      prevStall.current = stall;
      pushLog(
        `${r.verdict.replace('_', ' ')} · block ${r.blockHeight ?? '—'} · score ${r.score ?? '—'}${r.scoreNote ? ` (${r.scoreNote})` : ''}${r.stallExplanation ? ` · ${r.stallExplanation}` : ''}${transition ? ` · ${transition.toUpperCase()}` : ''}`,
        r.verdict === 'healthy' ? 'ok' : r.verdict === 'down' ? 'bad' : 'warn',
      );
      if (transition && urlRef.current) {
        const event: AlertEvent = {
          kind: transition,
          from,
          to: r.verdict,
          endpointOrigin: r.endpointOrigin,
          blockHeight: r.blockHeight,
          score: r.score,
          coverage: r.coverage,
          detail: transition === 'stall' || transition === 'resume' ? r.stallExplanation ?? null : null,
          nextStep: planOperatorActions({
            scope: 'self',
            score: { score: r.score, components: [] },
            stall: { state: stall },
          }).overall.short,
          at: new Date(),
        };
        const outcome = await sendWebhook(urlRef.current, event);
        if (!cancelled) {
          const line = outcomeLine(outcome);
          pushLog(line.text, line.tone);
        }
      }
      schedule();
    };
    const schedule = () => {
      if (cancelled) return;
      timer.current = window.setTimeout(() => void tick(), tickMsOverride ?? interval * 1000);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [watching, interval, tickMsOverride]);

  const save = () => {
    const v = draft.trim();
    if (!detectWebhookKind(v)) {
      setError('Paste a Discord (discord.com/api/webhooks/…) or Slack (hooks.slack.com/…) webhook URL. https only.');
      return;
    }
    setError(null);
    saveWebhookUrl(v);
    setUrl(v);
    setDraft('');
    onToast?.('Webhook saved in this browser only');
  };

  const forget = () => {
    saveWebhookUrl('');
    setUrl('');
    pushLog('webhook removed from this browser', 'muted');
  };

  const sendTest = async () => {
    if (!url) return;
    setSendingTest(true);
    const outcome = await sendWebhook(url, { kind: 'test', from: null, to: current.verdict, endpointOrigin: current.endpointOrigin, blockHeight: current.blockHeight, score: current.score, coverage: current.coverage, at: new Date() });
    setSendingTest(false);
    const line = outcomeLine(outcome);
    pushLog(`test · ${line.text}`, line.tone);
  };

  const toggleWatch = () => {
    if (watching) {
      setWatching(false);
      pushLog('watch stopped', 'muted');
    } else {
      prevVerdict.current = null;
      prevStall.current = null;
      setCycles(0);
      setWatching(true);
      pushLog(`watch started · every ${interval} s · first cycle sets the baseline`, 'muted');
    }
  };

  const toneClass: Record<LogLine['tone'], string> = {
    ok: 'text-emerald-400',
    warn: 'text-amber-400',
    bad: 'text-red-400',
    muted: 'text-slate-500',
  };

  return (
    <section id="watch-alerts" aria-labelledby="watch-alerts-title" className="instrument-panel scroll-mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h3 id="watch-alerts-title" className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-400">
          Watch &amp; alerts
        </h3>
        <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">
          {watching ? (
            <span className="text-signal">
              <span aria-hidden="true" className="watch-dot" /> watching · cycle {cycles}
            </span>
          ) : (
            'idle · opt-in · tab-scoped'
          )}
        </span>
      </div>
      <div className="grid gap-px bg-line md:grid-cols-2">
        <div className="bg-panel p-5">
          <label htmlFor="webhook-url" className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Discord or Slack webhook
          </label>
          {url ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 max-w-full truncate rounded border border-line bg-black/30 px-2 py-1 font-data text-[12px] text-slate-200">
                {kind === 'discord' ? 'Discord' : kind === 'slack' ? 'Slack' : '?'} · {maskWebhookUrl(url)}
              </code>
              <button type="button" onClick={() => void sendTest()} disabled={sendingTest} className="btn-ghost rounded-md px-3 py-1.5 text-xs font-medium">
                {sendingTest ? 'Sending…' : 'Send test'}
              </button>
              <button type="button" onClick={forget} className="rounded-md px-2 py-1.5 text-xs text-slate-400 underline underline-offset-4 hover:text-slate-200">
                Remove
              </button>
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="webhook-url"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://discord.com/api/webhooks/…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-line bg-black/30 px-3 py-2 font-data text-[12px] text-slate-100 placeholder:text-slate-600"
              />
              <button type="button" onClick={save} className="btn-primary px-4 py-2 text-sm font-semibold">
                Save
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs text-red-400">
              {error}
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Stored only in this browser (localStorage), never in a report or link. Messages go out on degrade/recover and on stall/resume while you watch, and on Send test. Read-only toward the chain: nothing signs. Each endpoint stays under 5 requests per second. The shortest interval is 30 seconds.
          </p>
        </div>
        <div className="bg-panel p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">Every</span>
            <div role="group" aria-label="Watch interval" className="flex overflow-hidden rounded-md border border-line">
              {WATCH_INTERVALS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={interval === s}
                  disabled={watching}
                  onClick={() => setIntervalSec(s)}
                  className={`px-2.5 py-1 font-data text-[11px] ${interval === s ? 'bg-signal text-ink' : 'text-slate-300 hover:bg-white/5'} disabled:opacity-60`}
                >
                  {s < 60 ? `${s}s` : `${s / 60}m`}
                </button>
              ))}
            </div>
            <button type="button" onClick={toggleWatch} className={`${watching ? 'btn-ghost' : 'btn-primary'} ml-auto px-4 py-2 text-sm font-semibold`}>
              {watching ? 'Stop watch' : 'Start watch'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Each cycle runs the EVM health check, the block timestamp, and the Substrate probe once. A paused head is logged as STALLED. Works with or without a webhook.
          </p>
          <ol aria-live="polite" className="mt-3 space-y-1 font-data text-[11px]">
            {log.length === 0 ? (
              <li className="text-slate-500">No events yet.</li>
            ) : (
              log.map((l, i) => (
                <li key={`${l.at.getTime()}-${i}`} className="flex gap-2">
                  <span className="shrink-0 text-slate-600">{l.at.toLocaleTimeString('en-GB', { hour12: false })}</span>
                  <span className={`min-w-0 break-words ${toneClass[l.tone]}`}>{l.text}</span>
                </li>
              ))
            )}
          </ol>
        </div>
      </div>
    </section>
  );
}
