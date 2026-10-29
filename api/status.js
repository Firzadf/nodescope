/**
 * JSON twin of the status badge. Same read-only check, same host
 * allowlist, same score. The /status page fetches this once when it
 * opens, and again only when the visitor presses Refresh.
 */
import { BADGE_CACHE_CONTROL, badgeTarget } from '../shared/liveStatus.mjs';
import { liveBadgeStatus } from './badge.js';

const CACHE_MS = 20_000;
const cache = new Map();

export async function statusResponse(searchParams, deps = {}) {
  const target = badgeTarget(searchParams);
  if (!target.ok) {
    return { status: 400, cache: 'public, max-age=60', body: { error: target.error } };
  }
  const key = `${target.evm}|${target.wss}`;
  const now = deps.nowMs ?? Date.now();
  const fresh = searchParams.get('fresh') === '1' || deps.bypassCache;
  const hit = cache.get(key);
  if (!fresh && hit && now - hit.at < CACHE_MS) {
    return { status: 200, cache: BADGE_CACHE_CONTROL, body: hit.body };
  }
  const live = await liveBadgeStatus(target.evm, target.wss, deps);
  const body = { ...live, evm: target.evm, wss: target.wss };
  cache.set(key, { at: now, body });
  return { status: 200, cache: BADGE_CACHE_CONTROL, body };
}

export default async function handler(req, res) {
  const url = new URL(req.url ?? '/', 'https://nodescope.local');
  const out = await statusResponse(url.searchParams);
  res.statusCode = out.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', out.cache);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(out.body));
}
