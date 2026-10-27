// RPC endpoint benchmark: two local mock JSON-RPC servers, one on the
// Portaldot chain and one on a different chain, plus a dead port.
import { describe, it, expect } from 'vitest';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { benchEndpoints } from './lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = join(root, 'cli', 'nodescope.mjs');

function mock(chainHex, headHex) {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const p = JSON.parse(body);
      const result = p.method === 'eth_chainId' ? chainHex : p.method === 'eth_blockNumber' ? headHex : null;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: p.id, result }));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

const run = (args) =>
  new Promise((resolve) => {
    execFile('node', [cliPath, ...args], { cwd: root }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });

describe('bench', () => {
  it('reports latency percentiles, head spread, and agreeing chain ids', async () => {
    const a = await mock('0x190f1ca9', '0x34d1a');
    const b = await mock('0x190f1ca9', '0x34d1c');
    try {
      const out = await benchEndpoints([a.url, b.url], { samples: 3 });
      expect(out.endpoints).toHaveLength(2);
      for (const e of out.endpoints) {
        expect(e.ok).toBe(3);
        expect(e.p50Ms).not.toBeNull();
        expect(e.p95Ms).toBeGreaterThanOrEqual(e.p50Ms);
        expect(e.chainId).toBe(420420777);
      }
      expect(out.consistency).toEqual({ chainIdsAgree: true, chainIds: [420420777], headSpread: 2, expectedChain: true });
      expect([a.url, b.url]).toContain(out.fastest);
    } finally {
      a.server.close();
      b.server.close();
    }
  });

  it('flags disagreeing chains and dead endpoints, and exits 1 from the CLI', async () => {
    const a = await mock('0x190f1ca9', '0x10');
    const other = await mock('0x1', '0x10');
    try {
      const out = await benchEndpoints([a.url, other.url, 'http://127.0.0.1:9'], { samples: 1, timeoutMs: 1000 });
      expect(out.consistency.chainIdsAgree).toBe(false);
      expect(out.endpoints[2].ok).toBe(0);
      expect(out.endpoints[2].errors).toBe(1);
      expect(out.endpoints[2].p50Ms).toBeNull();
      const cli = await run(['bench', a.url, other.url, '--samples', '1', '--json']);
      expect(cli.code).toBe(1);
      expect(JSON.parse(cli.stdout).consistency.chainIdsAgree).toBe(false);
      const ok = await run(['bench', a.url, '--samples', '2']);
      expect(ok.code).toBe(0);
      expect(ok.stdout).toMatch(/chain ids agree/);
      expect((await run(['bench', a.url, '--samples', '0'])).code).toBe(2);
    } finally {
      a.server.close();
      other.server.close();
    }
  });
});
