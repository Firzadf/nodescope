import { describe, expect, it, vi } from 'vitest';
import { statusResponse } from './status.js';

function json(result) {
  return { ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: 1, result }) };
}

describe('status JSON', () => {
  it('returns the live badge fields and refuses another host', async () => {
    const nowMs = 1_793_191_554_000 + 120_000;
    const fetchImpl = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.method === 'eth_chainId') return json('0x190f1ca9');
      if (body.method === 'eth_blockNumber') return json('0x38ab3');
      if (body.method === 'eth_getBlockByNumber') return json({ number: '0x38ab3', timestamp: '0x6ae1ee82' });
      throw new Error(body.method);
    });
    const out = await statusResponse(new URLSearchParams('target=portaldot-v3-testnet'), {
      fetchImpl,
      nowMs,
      bypassCache: true,
    });
    expect(out.status).toBe(200);
    expect(out.body.verdict).toBe('stalled');
    expect(out.body.bestHeight).toBe('232115');
    expect(out.body.formula).toBe('nodescope.health-score.v2');
    expect(out.body.evm).toBe('https://test-evm-rpc-v3.portaldot.dev');
    const denied = await statusResponse(new URLSearchParams('target=portaldot-v3-testnet&rpc=https://rpc.example.test'));
    expect(denied.status).toBe(400);
  });
});
