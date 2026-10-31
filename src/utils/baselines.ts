/**
 * Local baselines for one browser. Samples never leave the machine:
 * there is no server write, and the key is the endpoint origin only.
 */
import { sanitizeEndpointOrigin } from './reportBuilder';

export const BASELINES_KEY = 'nodescope.baselines.v1';
export const BASELINE_MAX_SAMPLES = 200;
export const BASELINE_MAX_ENDPOINTS = 8;
export const BASELINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface BaselineSample {
  at: number;
  score: number | null;
  latencyMs: number | null;
  bestHeight: string | null;
  finalityLag: number | null;
  /** Absolute EVM-minus-Substrate head gap, when both were read. */
  headGap?: number | null;
}

interface BaselineStore {
  schema: typeof BASELINES_KEY;
  endpoints: Record<string, BaselineSample[]>;
}

type Box = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function boxOf(storage?: Box): Box | null {
  if (storage) return storage;
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function emptyStore(): BaselineStore {
  return { schema: BASELINES_KEY, endpoints: {} };
}

function isSample(value: unknown): value is BaselineSample {
  if (!value || typeof value !== 'object') return false;
  const s = value as BaselineSample;
  return typeof s.at === 'number' && Number.isFinite(s.at);
}

function readStore(storage?: Box): BaselineStore {
  const box = boxOf(storage);
  if (!box) return emptyStore();
  try {
    const raw = box.getItem(BASELINES_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as BaselineStore;
    if (!parsed || typeof parsed !== 'object' || !parsed.endpoints) return emptyStore();
    const endpoints: Record<string, BaselineSample[]> = {};
    for (const [key, samples] of Object.entries(parsed.endpoints)) {
      if (!Array.isArray(samples)) continue;
      endpoints[key] = samples.filter(isSample);
    }
    return { schema: BASELINES_KEY, endpoints };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: BaselineStore, storage?: Box): void {
  const box = boxOf(storage);
  if (!box) return;
  try {
    box.setItem(BASELINES_KEY, JSON.stringify(store));
  } catch {
    // Quota or private mode: the comparison simply has nothing new to say.
  }
}

function prune(samples: BaselineSample[], now: number): BaselineSample[] {
  const fresh = samples.filter((s) => now - s.at <= BASELINE_MAX_AGE_MS && s.at <= now + 60_000);
  fresh.sort((a, b) => a.at - b.at);
  const dedup = new Map<number, BaselineSample>();
  for (const sample of fresh) dedup.set(sample.at, sample);
  return [...dedup.values()].slice(-BASELINE_MAX_SAMPLES);
}

function endpointKey(origin: string): string | null {
  const key = sanitizeEndpointOrigin(origin);
  if (!key || key === 'invalid-url') return null;
  return key;
}

export function recordBaseline(origin: string, sample: BaselineSample, storage?: Box, now = Date.now()): void {
  const key = endpointKey(origin);
  if (!key || !isSample(sample)) return;
  const store = readStore(storage);
  const next = prune([...(store.endpoints[key] ?? []), sample], now);
  store.endpoints[key] = next;
  const keys = Object.keys(store.endpoints);
  if (keys.length > BASELINE_MAX_ENDPOINTS) {
    const ranked = keys
      .map((k) => ({ k, at: store.endpoints[k][store.endpoints[k].length - 1]?.at ?? 0 }))
      .sort((a, b) => a.at - b.at);
    for (const drop of ranked.slice(0, keys.length - BASELINE_MAX_ENDPOINTS)) {
      delete store.endpoints[drop.k];
    }
  }
  writeStore(store, storage);
}

export function readBaselines(origin: string, storage?: Box, now = Date.now()): BaselineSample[] {
  const key = endpointKey(origin);
  if (!key) return [];
  return prune(readStore(storage).endpoints[key] ?? [], now);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentOff(current: number, base: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(base) || base <= 0) return null;
  return Math.round(((current - base) / base) * 100);
}

function latencyLine(current: number, base: number, phrase: '24h baseline' | 'yesterday'): string | null {
  const pct = percentOff(current, base);
  if (pct === null || Math.abs(pct) < 10) return null;
  const direction = pct > 0 ? 'slower' : 'faster';
  const against = phrase === 'yesterday' ? 'yesterday' : 'your 24h baseline';
  return `Latency ${Math.abs(pct)}% ${direction} than ${against} (${Math.round(current)} ms now, ${Math.round(base)} ms median).`;
}

export interface BaselineComparison {
  lines: string[];
}

/**
 * Compare the current reading with earlier samples on the same endpoint.
 * Pass samples that already exclude the current reading, or pass `current.at`
 * and this function will drop that timestamp.
 */
export function compareToBaseline(
  current: BaselineSample,
  samples: BaselineSample[],
  now = Date.now(),
): BaselineComparison {
  const history = samples.filter((s) => s.at !== current.at && s.at <= now);
  const day = history.filter((s) => s.at >= now - DAY_MS);
  const yesterday = history.filter((s) => s.at >= now - 2 * DAY_MS && s.at < now - DAY_MS);
  const lines: string[] = [];
  if (current.latencyMs !== null && day.filter((s) => s.latencyMs !== null).length >= 2) {
    const base = median(day.map((s) => s.latencyMs).filter((n): n is number => n !== null));
    const line = base === null ? null : latencyLine(current.latencyMs, base, '24h baseline');
    if (line) lines.push(line);
  }
  if (current.latencyMs !== null && yesterday.some((s) => s.latencyMs !== null)) {
    const base = median(yesterday.map((s) => s.latencyMs).filter((n): n is number => n !== null));
    const line = base === null ? null : latencyLine(current.latencyMs, base, 'yesterday');
    if (line) lines.push(line);
  }
  if (current.score !== null && day.filter((s) => s.score !== null).length >= 2) {
    const base = median(day.map((s) => s.score).filter((n): n is number => n !== null));
    if (base !== null && Math.abs(current.score - base) >= 2) {
      const direction = current.score < base ? 'below' : 'above';
      lines.push(`Score is ${Math.abs(Math.round(current.score - base))} points ${direction} your 24h median (${Math.round(base)}).`);
    }
  }
  if (current.finalityLag !== null && day.filter((s) => s.finalityLag !== null).length >= 2) {
    const base = median(day.map((s) => s.finalityLag).filter((n): n is number => n !== null));
    if (base !== null && Math.abs(current.finalityLag - base) >= 2) {
      const direction = current.finalityLag > base ? 'above' : 'below';
      lines.push(`Finality lag is ${Math.abs(Math.round(current.finalityLag - base))} blocks ${direction} your 24h median (median ${Math.round(base)}).`);
    }
  }
  const oldestDay = [...day].sort((a, b) => a.at - b.at).find((s) => s.bestHeight);
  if (current.bestHeight && oldestDay?.bestHeight && now - oldestDay.at >= 60 * 60 * 1000) {
    try {
      const delta = BigInt(current.bestHeight) - BigInt(oldestDay.bestHeight);
      if (delta === 0n) {
        lines.push('Best head has not moved against your local baseline from the last day.');
      } else if (delta > 0n) {
        lines.push(`Best head is ${delta.toString()} blocks ahead of your earlier sample in this 24h window.`);
      }
    } catch {
      // Heights that are not integers are skipped. No invented delta.
    }
  }
  if (lines.length === 0) {
    lines.push('Not enough local history yet for this endpoint. Samples stay in this browser only.');
  }
  return { lines };
}
