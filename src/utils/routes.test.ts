// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { resolveRoute, normalizePath } from './routes';

describe('resolveRoute', () => {
  it('resolves the landing, app, and public pages', () => {
    expect(resolveRoute('/')).toBe('landing');
    expect(resolveRoute('/index.html')).toBe('landing');
    expect(resolveRoute('/app')).toBe('app');
    expect(resolveRoute('/app/fee-lab')).toBe('app');
    expect(resolveRoute('/verify')).toBe('verify');
    expect(resolveRoute('/mainnet')).toBe('mainnet');
    expect(resolveRoute('/docs')).toBe('docs');
    expect(resolveRoute('/judges')).toBe('judges');
    expect(resolveRoute('/fees')).toBe('fees');
    expect(resolveRoute('/status')).toBe('status');
  });

  it('normalizes trailing slashes, including /app/fee-lab/ and /fees/', () => {
    expect(resolveRoute('/app/fee-lab/')).toBe('app');
    expect(resolveRoute('/fees/')).toBe('fees');
    expect(resolveRoute('/app/')).toBe('app');
    expect(resolveRoute('/verify/')).toBe('verify');
    expect(normalizePath('/fees/')).toBe('/fees');
    expect(normalizePath('/')).toBe('/');
  });

  it('falls back to not-found for unknown paths without prefix confusion', () => {
    expect(resolveRoute('/unknown')).toBe('not-found');
    expect(resolveRoute('/appx')).toBe('not-found');
    expect(resolveRoute('/fees/extra')).toBe('not-found');
    expect(resolveRoute('/fee-lab')).toBe('not-found');
  });
});
