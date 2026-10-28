import { describe, expect, it, vi } from 'vitest';
import { badgeResponse, liveBadgeStatus } from './badge.js';

function json(result, status = 200) {
  return { ok: status < 400, status, json: async () => ({ jsonrpc: '2.0', id: 1, result }) };
}

describe('live badge', () => {
  it('renders STALLED from an old timestamp and caches the svg', async () => {
    const nowMs = 1_793_191_554_000 + 120_000;
    const fetchImpl = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.method === 'eth_chainId') return json('0x190f1ca9');
      if (body.method === 'eth_blockNumber') return json('0x38ab3');
      if (body.method === 'eth_getBlockByNumber') return json({ number: '0x38ab3', timestamp: '0x6ae1ee82' });
      throw new Error(body.method);
    });
    const status = await liveBadgeStatus('https://test-evm-rpc-v3.portaldot.dev', null, { fetchImpl, nowMs });
    expect(status.verdict).toBe('stalled');
    expect(status.stall).toBe('stalled');
    const params = new URLSearchParams('target=portaldot-v3-testnet');
    const first = await badgeResponse(params, { fetchImpl, nowMs, bypassCache: true });
    expect(first.status).toBe(200);
    expect(first.svg).toContain('STALLED');
    expect(first.cache).toMatch(/s-maxage=30/);
    const calls = fetchImpl.mock.calls.length;
    const second = await badgeResponse(params, { fetchImpl, nowMs: nowMs + 1000 });
    expect(second.svg).toBe(first.svg);
    expect(fetchImpl.mock.calls.length).toBe(calls);
    const denied = await badgeResponse(new URLSearchParams('rpc=http://127.0.0.1/'));
    expect(denied.status).toBe(400);
    expect(denied.svg).toContain('NOT CHECKED');
    expect(denied.svg).not.toContain('169.254');
  });
});
