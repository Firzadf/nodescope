import { describe, expect, it } from 'vitest';
import { probeSubstrateWs, type WebSocketLike } from './substrateWsProbe';

function fakeWs(responses: Record<number, unknown>): WebSocketLike {
  const ws: WebSocketLike = {
    send(data: string) {
      const parsed = JSON.parse(data) as { id: number; method: string };
      const result = responses[parsed.id];
      queueMicrotask(() => {
        ws.onmessage?.({ data: JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result }) });
      });
    },
    close() {},
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  };
  queueMicrotask(() => ws.onopen?.({}));
  return ws;
}

describe('probeSubstrateWs', () => {
  it('collects chain, version, health, and header, converting the header hex to decimal', async () => {
    const result = await probeSubstrateWs('wss://test-node-v3.portaldot.dev', {
      wsFactory: () =>
        fakeWs({
          1: { peers: 1, isSyncing: false, shouldHavePeers: true },
          2: 'PortaldotV3 Test',
          3: '3.0.0-dev-fddd43141f2',
          4: { number: '0x2b644' },
        }),
    });
    expect(result.status).toBe('ok');
    expect(result.chain).toBe('PortaldotV3 Test');
    expect(result.version).toBe('3.0.0-dev-fddd43141f2');
    expect(result.peers).toBe(1);
    expect(result.isSyncing).toBe(false);
    expect(result.headerNumberHex).toBe('0x2b644');
    expect(result.headerNumberDecimal).toBe('177732');
    expect(result.handshakeMs).not.toBeNull();
    expect(result.totalMs).not.toBeNull();
  });

  it('rejects a plaintext ws:// URL to a remote host without opening a connection', async () => {
    let opened = false;
    const result = await probeSubstrateWs('ws://node.example.com', {
      wsFactory: () => {
        opened = true;
        return fakeWs({});
      },
    });
    expect(opened).toBe(false);
    expect(result.status).toBe('error');
    expect(result.error).toContain('wss://');
  });

  it('reports a node error instead of pretending the probe succeeded', async () => {
    const ws = fakeWs({ 1: { peers: 1, isSyncing: false, shouldHavePeers: true } });
    const result = await probeSubstrateWs('wss://example.invalid', {
      wsFactory: () => {
        queueMicrotask(() => {
          ws.onopen?.({});
          ws.onmessage?.({
            data: JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } }),
          });
        });
        return ws;
      },
    });
    expect(result.status).toBe('error');
    expect(result.error).toContain('system_health');
  });
});
