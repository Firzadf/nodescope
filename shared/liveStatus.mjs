/**
 * Shared, dependency-free health signals for the app, the CLI, and the
 * status badge. One implementation so the published formula cannot drift.
 *
 * nodescope.health-score.v1 stays in src/utils/healthScore.ts and is not
 * modified here. New reports and the live badge use v2.
 *
 * v2 weights (sum 100):
 *   availability       20   same eligible-check rule as v1
 *   chain_identity     10   eth_chainId === 420420777
 *   head_progression   15   best head advanced, or a single timestamp age
 *   finality           15   best − finalized, full marks at lag ≤ 4, zero at ≥ 64
 *   latency            10   median, full ≤ 300 ms, zero ≥ 2000 ms
 *   transport_parity   10   Substrate WSS answered (peer bonus moved out)
 *   peer_sync          10   peers, isSyncing, sync gap
 *   rpc_reliability    10   error ratio and p95 over repeated eth_blockNumber
 *
 * score = round(100 × Σ points ÷ Σ measured weight)
 * A component with no input is not measured and drops out of both sides.
 * Below 50 measured weight the score is null.
 *
 * STALLED is not a score band. It is a verdict: the RPC answered and the
 * best head and/or the finalized head has not advanced past a threshold.
 * See assessStall.
 */

export const FORMULA_V2 = 'nodescope.health-score.v2';
export const PORTALDOT_CHAIN_ID = 420420777;

export const WEIGHTS_V2 = {
  availability: 20,
  chain_identity: 10,
  head_progression: 15,
  finality: 15,
  latency: 10,
  transport_parity: 10,
  peer_sync: 10,
  rpc_reliability: 10,
};

export const V2_LABELS = {
  availability: 'RPC availability',
  chain_identity: 'Chain identity',
  head_progression: 'Head progression',
  finality: 'Finality lag',
  latency: 'Latency',
  transport_parity: 'Transport parity (WSS)',
  peer_sync: 'Peers & sync',
  rpc_reliability: 'RPC reliability',
};

export const LATENCY_FULL_MARKS_MS = 300;
export const LATENCY_ZERO_MS = 2000;
export const MIN_COVERAGE_TO_SCORE = 50;
export const HEAD_SAMPLE_STALL_SECONDS = 30;
export const BEST_STALL_AGE_SECONDS = 90;
export const FINALIZED_STALL_AGE_SECONDS = 180;
export const FINALITY_FULL_LAG_BLOCKS = 4;
export const FINALITY_ZERO_LAG_BLOCKS = 64;
export const FINALITY_STALL_LAG_BLOCKS = 64;
export const FINALITY_STALL_MIN_AGE_SECONDS = 120;
export const SYNC_GAP_FULL_BLOCKS = 8;

const REAL_FAILURES = new Set(['rpc_error', 'network_error', 'http_error', 'invalid_response']);

function round1(n) {
  return Math.round(n * 10) / 10;
}

export function bandFor(score) {
  if (score >= 90) return 'healthy';
  if (score >= 70) return 'degraded';
  return 'critical';
}

export function parseHeight(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return Number.isSafeInteger(value) ? BigInt(value) : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/^0[xX][0-9a-fA-F]+$/.test(trimmed)) {
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }
  if (/^\d+$/.test(trimmed)) {
    try {
      return BigInt(trimmed);
    } catch {
      return null;
    }
  }
  return null;
}

function median(values) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function latencyPoints(medianMs, weight) {
  if (medianMs <= LATENCY_FULL_MARKS_MS) return weight;
  if (medianMs >= LATENCY_ZERO_MS) return 0;
  const frac = (LATENCY_ZERO_MS - medianMs) / (LATENCY_ZERO_MS - LATENCY_FULL_MARKS_MS);
  return round1(weight * frac);
}

export function finalityPoints(lag, weight = WEIGHTS_V2.finality) {
  if (!Number.isFinite(lag)) return 0;
  if (lag < 0) return 0;
  if (lag <= FINALITY_FULL_LAG_BLOCKS) return weight;
  if (lag >= FINALITY_ZERO_LAG_BLOCKS) return 0;
  const frac = (FINALITY_ZERO_LAG_BLOCKS - lag) / (FINALITY_ZERO_LAG_BLOCKS - FINALITY_FULL_LAG_BLOCKS);
  return round1(weight * frac);
}

function newestSnapshots(snapshots) {
  return [...(snapshots ?? [])].sort((a, b) => b.timestamp - a.timestamp);
}

function component(id, measured, points, detail) {
  return {
    id,
    label: V2_LABELS[id],
    weight: WEIGHTS_V2[id],
    measured,
    points: measured ? points : null,
    detail,
  };
}

function availability(latest) {
  const weight = WEIGHTS_V2.availability;
  if (!latest) return component('availability', false, null, 'No health snapshot yet.');
  const eligible = latest.checks.filter((c) => c.success || REAL_FAILURES.has(c.outcome));
  if (eligible.length === 0) {
    return component('availability', false, null, 'Latest snapshot has no eligible check (all unsupported).');
  }
  const passed = eligible.filter((c) => c.success).length;
  return component('availability', true, round1((weight * passed) / eligible.length), `${passed}/${eligible.length} checks answered in the latest snapshot.`);
}

function chainIdentity(latest) {
  const weight = WEIGHTS_V2.chain_identity;
  const check = latest?.checks.find((c) => c.method === 'eth_chainId');
  if (!latest || !check) return component('chain_identity', false, null, 'eth_chainId not checked yet.');
  if (!check.success) return component('chain_identity', true, 0, `eth_chainId failed (${check.outcome}).`);
  const id = parseHeight(check.observedValue);
  const ok = id !== null && id === BigInt(PORTALDOT_CHAIN_ID);
  return component(
    'chain_identity',
    true,
    ok ? weight : 0,
    ok
      ? `eth_chainId = ${PORTALDOT_CHAIN_ID}, as documented.`
      : `eth_chainId = ${id !== null ? id.toString() : String(check.observedValue)}, expected ${PORTALDOT_CHAIN_ID}.`,
  );
}

function heightsOnSameEndpoint(snapshots) {
  const sorted = newestSnapshots(snapshots);
  const latest = sorted[0];
  if (!latest) return [];
  return sorted
    .filter((s) => s.endpointOrigin === latest.endpointOrigin && s.endpointProfile === latest.endpointProfile)
    .map((s) => {
      const c = s.checks.find((k) => k.method === 'eth_blockNumber' && k.success);
      return { at: s.timestamp, h: c ? parseHeight(c.observedValue) : null };
    })
    .filter((x) => x.h !== null);
}

function headProgression(snapshots, motion) {
  const weight = WEIGHTS_V2.head_progression;
  const age = motion?.bestTimestampSec != null && motion?.observedAtMs != null
    ? Math.round(motion.observedAtMs / 1000 - motion.bestTimestampSec)
    : null;
  if (age !== null && age >= BEST_STALL_AGE_SECONDS) {
    const h = motion?.bestHeight ?? heightsOnSameEndpoint(snapshots)[0]?.h?.toString() ?? 'unknown';
    return component('head_progression', true, 0, `Best head ${h} is ${age}s old (threshold ${BEST_STALL_AGE_SECONDS}s). Chain paused but RPC answers.`);
  }
  const withHeight = heightsOnSameEndpoint(snapshots);
  if (withHeight.length >= 2) {
    const [newer, older] = withHeight;
    const delta = newer.h - older.h;
    const gapSeconds = Math.round((newer.at - older.at) / 1000);
    if (delta > 0n) {
      return component('head_progression', true, weight, `Head advanced +${delta.toString()} blocks in ${gapSeconds} s.`);
    }
    if (delta < 0n) {
      return component('head_progression', true, 0, `Head regressed ${delta.toString()} blocks in ${gapSeconds} s.`);
    }
    if (gapSeconds >= HEAD_SAMPLE_STALL_SECONDS) {
      return component('head_progression', true, 0, `Head stalled at ${newer.h.toString()} for ${gapSeconds} s.`);
    }
    return component('head_progression', true, round1(weight / 2), `Same height ${newer.h.toString()} but only ${gapSeconds} s apart (inconclusive).`);
  }
  if (age !== null && age >= -120 && age < BEST_STALL_AGE_SECONDS) {
    return component('head_progression', true, weight, `Best head timestamp is ${age}s old, under the ${BEST_STALL_AGE_SECONDS}s stall threshold.`);
  }
  return component('head_progression', false, null, 'Needs two snapshots with a block height, or one block timestamp.');
}

function finality(ws) {
  const weight = WEIGHTS_V2.finality;
  if (!ws || ws.status !== 'ok') return component('finality', false, null, 'Substrate WSS not probed, so finality lag was not measured.');
  const best = parseHeight(ws.headerNumberDecimal ?? ws.headerNumberHex);
  const fin = parseHeight(ws.finalizedNumberDecimal ?? ws.finalizedNumberHex);
  if (best === null || fin === null) {
    return component('finality', false, null, 'WSS answered but a finalized head was not reported.');
  }
  const lag = Number(best - fin);
  return component('finality', true, finalityPoints(lag, weight), `Best #${best.toString()} − finalized #${fin.toString()} = ${lag} blocks (full marks ≤ ${FINALITY_FULL_LAG_BLOCKS}, zero ≥ ${FINALITY_ZERO_LAG_BLOCKS}).`);
}

function latency(latest) {
  const weight = WEIGHTS_V2.latency;
  const samples = (latest?.checks ?? [])
    .filter((c) => c.success && typeof c.latencyMs === 'number' && Number.isFinite(c.latencyMs))
    .map((c) => c.latencyMs);
  const med = median(samples);
  if (med === null) return component('latency', false, null, 'No successful check with a latency yet.');
  return component('latency', true, latencyPoints(med, weight), `Median ${Math.round(med)} ms over ${samples.length} checks (full marks ≤ ${LATENCY_FULL_MARKS_MS} ms, zero ≥ ${LATENCY_ZERO_MS} ms).`);
}

function transportParity(ws) {
  const weight = WEIGHTS_V2.transport_parity;
  if (!ws) return component('transport_parity', false, null, 'Substrate WSS not probed yet.');
  if (ws.status !== 'ok') return component('transport_parity', true, 0, `WSS probe failed (${ws.error ?? 'unknown error'}).`);
  return component('transport_parity', true, weight, `WSS answered${ws.chain ? ` (${ws.chain})` : ''}.`);
}

function peerSync(ws) {
  if (!ws || ws.status !== 'ok') return component('peer_sync', false, null, 'Peers and sync were not read.');
  const peersKnown = typeof ws.peers === 'number';
  const peersOk = (peersKnown && ws.peers > 0) || ws.shouldHavePeers === false;
  const peersPts = peersOk ? 4 : 0;
  const syncPts = ws.isSyncing === false ? 3 : 0;
  const current = parseHeight(ws.syncCurrentBlock);
  const highest = parseHeight(ws.syncHighestBlock);
  let gapPts = 3;
  let gapDetail = 'sync gap not reported';
  if (current !== null && highest !== null) {
    const gap = Number(highest - current);
    gapPts = gap <= SYNC_GAP_FULL_BLOCKS ? 3 : 0;
    gapDetail = `sync gap ${gap} blocks`;
  }
  const points = peersPts + syncPts + gapPts;
  const peersDetail = !peersKnown ? 'peers unknown' : `${ws.peers} peers`;
  const syncDetail = ws.isSyncing === null ? 'syncing unknown' : ws.isSyncing ? 'syncing' : 'not syncing';
  return component('peer_sync', true, points, `${peersDetail}, ${syncDetail}, ${gapDetail}.`);
}

function reliability(rel) {
  const weight = WEIGHTS_V2.rpc_reliability;
  if (!rel || !Number.isFinite(rel.samples) || rel.samples <= 0) {
    return component('rpc_reliability', false, null, 'Repeated-call probe not run.');
  }
  const errors = Math.min(rel.samples, Math.max(0, rel.errors ?? 0));
  const errorRate = errors / rel.samples;
  const p95 = typeof rel.p95Ms === 'number' ? rel.p95Ms : null;
  let factor = 1;
  if (p95 === null) factor = errorRate === 0 ? 1 : 0;
  else if (p95 <= LATENCY_FULL_MARKS_MS) factor = 1;
  else if (p95 >= LATENCY_ZERO_MS) factor = 0;
  else factor = (LATENCY_ZERO_MS - p95) / (LATENCY_ZERO_MS - LATENCY_FULL_MARKS_MS);
  const points = round1(weight * (1 - errorRate) * factor);
  const http5xx = rel.http5xx ?? 0;
  return component(
    'rpc_reliability',
    true,
    points,
    `${errors}/${rel.samples} failed (${http5xx} HTTP 5xx), p95 ${p95 === null ? 'n/a' : `${Math.round(p95)} ms`}.`,
  );
}

/** Pure v2 score. Snapshot order does not matter. */
export function computeHealthScoreV2(input = {}) {
  const latest = newestSnapshots(input.snapshots)[0] ?? null;
  const components = [
    availability(latest),
    chainIdentity(latest),
    headProgression(input.snapshots, input.motion ?? null),
    finality(input.wsProbe ?? null),
    latency(latest),
    transportParity(input.wsProbe ?? null),
    peerSync(input.wsProbe ?? null),
    reliability(input.reliability ?? null),
  ];
  const coverage = components.filter((c) => c.measured).reduce((a, c) => a + c.weight, 0);
  const earned = components.reduce((a, c) => a + (c.points ?? 0), 0);
  const score = coverage >= MIN_COVERAGE_TO_SCORE ? Math.round((100 * earned) / coverage) : null;
  return {
    formula: FORMULA_V2,
    score,
    band: score === null ? null : bandFor(score),
    coverage,
    components,
  };
}

function ageSeconds(nowMs, timestampSec) {
  if (timestampSec == null || !Number.isFinite(Number(timestampSec))) return null;
  return Math.round(nowMs / 1000 - Number(timestampSec));
}

function parsedSamples(samples) {
  return (samples ?? [])
    .map((s) => ({ h: parseHeight(s.height), at: s.atMs }))
    .filter((s) => s.h !== null && Number.isFinite(s.at))
    .sort((a, b) => b.at - a.at);
}

function stalledAcrossSamples(samples) {
  const parsed = parsedSamples(samples);
  if (parsed.length < 2) return null;
  const gap = Math.round((parsed[0].at - parsed[1].at) / 1000);
  const delta = parsed[0].h - parsed[1].h;
  if (gap >= HEAD_SAMPLE_STALL_SECONDS && delta === 0n) {
    return { height: parsed[0].h.toString(), gap };
  }
  return null;
}

/**
 * STALLED means the RPC answered and the best head and/or the finalized
 * head has not moved past a threshold. It is not DOWN: DOWN is reserved
 * for "nothing answered". Unknown means we cannot see motion yet (one
 * sample, no timestamp). The first observation is never an alert; callers
 * compare two assessments.
 */
export function assessStall(input = {}) {
  const nowMs = input.nowMs ?? Date.now();
  const bestAge = ageSeconds(nowMs, input.bestTimestampSec);
  const finAge = ageSeconds(nowMs, input.finalizedTimestampSec);
  const bestH = parseHeight(input.bestHeight) ?? parsedSamples(input.bestSamples)[0]?.h ?? null;
  const finH = parseHeight(input.finalizedHeight) ?? parsedSamples(input.finalizedSamples)[0]?.h ?? null;
  const lag = bestH !== null && finH !== null ? Number(bestH - finH) : null;
  const bestSample = stalledAcrossSamples(input.bestSamples);
  const finSample = stalledAcrossSamples(input.finalizedSamples);
  const base = {
    bestAgeSeconds: bestAge,
    finalizedAgeSeconds: finAge,
    finalityLagBlocks: lag,
    bestHeight: bestH ? bestH.toString() : null,
    finalizedHeight: finH ? finH.toString() : null,
    reasons: [],
    kind: null,
  };
  if (!input.rpcAnswered) {
    return {
      ...base,
      state: 'unknown',
      explanation: 'RPC did not answer, so a stall is not claimed. DOWN stays reserved for that case.',
    };
  }
  const reasons = [];
  if (bestAge !== null && bestAge >= BEST_STALL_AGE_SECONDS) {
    reasons.push(`best head #${base.bestHeight ?? 'unknown'} is ${bestAge}s old (threshold ${BEST_STALL_AGE_SECONDS}s)`);
  }
  if (bestSample) reasons.push(`best head #${bestSample.height} did not advance for ${bestSample.gap}s`);
  if (finAge !== null && finAge >= FINALIZED_STALL_AGE_SECONDS) {
    reasons.push(`finalized head #${base.finalizedHeight ?? 'unknown'} is ${finAge}s old (threshold ${FINALIZED_STALL_AGE_SECONDS}s)`);
  }
  if (finSample) reasons.push(`finalized head #${finSample.height} did not advance for ${finSample.gap}s`);
  if (lag !== null && lag >= FINALITY_STALL_LAG_BLOCKS && ((finAge !== null && finAge >= FINALITY_STALL_MIN_AGE_SECONDS) || finSample)) {
    reasons.push(`finality lag is ${lag} blocks and the finalized head is not moving`);
  }
  const bestStalled = reasons.some((r) => r.startsWith('best head'));
  const finStalled = reasons.some((r) => r.startsWith('finalized') || r.startsWith('finality'));
  if (reasons.length > 0) {
    const kind = bestStalled && finStalled ? 'both' : bestStalled ? 'best' : 'finalized';
    const lead = bestStalled
      ? 'STALLED: chain paused but RPC answers.'
      : 'STALLED: finality paused but RPC answers. The best head may still be moving.';
    return { ...base, state: 'stalled', kind, reasons, explanation: `${lead} ${reasons.join('; ')}.` };
  }
  const fresh = (bestAge !== null && bestAge < BEST_STALL_AGE_SECONDS && bestAge > -120) || parsedSamples(input.bestSamples).length >= 2 && !bestSample && parsedSamples(input.bestSamples)[0].h > parsedSamples(input.bestSamples)[1].h;
  if (fresh) {
    return {
      ...base,
      state: 'live',
      explanation: bestAge !== null
        ? `Best head is ${bestAge}s old, under the ${BEST_STALL_AGE_SECONDS}s stall threshold.`
        : 'Best head advanced between the two newest samples.',
    };
  }
  return {
    ...base,
    state: 'unknown',
    explanation: 'Not enough samples to say whether the head is moving. One check with no block timestamp is not a stall.',
  };
}

function escapeLabel(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function gauge(lines, name, help, value, labels) {
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} gauge`);
  if (value === null || value === undefined || Number.isNaN(value)) return;
  const labelText = labels && Object.keys(labels).length
    ? `{${Object.entries(labels).map(([k, v]) => `${k}="${escapeLabel(v)}"`).join(',')}}`
    : '';
  lines.push(`${name}${labelText} ${value}`);
}

/**
 * Prometheus text exposition 0.0.4. Gauges only. Missing signals are
 * omitted rather than reported as zero. `endpoint` is a host label, never
 * a URL with a secret.
 */
export function formatPrometheus(reading) {
  const lines = [];
  const verdict = reading.verdict ?? 'unknown';
  gauge(lines, 'nodescope_up', '1 if at least one read-only RPC check answered.', reading.up);
  if (reading.score !== null && reading.score !== undefined) {
    gauge(lines, 'nodescope_health_score', 'Health Score 0-100 using nodescope.health-score.v2.', reading.score, { formula: FORMULA_V2 });
  } else {
    lines.push('# HELP nodescope_health_score Health Score 0-100 using nodescope.health-score.v2.');
    lines.push('# TYPE nodescope_health_score gauge');
  }
  gauge(lines, 'nodescope_verdict', '1 for the current overall verdict.', 1, { verdict });
  gauge(lines, 'nodescope_stalled', '1 when the chain is paused but the RPC answers.', reading.stalled ? 1 : 0);
  gauge(lines, 'nodescope_best_block', 'Best head block number.', reading.bestBlock);
  gauge(lines, 'nodescope_finalized_block', 'Finalized head block number.', reading.finalizedBlock);
  gauge(lines, 'nodescope_finality_lag_blocks', 'Best head minus finalized head, in blocks.', reading.finalityLag);
  gauge(lines, 'nodescope_peers', 'Peer count from system_health.', reading.peers);
  if (reading.syncing !== null && reading.syncing !== undefined) {
    gauge(lines, 'nodescope_syncing', '1 when system_health reports the node is syncing.', reading.syncing ? 1 : 0);
  }
  gauge(lines, 'nodescope_best_head_age_seconds', 'Age of the best block timestamp, in seconds.', reading.bestAgeSeconds);
  if (reading.rpcSamples) {
    gauge(lines, 'nodescope_rpc_requests_total', 'Samples in the latest repeated-call probe.', reading.rpcSamples);
    gauge(lines, 'nodescope_rpc_errors_total', 'Failed samples in the latest repeated-call probe, including HTTP 5xx.', reading.rpcErrors ?? 0);
    gauge(lines, 'nodescope_rpc_error_ratio', 'Failed samples divided by samples.', reading.rpcSamples ? (reading.rpcErrors ?? 0) / reading.rpcSamples : null);
    gauge(lines, 'nodescope_rpc_latency_ms', 'Latency of repeated eth_blockNumber calls.', reading.rpcP50, { quantile: '0.5' });
    gauge(lines, 'nodescope_rpc_latency_ms', 'Latency of repeated eth_blockNumber calls.', reading.rpcP95, { quantile: '0.95' });
  }
  lines.push('');
  return lines.join('\n');
}

export function percentileMs(samples, p) {
  const ok = samples.filter((n) => typeof n === 'number' && Number.isFinite(n)).sort((a, b) => a - b);
  return percentile(ok, p);
}

const BADGE_COLORS = {
  healthy: '#1f8a4c',
  degraded: '#b58105',
  stalled: '#c2410c',
  down: '#b42318',
  not_checked: '#475569',
};

function xml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Shields-style SVG. `status` is a verdict word plus an optional score. */
export function renderBadgeSvg({ verdict = 'not_checked', score = null, detail = '' }) {
  const word = String(verdict).replace(/_/g, ' ').toUpperCase();
  const value = score === null || score === undefined ? word : `${word} ${score}`;
  const label = 'NodeScope';
  const labelW = Math.ceil(label.length * 6.4) + 16;
  const valueW = Math.ceil(value.length * 6.6) + 16;
  const width = labelW + valueW;
  const color = BADGE_COLORS[verdict] ?? BADGE_COLORS.not_checked;
  const title = detail ? `${label}: ${value}. ${detail}` : `${label}: ${value}. ${FORMULA_V2}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${xml(title)}">
  <title>${xml(title)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".12"/>
    <stop offset=".7" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="20" fill="#111827"/>
    <rect x="${labelW}" width="${valueW}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="11">
    <text x="${labelW / 2}" y="14">${xml(label)}</text>
    <text x="${labelW + valueW / 2}" y="14">${xml(value)}</text>
  </g>
</svg>
`;
}

export const BADGE_EVM_HOST = 'test-evm-rpc-v3.portaldot.dev';
export const BADGE_WSS_HOST = 'test-node-v3.portaldot.dev';
export const BADGE_CACHE_CONTROL = 'public, max-age=15, s-maxage=30, stale-while-revalidate=60';

/** Only the published Portaldot V3 testnet hosts. Anything else is rejected so the badge is not an open proxy. */
export function badgeTarget(searchParams) {
  const target = searchParams.get('target') || 'portaldot-v3-testnet';
  if (target !== 'portaldot-v3-testnet') return { ok: false, error: 'Unsupported target. The badge only checks portaldot-v3-testnet.' };
  const rpc = searchParams.get('rpc');
  const wss = searchParams.get('wss');
  const evm = rpc || `https://${BADGE_EVM_HOST}`;
  const ws = wss || `wss://${BADGE_WSS_HOST}`;
  let evmUrl;
  let wssUrl;
  try {
    evmUrl = new URL(evm);
    wssUrl = new URL(ws);
  } catch {
    return { ok: false, error: 'Endpoint URL is not valid.' };
  }
  if (evmUrl.protocol !== 'https:' || evmUrl.hostname !== BADGE_EVM_HOST) {
    return { ok: false, error: 'EVM host is not the published Portaldot V3 testnet RPC.' };
  }
  if (wssUrl.protocol !== 'wss:' || wssUrl.hostname !== BADGE_WSS_HOST) {
    return { ok: false, error: 'WSS host is not the published Portaldot V3 testnet node.' };
  }
  return { ok: true, evm: evmUrl.origin, wss: `wss://${wssUrl.host}` };
}
