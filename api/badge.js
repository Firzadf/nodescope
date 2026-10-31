/**
 * Live status badge. Vercel Node function, also imported by tests.
 *
 * Read-only. No secrets. Only the published Portaldot V3 testnet hosts.
 * Cache-Control plus a short in-memory cache so a README full of
 * reloads does not hammer the public RPC.
 */
import {
  BADGE_CACHE_CONTROL,
  FORMULA_V2,
  assessStall,
  badgeTarget,
  computeHealthScoreV2,
  renderBadgeSvg,
} from '../shared/liveStatus.mjs';
import { planOperatorActions } from '../shared/operatorActions.mjs';
import { assessTransportHeads } from '../shared/endpointParity.mjs';
import { paceRequest } from '../shared/requestPace.mjs';

const CACHE_MS = 20_000;
const cache = new Map();

async function rpc(url, method, params, fetchImpl, timeoutMs = 8000) {
  await paceRequest(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      redirect: 'error',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || 'rpc error');
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

function wsCall(url, calls, timeoutMs, wsFactory) {
  const Factory = wsFactory ?? globalThis.WebSocket;
  return new Promise((resolve) => {
    let ws;
    try {
      ws = new Factory(url);
    } catch {
      resolve(null);
      return;
    }
    const results = new Array(calls.length);
    const got = new Set();
    const done = (value) => {
      clearTimeout(timer);
      try { ws.close(); } catch { /* closed */ }
      resolve(value);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    ws.onopen = () => {
      void (async () => {
        for (let i = 0; i < calls.length; i++) {
          const call = calls[i];
          const method = Array.isArray(call) ? call[0] : call;
          const params = Array.isArray(call) ? call[1] : [];
          await paceRequest(url);
          try {
            ws.send(JSON.stringify({ jsonrpc: '2.0', id: i + 1, method, params }));
          } catch {
            done(null);
            return;
          }
        }
      })();
    };
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (typeof parsed.id !== 'number') return;
        results[parsed.id - 1] = parsed.error ? null : parsed.result;
        got.add(parsed.id);
        if (got.size === calls.length) done(results);
      } catch {
        done(null);
      }
    };
    ws.onerror = () => done(null);
  });
}

export async function liveBadgeStatus(evm, wss, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const nowMs = deps.nowMs ?? Date.now();
  let chainId = null;
  let block = null;
  let head = null;
  let answered = false;
  let latencyMs = null;
  try {
    chainId = await rpc(evm, 'eth_chainId', [], fetchImpl);
    const started = Date.now();
    head = await rpc(evm, 'eth_blockNumber', [], fetchImpl);
    latencyMs = Date.now() - started;
    block = await rpc(evm, 'eth_getBlockByNumber', ['latest', false], fetchImpl);
    answered = true;
  } catch {
    answered = chainId !== null || head !== null;
  }
  const ws = wss ? await wsCall(wss, ['system_health', 'system_chain', 'chain_getHeader', 'chain_getFinalizedHead', 'system_syncState'], 8000, deps.wsFactory) : null;
  let finalizedHeader = deps.finalizedHeader ?? null;
  if (!finalizedHeader && ws && typeof ws[3] === 'string' && /^0x[0-9a-fA-F]{64}$/.test(ws[3])) {
    const more = await wsCall(wss, [['chain_getHeader', [ws[3]]]], 8000, deps.wsFactory);
    finalizedHeader = more?.[0] ?? null;
  }
  const bestDec = typeof head === 'string' && /^0x/i.test(head) ? BigInt(head).toString() : null;
  const bestTs = block && typeof block.timestamp === 'string' ? Number(BigInt(block.timestamp)) : null;
  const headerDec = ws?.[2]?.number ? BigInt(ws[2].number).toString() : null;
  const finDec = finalizedHeader?.number ? BigInt(finalizedHeader.number).toString() : (deps.finalizedDecimal ?? null);
  const health = ws?.[0] ?? null;
  const sync = ws?.[4] ?? null;
  const wsProbe = ws
    ? {
        status: 'ok',
        chain: typeof ws[1] === 'string' ? ws[1] : null,
        peers: typeof health?.peers === 'number' ? health.peers : null,
        isSyncing: typeof health?.isSyncing === 'boolean' ? health.isSyncing : null,
        shouldHavePeers: typeof health?.shouldHavePeers === 'boolean' ? health.shouldHavePeers : null,
        headerNumberDecimal: headerDec ?? bestDec,
        finalizedNumberDecimal: finDec,
        syncCurrentBlock: sync?.currentBlock != null ? String(sync.currentBlock) : null,
        syncHighestBlock: sync?.highestBlock != null ? String(sync.highestBlock) : null,
      }
    : null;
  const snapshot = answered
    ? {
        timestamp: nowMs,
        endpointOrigin: evm,
        endpointProfile: 'badge',
        checks: [
          { method: 'eth_chainId', success: typeof chainId === 'string', outcome: typeof chainId === 'string' ? 'success' : 'network_error', latencyMs: 100, observedValue: chainId },
          { method: 'eth_blockNumber', success: typeof head === 'string', outcome: typeof head === 'string' ? 'success' : 'network_error', latencyMs: 100, observedValue: head },
        ],
      }
    : null;
  const motion = bestTs !== null ? { bestTimestampSec: bestTs, observedAtMs: nowMs, bestHeight: bestDec } : null;
  const score = computeHealthScoreV2({ snapshots: snapshot ? [snapshot] : [], wsProbe, motion });
  const stall = assessStall({
    nowMs,
    rpcAnswered: answered || wsProbe?.status === 'ok',
    bestTimestampSec: bestTs,
    bestHeight: bestDec ?? headerDec,
    finalizedHeight: finDec,
  });
  let verdict = 'not_checked';
  if (!answered && !wsProbe) verdict = 'down';
  else if (!answered && wsProbe?.status !== 'ok') verdict = 'down';
  else if (stall.state === 'stalled') verdict = 'stalled';
  else if (answered && wsProbe?.status === 'ok' && score.band === 'healthy') verdict = 'healthy';
  else if (answered || wsProbe?.status === 'ok') verdict = score.band === 'critical' || score.band === 'degraded' || !wsProbe ? 'degraded' : 'healthy';
  else verdict = 'down';
  const detail = `${FORMULA_V2}. ${stall.explanation}`;
  const peers = typeof health?.peers === 'number' ? health.peers : null;
  const parity = assessTransportHeads({ evmHeight: bestDec, wssHeight: headerDec });
  const actions = planOperatorActions({
    scope: 'public_testnet',
    score,
    stall,
    wsProbe,
    parity,
  });
  return {
    verdict,
    score: score.score,
    band: score.band,
    detail,
    stall: stall.state,
    coverage: score.coverage,
    formula: FORMULA_V2,
    checkedAt: new Date(nowMs).toISOString(),
    bestHeight: bestDec ?? headerDec,
    finalizedHeight: finDec,
    finalityLag: stall.finalityLagBlocks,
    peers,
    isSyncing: typeof health?.isSyncing === 'boolean' ? health.isSyncing : null,
    latencyMs,
    chain: typeof ws?.[1] === 'string' ? ws[1] : null,
    explanation: stall.explanation,
    action: actions.overall,
    degradation: actions.degradation,
    parity: actions.parity,
    substrateHeight: headerDec,
  };
}

export async function badgeResponse(searchParams, deps = {}) {
  const target = badgeTarget(searchParams);
  if (!target.ok) {
    return { status: 400, svg: renderBadgeSvg({ verdict: 'not_checked', detail: target.error }), cache: 'public, max-age=60' };
  }
  const key = `${target.evm}|${target.wss}`;
  const hit = cache.get(key);
  const now = deps.nowMs ?? Date.now();
  if (hit && now - hit.at < CACHE_MS && !deps.bypassCache) {
    return { status: 200, svg: hit.svg, cache: BADGE_CACHE_CONTROL };
  }
  try {
    const status = await liveBadgeStatus(target.evm, target.wss, deps);
    const svg = renderBadgeSvg(status);
    cache.set(key, { at: now, svg });
    return { status: 200, svg, cache: BADGE_CACHE_CONTROL };
  } catch (err) {
    const svg = renderBadgeSvg({ verdict: 'down', detail: err instanceof Error ? err.message : 'Badge check failed.' });
    return { status: 200, svg, cache: 'public, max-age=15' };
  }
}

export default async function handler(req, res) {
  const url = new URL(req.url ?? '/', 'https://nodescope.local');
  const out = await badgeResponse(url.searchParams);
  res.statusCode = out.status;
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', out.cache);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(out.svg);
}
