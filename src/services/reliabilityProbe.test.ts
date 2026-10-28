import { afterEach, describe, expect, it, vi } from 'vitest';
import { runReliabilityProbe } from './reliabilityProbe';
import { READ_ONLY_PROBE_METHODS } from '../utils/rpcSecurity';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('runReliabilityProbe', () => {
  it('counts failures, classifies history, and never calls an unsafe method', async () => {
    const called: string[] = [];
    let n = 0;
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { method: string; params: unknown[] };
      called.push(body.method);
      n += 1;
      if (body.method === 'eth_blockNumber' && n === 1) {
        return { ok: false, status: 503, statusText: 'Service Unavailable', text: async () => '' };
      }
      if (body.method === 'eth_blockNumber') {
        return { ok: true, status: 200, text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x30000' }) };
      }
      if (body.method === 'eth_getBlockByNumber') {
        return { ok: true, status: 200, text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: { number: body.params[0] } }) };
      }
      if (body.method === 'eth_getBalance') {
        return { ok: true, status: 200, text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'missing trie node' } }) };
      }
      if (body.method === 'rpc_methods') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: { methods: ['eth_blockNumber', 'author_insertKey', 'eth_sendRawTransaction'] } }),
        };
      }
      throw new Error(`unexpected ${body.method}`);
    });
    const report = await runReliabilityProbe('https://rpc.example.test', { samples: 3, timeoutMs: 1000 });
    expect(report.samples).toBe(3);
    expect(report.errors).toBe(1);
    expect(report.http5xx).toBe(1);
    expect(report.history).toBe('pruned-state');
    expect(report.unsafe.map((m) => m.method)).toEqual(['author_insertKey']);
    expect(report.stateChanging.map((m) => m.method)).toEqual(['eth_sendRawTransaction']);
    expect(called.every((method) => (READ_ONLY_PROBE_METHODS as readonly string[]).includes(method))).toBe(true);
    expect(called).not.toContain('author_insertKey');
    expect(report.exposedMethodsWithheld).toBe(false);
  });

  it('withholds exposed-method names on an official Portaldot host', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { method: string };
      if (body.method === 'eth_blockNumber') {
        return { ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x10' }) };
      }
      if (body.method === 'rpc_methods') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: { methods: ['eth_blockNumber', 'dev_exampleProbe'] } }),
        };
      }
      return { ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: null }) };
    });
    const report = await runReliabilityProbe('https://test-evm-rpc-v3.portaldot.dev', { samples: 1, timeoutMs: 1000 });
    expect(report.exposedMethodsWithheld).toBe(true);
    expect(report.exposedMethodsNote).toMatch(/withheld pending responsible disclosure/);
    expect(report.unsafe).toEqual([]);
    expect(report.stateChanging).toEqual([]);
    expect(JSON.stringify(report)).not.toContain('dev_exampleProbe');
  });
});
