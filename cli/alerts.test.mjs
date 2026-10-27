// CLI alert webhooks: pure helpers with a mocked fetch, plus the spawned
// CLI's usage errors. Real Discord/Slack hosts are never contacted.
import { describe, it, expect, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectWebhookKind, detectTransition, checkAlertText, postWebhook } from './lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = join(root, 'cli', 'nodescope.mjs');
const run = (args) =>
  new Promise((resolve) => {
    execFile('node', [cliPath, ...args], { cwd: root }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });

const down = {
  verdict: 'down',
  rpc: 'https://test-evm-rpc-v3.portaldot.dev',
  chainId: null,
  chainMismatch: false,
  blockNumber: null,
  checks: [{ method: 'eth_chainId', ok: false, value: null, error: 'timeout' }],
};

describe('CLI alert helpers', () => {
  it('matches the app on webhook kinds and transitions', () => {
    expect(detectWebhookKind('https://discord.com/api/webhooks/1/x')).toBe('discord');
    expect(detectWebhookKind('https://hooks.slack.com/services/T/B/x')).toBe('slack');
    expect(detectWebhookKind('http://hooks.slack.com/services/T/B/x')).toBeNull();
    expect(detectTransition(null, 'down')).toBeNull();
    expect(detectTransition('healthy', 'down')).toBe('degrade');
    expect(detectTransition('down', 'healthy')).toBe('recover');
    expect(detectTransition('degraded', 'degraded')).toBeNull();
  });

  it('writes a plain alert naming the failed checks', () => {
    const t = checkAlertText('degrade', 'healthy', down, new Date('2026-10-27T10:00:00Z'));
    expect(t).toContain('DEGRADED (healthy → down)');
    expect(t).toContain('Failed checks: eth_chainId');
    expect(t).toContain('Nothing was signed');
  });

  it('posts Discord and Slack bodies, and surfaces HTTP errors', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    await postWebhook('https://discord.com/api/webhooks/1/x', 'hi', f);
    expect(JSON.parse(f.mock.calls[0][1].body)).toMatchObject({ content: 'hi', username: 'NodeScope' });
    await postWebhook('https://hooks.slack.com/services/T/B/x', 'hi', f);
    expect(JSON.parse(f.mock.calls[1][1].body)).toEqual({ text: 'hi' });
    const bad = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(postWebhook('https://discord.com/api/webhooks/1/x', 'hi', bad)).rejects.toThrow(/404/);
  });
});

describe('CLI flags', () => {
  it('rejects a non-webhook --webhook and a --watch under 30 s with exit 2', async () => {
    const a = await run(['check', 'http://127.0.0.1:9', '--webhook', 'https://example.com/hook']);
    expect(a.code).toBe(2);
    expect(a.stderr).toMatch(/--webhook must be/);
    const b = await run(['check', 'http://127.0.0.1:9', '--watch', '5']);
    expect(b.code).toBe(2);
    expect(b.stderr).toMatch(/at least 30/);
  });
});
