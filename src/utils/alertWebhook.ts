import type { OverallVerdict } from './overallVerdict';
import type { StallState } from './stall';

/**
 * Alert webhooks (Discord / Slack), read-only toward the chain.
 *
 * - The webhook URL lives ONLY in this browser's localStorage. It is never
 *   put in a report, a share link, or a URL, and never sent anywhere but
 *   the webhook host itself.
 * - Messages go out only on a verdict TRANSITION while the user is
 *   watching (degrade / recover), on a stall transition (stall / resume),
 *   plus the explicit "Send test". No transition, no message.
 *   `not_checked` is never a transition. A stall/resume replaces the
 *   generic degrade/recover for that same cycle so the webhook says the
 *   specific thing that happened.
 * - Nothing here touches the chain beyond the health checks the user
 *   started; nothing signs.
 */

export type WebhookKind = 'discord' | 'slack';
export type TransitionKind = 'degrade' | 'recover' | 'stall' | 'resume';

export const WEBHOOK_STORAGE_KEY = 'nodescope-alert-webhook';

/** Higher is healthier. STALLED sits between DEGRADED and DOWN. */
const RANK: Record<Exclude<OverallVerdict, 'not_checked'>, number> = {
  healthy: 3,
  degraded: 2,
  stalled: 1,
  down: 0,
};

export function detectWebhookKind(raw: string): WebhookKind | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  if ((host === 'discord.com' || host === 'discordapp.com' || host === 'ptb.discord.com' || host === 'canary.discord.com') && u.pathname.startsWith('/api/webhooks/')) {
    return 'discord';
  }
  if (host === 'hooks.slack.com' && (u.pathname.startsWith('/services/') || u.pathname.startsWith('/workflows/') || u.pathname.startsWith('/triggers/'))) {
    return 'slack';
  }
  return null;
}

/** Masks the secret part of a webhook URL for display: host + first path segments only. */
export function maskWebhookUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    const parts = u.pathname.split('/').filter(Boolean);
    const keep = parts.slice(0, Math.min(parts.length, 3));
    return `${u.host}/${keep.join('/')}/••••`;
  } catch {
    return '••••';
  }
}

export function detectTransition(prev: OverallVerdict | null, next: OverallVerdict): 'degrade' | 'recover' | null {
  if (prev === null || prev === 'not_checked' || next === 'not_checked') return null;
  if (RANK[next] < RANK[prev]) return 'degrade';
  if (RANK[next] > RANK[prev]) return 'recover';
  return null;
}

/**
 * Stall alerts are their own transitions. The first known state is the
 * baseline (null or unknown → anything is silent). Entering stalled is
 * `stall`. Leaving stalled for a live head is `resume`. Leaving stalled
 * because the RPC stopped answering (next is unknown, verdict DOWN) is
 * not a resume — the caller sends degrade instead.
 */
export function detectStallTransition(prev: StallState | null, next: StallState): 'stall' | 'resume' | null {
  if (prev === null || prev === 'unknown') return null;
  if (prev !== 'stalled' && next === 'stalled') return 'stall';
  if (prev === 'stalled' && next === 'live') return 'resume';
  return null;
}

/**
 * One webhook per cycle. Stall/resume is the message when the chain
 * pauses or starts again. A verdict change that is not that pause
 * (including stalled → down) keeps degrade/recover.
 */
export function alertKindForCycle(
  prevVerdict: OverallVerdict | null,
  nextVerdict: OverallVerdict,
  prevStall: StallState | null,
  nextStall: StallState,
): TransitionKind | null {
  const stall = detectStallTransition(prevStall, nextStall);
  if (stall) return stall;
  return detectTransition(prevVerdict, nextVerdict);
}

export interface AlertEvent {
  kind: TransitionKind | 'test';
  from: OverallVerdict | null;
  to: OverallVerdict;
  endpointOrigin: string;
  blockHeight: string | null;
  score: number | null;
  coverage: number | null;
  /** Plain stall/resume sentence, when that is the kind. */
  detail?: string | null;
  /** Operator next step, when the cycle computed one. */
  nextStep?: string | null;
  at: Date;
}

export function alertText(e: AlertEvent): string {
  const head =
    e.kind === 'test'
      ? 'NodeScope test alert — this webhook is wired up.'
      : e.kind === 'stall'
        ? `NodeScope: chain STALLED (${e.from} → ${e.to}). Chain paused but RPC answers.`
        : e.kind === 'resume'
          ? `NodeScope: chain RESUMED (${e.from} → ${e.to}).`
          : e.kind === 'degrade'
            ? `NodeScope: node DEGRADED (${e.from} → ${e.to})`
            : `NodeScope: node RECOVERED (${e.from} → ${e.to})`;
  const lines = [
    head,
    `Endpoint: ${e.endpointOrigin}`,
    `Verdict: ${e.to.replace('_', ' ')}`,
    ...(e.detail ? [e.detail] : []),
    `Block: ${e.blockHeight ?? 'not observed'}`,
    `Health Score: ${e.score === null ? 'not scored' : `${e.score}/100`}${e.coverage !== null ? ` (coverage ${e.coverage}%)` : ''}`,
    ...(e.nextStep ? [`Next step: ${e.nextStep}`] : []),
    `At: ${e.at.toISOString()}`,
    'Read-only check from NodeScope. Nothing was signed.',
  ];
  return lines.join('\n');
}

export function buildWebhookBody(kind: WebhookKind, e: AlertEvent): Record<string, unknown> {
  const text = alertText(e);
  if (kind === 'discord') {
    return { username: 'NodeScope', content: text, allowed_mentions: { parse: [] } };
  }
  return { text };
}

export type SendOutcome =
  | { status: 'delivered'; httpStatus: number }
  | { status: 'sent_unconfirmed'; reason: string }
  | { status: 'failed'; reason: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * POST the alert. First a normal JSON request (Discord answers CORS, so
 * its HTTP status is readable). If the browser blocks it (Slack's
 * incoming webhooks send no CORS headers), fall back to a CORS-simple
 * request in no-cors mode: Discord gets multipart `payload_json`, Slack
 * gets form-encoded `payload=` — both formats documented by the hosts.
 * The browser cannot read that reply, so the outcome says
 * "sent_unconfirmed" instead of pretending it was delivered.
 */
export async function sendWebhook(url: string, e: AlertEvent, fetchImpl: FetchLike = fetch): Promise<SendOutcome> {
  const kind = detectWebhookKind(url);
  if (!kind) return { status: 'failed', reason: 'Not a Discord or Slack webhook URL (https only).' };
  const body = buildWebhookBody(kind, e);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return { status: 'delivered', httpStatus: res.status };
    return { status: 'failed', reason: `Webhook answered HTTP ${res.status}.` };
  } catch {
    try {
      if (kind === 'discord') {
        const form = new FormData();
        form.append('payload_json', JSON.stringify(body));
        await fetchImpl(url, { method: 'POST', mode: 'no-cors', body: form });
      } else {
        await fetchImpl(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `payload=${encodeURIComponent(JSON.stringify(body))}`,
        });
      }
      return { status: 'sent_unconfirmed', reason: 'Sent; the browser cannot read the webhook reply (no CORS), so delivery is unconfirmed.' };
    } catch (err) {
      return { status: 'failed', reason: err instanceof Error ? err.message : 'Network error.' };
    }
  }
}

export function loadWebhookUrl(): string {
  try {
    return localStorage.getItem(WEBHOOK_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveWebhookUrl(url: string): void {
  try {
    if (url) localStorage.setItem(WEBHOOK_STORAGE_KEY, url);
    else localStorage.removeItem(WEBHOOK_STORAGE_KEY);
  } catch {
    // Storage unavailable: alerts still work for this tab session only.
  }
}

/** Allowed watch intervals (seconds). Floor of 30 s keeps load on a public testnet RPC polite. */
export const WATCH_INTERVALS = [30, 60, 300] as const;
export type WatchInterval = (typeof WATCH_INTERVALS)[number];
