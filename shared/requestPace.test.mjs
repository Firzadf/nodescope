import { afterEach, describe, expect, it } from 'vitest';
import { paceRequest, resetRequestPacer, setRequestGapMs } from './requestPace.mjs';

afterEach(() => {
  setRequestGapMs(0);
  resetRequestPacer();
});

describe('request pace', () => {
  it('spaces one endpoint under 5 requests per second and lets another endpoint start immediately', async () => {
    setRequestGapMs(40);
    const start = Date.now();
    await paceRequest('https://a.example/rpc');
    await paceRequest('https://a.example/rpc?x=1');
    await paceRequest('https://a.example/rpc');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(70);
    const other = Date.now();
    await paceRequest('wss://b.example/ws');
    expect(Date.now() - other).toBeLessThan(30);
  });
});
