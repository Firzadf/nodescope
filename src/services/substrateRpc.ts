import type { WebSocketLike } from './substrateWsProbe';

type WsFactory = (url: string) => WebSocketLike;

export interface SubstrateRpcCall {
  method: string;
  params?: unknown[];
}

/**
 * One user-triggered WSS round trip: open, send the calls, close.
 * Read-only by the caller's method list. Plaintext ws:// is refused
 * except on localhost, same rule as the Substrate probe.
 */
export async function substrateRpc(
  url: string,
  calls: SubstrateRpcCall[],
  options: { timeoutMs?: number; wsFactory?: WsFactory } = {},
): Promise<{ ok: true; results: unknown[] } | { ok: false; error: string }> {
  const timeoutMs = options.timeoutMs ?? 10000;
  try {
    const parsed = new URL(url);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
    if (parsed.protocol !== 'wss:' && !(parsed.protocol === 'ws:' && isLocal)) {
      return { ok: false, error: 'Only wss:// URLs are accepted, except ws:// on localhost.' };
    }
  } catch {
    return { ok: false, error: 'The WebSocket URL is not valid.' };
  }
  const factory: WsFactory | undefined = options.wsFactory
    ?? (typeof WebSocket !== 'undefined' ? (u) => new WebSocket(u) as unknown as WebSocketLike : undefined);
  if (!factory) return { ok: false, error: 'WebSocket is not available in this environment.' };

  return new Promise((resolve) => {
    let settled = false;
    let ws: WebSocketLike;
    try {
      ws = factory(url);
    } catch (err) {
      resolve({ ok: false, error: err instanceof Error ? err.message : 'Failed to open WebSocket.' });
      return;
    }
    const results: unknown[] = new Array(calls.length);
    const got = new Set<number>();
    const timer = setTimeout(() => done(`Timed out after ${timeoutMs} ms waiting for the node.`), timeoutMs);
    const done = (error: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      if (error) resolve({ ok: false, error });
      else resolve({ ok: true, results });
    };
    ws.onopen = () => {
      calls.forEach((call, i) => {
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: i + 1, method: call.method, params: call.params ?? [] }));
      });
      if (calls.length === 0) done(null);
    };
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { id?: unknown; result?: unknown; error?: { message?: string } };
        if (typeof parsed.id !== 'number' || parsed.id < 1 || parsed.id > calls.length) return;
        if (parsed.error) {
          done(`Node answered ${calls[parsed.id - 1].method} with: ${parsed.error.message ?? 'unknown error'}`);
          return;
        }
        results[parsed.id - 1] = parsed.result;
        got.add(parsed.id);
        if (got.size === calls.length) done(null);
      } catch {
        done('Node answered with a response that is not valid JSON.');
      }
    };
    ws.onerror = () => done('WebSocket error while connecting to the node.');
    ws.onclose = () => {
      if (!settled) done(got.size > 0 ? 'Connection closed before all answers arrived.' : 'Connection closed before the node answered.');
    };
  });
}
