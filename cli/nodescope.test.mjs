// CLI tests: pure helpers + mocked RPC + real spawned CLI against a local
// mock HTTP server. The native leg is covered only for its honest
// unavailable path (closed WSS port); the live two-leg path is the Fee
// Lab's own suite plus the manual estimate script, not something a unit
// test can fake without a Substrate node.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseArtifact,
  formatTpot,
  parseTpot,
  compareDeployCosts,
  budgetCheck,
  checkNode,
} from './lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = join(root, 'cli', 'nodescope.mjs');

afterEach(() => {
  vi.unstubAllGlobals();
});

function runCli(args) {
  return new Promise((resolve) => {
    execFile('node', [cliPath, ...args], { cwd: root }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });
}

/** Minimal JSON-RPC mock: methods map to canned results or errors. */
function mockRpc(handlers) {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      const handler = handlers[parsed.method];
      const payload = typeof handler === 'function' ? handler(parsed) : handler;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: parsed.id, ...payload }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe('parseArtifact', () => {
  it('reads a solc artifact (evm.bytecode.object) plus constructorArgs', () => {
    const parsed = parseArtifact(
      JSON.stringify({ evm: { bytecode: { object: '0x608060' } }, constructorArgs: '0x0001' }),
    );
    expect(parsed).toEqual({ bytecode: '0x608060', constructorData: '0x0001' });
  });

  it('reads flat bytecode and bytecode.object forms', () => {
    expect(parseArtifact(JSON.stringify({ bytecode: '0x6080' }))).toEqual({ bytecode: '0x6080', constructorData: '' });
    expect(parseArtifact(JSON.stringify({ bytecode: { object: '0x6080' } }))).toEqual({ bytecode: '0x6080', constructorData: '' });
  });

  it('accepts raw 0x bytecode text', () => {
    expect(parseArtifact('0x608060')).toEqual({ bytecode: '0x608060', constructorData: '' });
  });

  it('rejects deployedBytecode-only artifacts with a plain-language reason', () => {
    expect(() => parseArtifact(JSON.stringify({ deployedBytecode: '0x6080' }))).toThrow(/deployedBytecode.*creation bytecode/);
  });

  it('rejects invalid JSON and non-hex bytecode with clear messages', () => {
    expect(() => parseArtifact('not json, not hex')).toThrow(/not valid JSON/);
    expect(() => parseArtifact(JSON.stringify({ bytecode: 'zz' }))).toThrow(/0x-prefixed hex/);
    expect(() => parseArtifact(JSON.stringify({ bytecode: '0x6080', constructorArgs: 'nope' }))).toThrow(/constructorArgs/);
  });
});

describe('units and comparison', () => {
  it('formats and parses tPOT amounts', () => {
    expect(formatTpot(10n ** 14n)).toBe('1');
    expect(formatTpot(150000000000000n)).toBe('1.5');
    expect(parseTpot('1')).toBe(10n ** 14n);
    expect(() => parseTpot('abc')).toThrow();
  });

  it('applies the 2% tie band and the fee-only ratio', () => {
    const evm = { status: 'ok', method: 'eth_estimateGas (create)', gas: '1', gasPrice: '1', feeWei: '1', totalPlanck: '100', blockNumber: 1 };
    const native = { status: 'ok', method: 'revive.instantiateWithCode', partialFee: '1', storageDeposit: '99', totalPlanck: '101', weight: { refTime: '1', proofSize: '1' }, blockNumber: 1 };
    const c = compareDeployCosts(evm, native);
    expect(c.recommended).toBe('either');
    expect(c.ratioAllIn).toBeCloseTo(100 / 101, 6);
    expect(c.ratioVsNativeFeeOnly).toBe(100);
    expect(c.reason).toMatch(/within 2%/);
  });

  it('recommends the only available leg, honestly', () => {
    const evm = { status: 'ok', method: 'eth_estimateGas (create)', gas: '1', gasPrice: '1', feeWei: '1', totalPlanck: '100', blockNumber: 1 };
    const native = { status: 'unavailable', method: 'revive.instantiateWithCode', reason: 'timed out' };
    const c = compareDeployCosts(evm, native);
    expect(c.recommended).toBe('evm');
    expect(c.reason).toMatch(/Only EVM is available/);
  });

  it('checks the budget against the priced cost', () => {
    expect(budgetCheck(10n ** 14n, '2').over).toBe(false);
    expect(budgetCheck(3n * 10n ** 14n, '2').over).toBe(true);
  });
});

describe('checkNode verdicts (mocked fetch)', () => {
  const okFetch = (results) => async () => ({
    ok: true,
    json: async () => ({ jsonrpc: '2.0', id: 1, result: results.shift() }),
  });

  it('is healthy when every method answers and the chain id matches', async () => {
    vi.stubGlobal('fetch', okFetch(['0x190f1ca9', '0x10', 'test-client/1.0', '420420777']));
    const r = await checkNode('http://127.0.0.1:9');
    expect(r.verdict).toBe('healthy');
    expect(r.chainId).toBe(420420777);
    expect(r.blockNumber).toBe(16);
  });

  it('is degraded on a chain id mismatch', async () => {
    vi.stubGlobal('fetch', okFetch(['0x1', '0x10', 'test-client/1.0', '1']));
    const r = await checkNode('http://127.0.0.1:9');
    expect(r.verdict).toBe('degraded');
    expect(r.chainMismatch).toBe(true);
  });

  it('is down when nothing answers', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('fetch failed');
    });
    const r = await checkNode('http://127.0.0.1:9', { timeoutMs: 50 });
    expect(r.verdict).toBe('down');
    expect(r.checks.every((c) => !c.ok)).toBe(true);
  });
});

describe('spawned CLI against a mock RPC server', () => {
  it('check exits 0 on healthy and 1 on down, with a verdict JSON', async () => {
    const { server, url } = await mockRpc({
      eth_chainId: { result: '0x190f1ca9' },
      eth_blockNumber: { result: '0x20' },
      web3_clientVersion: { result: 'test-client/1.0' },
      net_version: { result: '420420777' },
    });
    try {
      const healthy = await runCli(['check', url, '--json']);
      expect(healthy.code).toBe(0);
      expect(JSON.parse(healthy.stdout).verdict).toBe('healthy');
    } finally {
      server.close();
    }
    const down = await runCli(['check', 'http://127.0.0.1:9', '--json', '--timeout-ms', '50']);
    expect(down.code).toBe(1);
    expect(JSON.parse(down.stdout).verdict).toBe('down');
  });

  it('fees prices the EVM leg from the mock and enforces --max-tpot', async () => {
    const { server, url } = await mockRpc({
      eth_estimateGas: { result: '0x100000' },
      eth_gasPrice: { result: '0x1000' },
      eth_blockNumber: { result: '0x20' },
    });
    const artifactPath = join(tmpdir(), `nodescope-test-artifact-${Date.now()}.json`);
    writeFileSync(artifactPath, JSON.stringify({ bytecode: '0x608060' }));
    try {
      const ok = await runCli(['fees', '--artifact', artifactPath, '--evm-rpc', url, '--evm-only', '--json']);
      expect(ok.code).toBe(0);
      const parsed = JSON.parse(ok.stdout);
      expect(parsed.evm.status).toBe('ok');
      // gas 0x100000 * gasPrice 0x1000 = 0x100000000 wei = 10^8 * 10^4 planck? No:
      // feeWei 4294967296 wei -> planck = wei / 10^4 = 429496 planck (truncated).
      expect(parsed.evm.totalPlanck).toBe('429496');
      expect(parsed.native.reason).toMatch(/evm-only/);
      const over = await runCli(['fees', '--artifact', artifactPath, '--evm-rpc', url, '--evm-only', '--json', '--max-tpot', '0.000000001']);
      expect(over.code).toBe(1);
      expect(JSON.parse(over.stdout).budget.over).toBe(true);
    } finally {
      server.close();
      unlinkSync(artifactPath);
    }
  });

  it('fees exits 2 on an invalid artifact, never with an invented price', async () => {
    const artifactPath = join(tmpdir(), `nodescope-bad-artifact-${Date.now()}.json`);
    writeFileSync(artifactPath, JSON.stringify({ deployedBytecode: '0x6080' }));
    try {
      const r = await runCli(['fees', '--artifact', artifactPath, '--evm-only']);
      expect(r.code).toBe(2);
      expect(r.stderr).toMatch(/deployedBytecode/);
      expect(r.stdout).not.toMatch(/totalPlanck/);
    } finally {
      unlinkSync(artifactPath);
    }
  });

  it('fees reports a closed WSS port as an honest native warning, not a hang', async () => {
    const { server, url } = await mockRpc({
      eth_estimateGas: { result: '0x100000' },
      eth_gasPrice: { result: '0x1000' },
      eth_blockNumber: { result: '0x20' },
    });
    const artifactPath = join(tmpdir(), `nodescope-wss-artifact-${Date.now()}.json`);
    writeFileSync(artifactPath, JSON.stringify({ bytecode: '0x608060' }));
    try {
      const r = await runCli(['fees', '--artifact', artifactPath, '--evm-rpc', url, '--wss', 'ws://127.0.0.1:9', '--json', '--connect-timeout-ms', '3000', '--estimate-timeout-ms', '3000']);
      expect(r.code).toBe(0);
      const parsed = JSON.parse(r.stdout);
      expect(parsed.evm.status).toBe('ok');
      expect(parsed.native.status).toBe('unavailable');
      expect(parsed.recommended).toBe('evm');
    } finally {
      server.close();
      unlinkSync(artifactPath);
    }
  }, 60000);
});
