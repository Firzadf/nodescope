import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { discoverCapabilities } from './capabilityDiscovery';

describe('discoverCapabilities', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('handles direct array shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ jsonrpc: '2.0', result: ['eth_chainId', 'system_health'], id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const snapshot = await discoverCapabilities('https://example.com');
    expect(snapshot.discoveryStatus).toBe('success');
    expect(snapshot.safeAdvertisedMethods.map((m) => m.method)).toEqual(['eth_chainId', 'system_health']);
    expect(snapshot.safeAdvertisedMethods.every((m) => m.evidence === 'advertised')).toBe(true);
    expect(snapshot.error).toBeNull();
    expect(snapshot.endpointOrigin).toBe('https://example.com');
  });

  it('handles object with methods array shape', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ jsonrpc: '2.0', result: { methods: ['eth_chainId', 'system_version'], version: 1 }, id: 1 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const snapshot = await discoverCapabilities('https://example.com');
    expect(snapshot.discoveryStatus).toBe('success');
    expect(snapshot.safeAdvertisedMethods.map((m) => m.method)).toEqual(['eth_chainId', 'system_version']);
  });

  it('deduplicates and drops malformed entries', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: ['eth_chainId', 'eth_chainId', '', '   ', 123, null, 'eth_chainId', 'system_health', 'bad-method!'],
          id: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const snapshot = await discoverCapabilities('https://example.com');
    expect(snapshot.discoveryStatus).toBe('success');
    expect(snapshot.safeAdvertisedMethods.map((m) => m.method)).toEqual(['eth_chainId', 'system_health']);
    expect(snapshot.rawMethodCount).toBe(2);
  });

  it('handles empty list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ jsonrpc: '2.0', result: [], id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const snapshot = await discoverCapabilities('https://example.com');
    expect(snapshot.discoveryStatus).toBe('success');
    expect(snapshot.safeAdvertisedMethods).toEqual([]);
    expect(snapshot.rawMethodCount).toBe(0);
  });

  it('caps oversized lists', async () => {
    const huge = Array.from({ length: 600 }, (_, i) => `m_${i}`);
    // Make them pass sanitization by using allowlisted names repeatedly plus unique suffixes won't pass allowlist;
    // instead fill with a large deduped set of valid-looking but non-allowlisted names plus a few allowlisted ones at end.
    const payload = [...huge, 'eth_chainId', 'system_health'];
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ jsonrpc: '2.0', result: payload, id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const snapshot = await discoverCapabilities('https://example.com');
    expect(snapshot.discoveryStatus).toBe('success');
    // First 400 entries are m_* which are not allowlisted, so safe list stays empty
    expect(snapshot.safeAdvertisedMethods.length).toBe(0);
    expect(snapshot.rawMethodCount).toBeLessThanOrEqual(400);
  });

  it('returns unsupported_method on -32601', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const snapshot = await discoverCapabilities('https://example.com');
    expect(snapshot.discoveryStatus).toBe('unsupported_method');
    expect(snapshot.safeAdvertisedMethods).toEqual([]);
  });

  it('does not mislabel other RPC errors as unsupported', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32602, message: 'Invalid params' }, id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const snapshot = await discoverCapabilities('https://example.com');
    expect(snapshot.discoveryStatus).toBe('invalid_response');
  });

  it('handles invalid shape as invalid_response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ jsonrpc: '2.0', result: { foo: 'bar' }, id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const snapshot = await discoverCapabilities('https://example.com');
    expect(snapshot.discoveryStatus).toBe('invalid_response');
    expect(snapshot.safeAdvertisedMethods).toEqual([]);
  });

  it('handles network/CORS failure as transport_error', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const snapshot = await discoverCapabilities('https://example.com');
    expect(snapshot.discoveryStatus).toBe('transport_error');
  });

  it('handles timeout as transport_error', async () => {
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 20);
        })
    );

    const snapshot = await discoverCapabilities('https://example.com');
    expect(snapshot.discoveryStatus).toBe('transport_error');
  });

  it('filters unsafe and mutating methods', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          result: [
            'eth_chainId',
            'system_peers',
            'author_submitExtrinsic',
            'eth_sendTransaction',
            'state_getStorage',
            'system_health',
          ],
          id: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const snapshot = await discoverCapabilities('https://example.com');
    expect(snapshot.discoveryStatus).toBe('success');
    expect(snapshot.safeAdvertisedMethods.map((m) => m.method)).toEqual(['eth_chainId', 'system_health']);
    // system_peers and mutating methods must not appear
    expect(snapshot.safeAdvertisedMethods.some((m) => m.method === 'system_peers')).toBe(false);
    expect(snapshot.safeAdvertisedMethods.some((m) => m.method.startsWith('author_'))).toBe(false);
  });

  it('never marks advertised as confirmed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ jsonrpc: '2.0', result: ['eth_chainId'], id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const snapshot = await discoverCapabilities('https://example.com');
    expect(snapshot.safeAdvertisedMethods[0].evidence).toBe('advertised');
    // No confirmed status exists in this model
    expect((snapshot.safeAdvertisedMethods[0] as unknown as Record<string, unknown>).evidence).not.toBe('confirmed');
  });
});
