// Cost gate: runs scripts/cost-gate.mjs for real (spawned node) against a
// local mock JSON-RPC server, and runs the composite action's own `run:`
// block from .github/actions/cost-gate/action.yml with bash, exactly as a
// GitHub runner would after input substitution — so the Action itself is
// exercised locally, not only the script behind it.
import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts', 'cost-gate.mjs');
const actionDir = join(root, '.github', 'actions', 'cost-gate');

function mockRpc(handlers) {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const p = JSON.parse(body);
      const h = handlers[p.method];
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: p.id, ...(h ?? { error: { code: -32601, message: 'Method not found' } }) }));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

// gas 1,000,000 × price 10^12 wei = 10^18 wei = exactly 1 tPOT.
const PRICED = {
  eth_estimateGas: { result: '0xf4240' },
  eth_gasPrice: { result: '0xe8d4a51000' },
  eth_blockNumber: { result: '0x34d1a' },
};

function run(cmd, args, env) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: root, env: { ...process.env, ...env } }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });
}

function workdir() {
  const dir = mkdtempSync(join(tmpdir(), 'cost-gate-'));
  const artifact = join(dir, 'Artifact.json');
  writeFileSync(artifact, JSON.stringify({ bytecode: { object: '0x6080604052' } }));
  return { dir, artifact, out: join(dir, 'out.txt'), summary: join(dir, 'summary.md') };
}

function outputs(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .trim()
      .split('\n')
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
}

describe('cost gate script', () => {
  it('passes within budget and writes outputs + a step summary', async () => {
    const { server, url } = await mockRpc(PRICED);
    const w = workdir();
    try {
      const r = await run('node', [script, '--artifact', w.artifact, '--max-tpot', '2', '--rpc', url], { GITHUB_OUTPUT: w.out, GITHUB_STEP_SUMMARY: w.summary });
      expect(r.code).toBe(0);
      expect(r.stdout).toMatch(/PASS — deploy costs 1 tPOT on evm \(block #216346\)/);
      const o = outputs(w.out);
      expect(o).toMatchObject({ cost_tpot: '1', max_tpot: '2', over: 'false', surface: 'evm', block: '216346' });
      expect(readFileSync(w.summary, 'utf8')).toContain('### NodeScope cost gate: PASS');
    } finally {
      server.close();
    }
  });

  it('fails over budget with exit 1', async () => {
    const { server, url } = await mockRpc(PRICED);
    const w = workdir();
    try {
      const r = await run('node', [script, '--artifact', w.artifact, '--max-tpot', '0.5', '--rpc', url], { GITHUB_OUTPUT: w.out });
      expect(r.code).toBe(1);
      expect(outputs(w.out).over).toBe('true');
    } finally {
      server.close();
    }
  });

  it('never passes an unpriceable deploy', async () => {
    const { server, url } = await mockRpc({ ...PRICED, eth_estimateGas: { error: { code: -32000, message: 'execution reverted' } } });
    const w = workdir();
    try {
      const r = await run('node', [script, '--artifact', w.artifact, '--max-tpot', '1000', '--rpc', url], { GITHUB_OUTPUT: w.out });
      expect(r.code).toBe(1);
      expect(r.stdout).toMatch(/could not be priced/);
      expect(outputs(w.out).over).toBe('unknown');
    } finally {
      server.close();
    }
  });

  it('exits 2 on missing budget or a bad artifact, with no invented price', async () => {
    const w = workdir();
    expect((await run('node', [script, '--artifact', w.artifact])).code).toBe(2);
    writeFileSync(w.artifact, JSON.stringify({ deployedBytecode: '0x6080' }));
    expect((await run('node', [script, '--artifact', w.artifact, '--max-tpot', '1'])).code).toBe(2);
  });
});

describe('cost gate composite action', () => {
  const yml = readFileSync(join(actionDir, 'action.yml'), 'utf8').replace(/\r\n/g, '\n');

  it('declares the inputs the script reads and maps them through env, not inline interpolation', () => {
    for (const input of ['artifact', 'max-tpot', 'rpc', 'surface', 'wss', 'from']) {
      expect(yml).toMatch(new RegExp(`\\n  ${input}:\\n`));
      const envName = `INPUT_${input.replace('-', '_').toUpperCase()}`;
      expect(yml).toContain(`${envName}: \${{ inputs.${input} }}`);
    }
    expect(yml).toContain("using: 'composite'");
  });

  it('runs its own run: block with bash and gates the deploy', async () => {
    const m = yml.match(/id: gate[\s\S]*?run: \|\n([\s\S]*)$/);
    expect(m).not.toBeNull();
    const runBlock = m[1].replace(/^ {8}/gm, '').trim();
    const { server, url } = await mockRpc(PRICED);
    const w = workdir();
    const env = {
      GITHUB_ACTION_PATH: actionDir,
      GITHUB_OUTPUT: w.out,
      INPUT_ARTIFACT: w.artifact,
      INPUT_RPC: url,
      INPUT_SURFACE: 'evm',
      INPUT_FROM: '0x03c502abb79e8eee50135c91933d059d982dd912',
    };
    try {
      const pass = await run('bash', ['-c', runBlock], { ...env, INPUT_MAX_TPOT: '1' });
      expect(pass.code).toBe(0);
      expect(outputs(w.out).over).toBe('false');
      const fail = await run('bash', ['-c', runBlock], { ...env, GITHUB_OUTPUT: join(w.dir, 'out2.txt'), INPUT_MAX_TPOT: '0.999999' });
      expect(fail.code).toBe(1);
      expect(outputs(join(w.dir, 'out2.txt')).over).toBe('true');
    } finally {
      server.close();
    }
  });
});
