// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  alertText,
  buildWebhookBody,
  detectTransition,
  detectWebhookKind,
  loadWebhookUrl,
  maskWebhookUrl,
  saveWebhookUrl,
  sendWebhook,
  WEBHOOK_STORAGE_KEY,
  type AlertEvent,
} from './alertWebhook';

const DISCORD = 'https://discord.com/api/webhooks/123456789/abcdefSECRET';
const SLACK = 'https://hooks.slack.com/services/T000/B000/XXXXSECRET';

const event: AlertEvent = {
  kind: 'degrade',
  from: 'healthy',
  to: 'degraded',
  endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
  blockHeight: '216346',
  score: 72,
  coverage: 100,
  at: new Date('2026-10-27T10:00:00Z'),
};

afterEach(() => {
  localStorage.clear();
});

describe('alert webhooks', () => {
  it('recognizes Discord and Slack webhooks, https only', () => {
    expect(detectWebhookKind(DISCORD)).toBe('discord');
    expect(detectWebhookKind('https://discordapp.com/api/webhooks/1/x')).toBe('discord');
    expect(detectWebhookKind(SLACK)).toBe('slack');
    expect(detectWebhookKind('http://discord.com/api/webhooks/1/x')).toBeNull();
    expect(detectWebhookKind('https://evil.example/api/webhooks/1/x')).toBeNull();
    expect(detectWebhookKind('https://discord.com/channels/1')).toBeNull();
    expect(detectWebhookKind('not a url')).toBeNull();
  });

  it('masks the secret part of the URL for display', () => {
    const masked = maskWebhookUrl(DISCORD);
    expect(masked).not.toContain('SECRET');
    expect(masked).toContain('discord.com');
  });

  it('fires only on real transitions, never on not_checked or the baseline', () => {
    expect(detectTransition(null, 'down')).toBeNull();
    expect(detectTransition('not_checked', 'healthy')).toBeNull();
    expect(detectTransition('healthy', 'not_checked')).toBeNull();
    expect(detectTransition('healthy', 'healthy')).toBeNull();
    expect(detectTransition('healthy', 'degraded')).toBe('degrade');
    expect(detectTransition('degraded', 'down')).toBe('degrade');
    expect(detectTransition('down', 'degraded')).toBe('recover');
    expect(detectTransition('degraded', 'healthy')).toBe('recover');
  });

  it('builds host-specific bodies with the real values and no mentions', () => {
    const d = buildWebhookBody('discord', event);
    expect(d.content).toContain('DEGRADED (healthy → degraded)');
    expect(d.content).toContain('216346');
    expect(d.content).toContain('72/100');
    expect(d.allowed_mentions).toEqual({ parse: [] });
    const s = buildWebhookBody('slack', event);
    expect(s.text).toBe(alertText(event));
    expect(alertText({ ...event, score: null })).toContain('not scored');
  });

  it('stores the URL in localStorage only, and removes it', () => {
    saveWebhookUrl(DISCORD);
    expect(localStorage.getItem(WEBHOOK_STORAGE_KEY)).toBe(DISCORD);
    expect(loadWebhookUrl()).toBe(DISCORD);
    saveWebhookUrl('');
    expect(loadWebhookUrl()).toBe('');
  });

  it('reports delivered when the host answers', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    const out = await sendWebhook(DISCORD, event, f);
    expect(out).toEqual({ status: 'delivered', httpStatus: 204 });
    const [, init] = f.mock.calls[0];
    expect(JSON.parse(init.body).content).toContain('NodeScope');
  });

  it('falls back to a no-cors form post and says delivery is unconfirmed', async () => {
    const f = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: false, status: 0, type: 'opaque' });
    const out = await sendWebhook(SLACK, event, f);
    expect(out.status).toBe('sent_unconfirmed');
    const [, init] = f.mock.calls[1];
    expect(init.mode).toBe('no-cors');
    expect(String(init.body)).toMatch(/^payload=/);
  });

  it('refuses non-webhook URLs without any network call', async () => {
    const f = vi.fn();
    const out = await sendWebhook('https://example.com/hook', event, f);
    expect(out.status).toBe('failed');
    expect(f).not.toHaveBeenCalled();
  });

  it('reports an HTTP error honestly', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const out = await sendWebhook(DISCORD, event, f);
    expect(out).toEqual({ status: 'failed', reason: 'Webhook answered HTTP 404.' });
  });
});
