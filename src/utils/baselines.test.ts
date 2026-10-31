import { describe, expect, it } from 'vitest';
import { BASELINE_MAX_ENDPOINTS, BASELINE_MAX_SAMPLES, compareToBaseline, readBaselines, recordBaseline } from './baselines';

function memory() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe('local baselines', () => {
  it('says latency is 40% slower than the 24h baseline and than yesterday', () => {
    const now = 1_800_000_000_000;
    const history = [1, 2, 3, 4].map((h) => ({
      at: now - h * 60 * 60 * 1000,
      score: 96,
      latencyMs: 100,
      bestHeight: '1000',
      finalityLag: 2,
    }));
    history.push({
      at: now - 30 * 60 * 60 * 1000,
      score: 96,
      latencyMs: 100,
      bestHeight: '900',
      finalityLag: 2,
    });
    const current = {
      at: now,
      score: 90,
      latencyMs: 140,
      bestHeight: '1100',
      finalityLag: 6,
    };
    const lines = compareToBaseline(current, history, now).lines;
    expect(lines.some((l) => l.startsWith('Latency 40% slower than your 24h baseline'))).toBe(true);
    expect(lines.some((l) => l.startsWith('Latency 40% slower than yesterday'))).toBe(true);
    expect(lines.some((l) => l.includes('6 points below'))).toBe(true);
    expect(lines.some((l) => l.includes('4 blocks above'))).toBe(true);
  });

  it('keeps samples per endpoint, bounded, and does not mix origins', () => {
    const box = memory();
    const now = 1_800_000_000_000;
    for (let i = 0; i < BASELINE_MAX_SAMPLES + 40; i += 1) {
      recordBaseline('https://a.example/secret?token=1', {
        at: now - i * 1000,
        score: 90,
        latencyMs: 100,
        bestHeight: String(1000 + i),
        finalityLag: 1,
      }, box, now);
    }
    recordBaseline('https://user:pw@b.example/rpc', {
      at: now,
      score: 80,
      latencyMs: 50,
      bestHeight: '5',
      finalityLag: 1,
    }, box, now);
    const a = readBaselines('https://a.example', box, now);
    const b = readBaselines('https://b.example', box, now);
    expect(a.length).toBe(BASELINE_MAX_SAMPLES);
    expect(a.every((s) => s.latencyMs === 100)).toBe(true);
    expect(b).toHaveLength(1);
    expect(JSON.stringify(box.getItem('nodescope.baselines.v1'))).not.toContain('token');
    expect(JSON.stringify(box.getItem('nodescope.baselines.v1'))).not.toContain('user:pw');
  });

  it('drops the oldest endpoint when the cap is passed', () => {
    const box = memory();
    const now = 1_800_000_000_000;
    for (let i = 0; i < BASELINE_MAX_ENDPOINTS + 2; i += 1) {
      recordBaseline(`https://n${i}.example`, {
        at: now + i,
        score: 90,
        latencyMs: 100,
        bestHeight: '1',
        finalityLag: 1,
      }, box, now + i);
    }
    expect(readBaselines('https://n0.example', box, now + 20)).toHaveLength(0);
    expect(readBaselines('https://n9.example', box, now + 20)).toHaveLength(1);
  });

  it('says when there is not enough history', () => {
    const lines = compareToBaseline({
      at: 10,
      score: 90,
      latencyMs: 140,
      bestHeight: '1',
      finalityLag: 1,
    }, [], 10).lines;
    expect(lines[0]).toContain('this browser only');
  });
});
