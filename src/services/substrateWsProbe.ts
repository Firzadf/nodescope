/**
 * User-triggered Substrate WebSocket probe.
 *
 * This is the other half of Portaldot's Dual-VM story that NodeScope did not
 * cover before: the HTTP EVM endpoint answers eth_* methods, while the
 * WebSocket node endpoint at wss://test-node-v3.portaldot.dev answers
 * Substrate methods (system_health, system_chain, chain_getHeader) and
 * correctly answers eth_* with "Method not found" (-32601). That error is
 * expected on this transport, not a node failure, and it is reported as such.
 *
 * Verified live 25 Oct 2026 from this machine:
 * system_health -> { peers: 1, isSyncing: false, shouldHavePeers: true }
 * system_chain -> "PortaldotV3 Test"
 * chain_getHeader -> a header with number 0x2b644 (177732)
 *
 * No polling, no background timers: one click, one connection, then close.
 */

export const DEFAULT_SUBSTRATE_WS_URL = 'wss://test-node-v3.portaldot.dev';

export interface SubstrateWsProbeResult {
  url: string;
  status: 'ok' | 'error';
  handshakeMs: number | null;
  totalMs: number | null;
  chain: string | null;
  version: string | null;
  peers: number | null;
  isSyncing: boolean | null;
  shouldHavePeers: boolean | null;
  headerNumberHex: string | null;
  headerNumberDecimal: string | null;
  error: string | null;
}

export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
}

type WsFactory = () => WebSocketLike;

function hexToDecimal(hex: string): string | null {
  try {
    if (!/^0x[0-9a-fA-F]+$/.test(hex)) return null;
    return BigInt(hex).toString(10);
  } catch {
    return null;
  }
}

export async function probeSubstrateWs(
  url: string = DEFAULT_SUBSTRATE_WS_URL,
  options: { timeoutMs?: number; wsFactory?: WsFactory } = {},
): Promise<SubstrateWsProbeResult> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const start = Date.now();
  const base: Omit<SubstrateWsProbeResult, 'status' | 'error'> = {
    url,
    handshakeMs: null,
    totalMs: null,
    chain: null,
    version: null,
    peers: null,
    isSyncing: null,
    shouldHavePeers: null,
    headerNumberHex: null,
    headerNumberDecimal: null,
  };

  // Hardening from the REA self-audit: a Substrate probe must not run over
  // plaintext ws:// to a remote host, where the query and answers travel
  // unencrypted. The only plaintext exception is a local node, where there
  // is no network hop to intercept.
  try {
    const parsed = new URL(url);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
    if (parsed.protocol !== 'wss:' && !(parsed.protocol === 'ws:' && isLocal)) {
      return { ...base, status: 'error', error: 'Only wss:// URLs are accepted for a Substrate probe, except ws:// on localhost.' };
    }
  } catch {
    return { ...base, status: 'error', error: 'The WebSocket URL is not valid.' };
  }

  const factory: WsFactory | undefined = options.wsFactory
    ?? (typeof WebSocket !== 'undefined'
      ? () => new WebSocket(url) as unknown as WebSocketLike
      : undefined);
  if (!factory) {
    return { ...base, status: 'error', error: 'WebSocket is not available in this environment.' };
  }

  return new Promise((resolve) => {
    let settled = false;
    let ws: WebSocketLike;
    try {
      ws = factory();
    } catch (err) {
      return resolve({ ...base, status: 'error', error: err instanceof Error ? err.message : 'Failed to open WebSocket.' });
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* already closed */ }
      resolve({ ...base, status: 'error', error: `Timed out after ${timeoutMs} ms waiting for the node.` });
    }, timeoutMs);

    const wanted = new Map<number, string>([
      [1, 'system_health'],
      [2, 'system_chain'],
      [3, 'system_version'],
      [4, 'chain_getHeader'],
    ]);
    const received = new Map<number, unknown>();

    const finish = (error: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      const health = received.get(1) as { peers?: unknown; isSyncing?: unknown; shouldHavePeers?: unknown } | undefined;
      const header = received.get(4) as { number?: unknown } | undefined;
      const headerHex = typeof header?.number === 'string' ? header.number : null;
      resolve({
        ...base,
        handshakeMs: base.handshakeMs,
        totalMs: Date.now() - start,
        chain: typeof received.get(2) === 'string' ? (received.get(2) as string) : null,
        version: typeof received.get(3) === 'string' ? (received.get(3) as string) : null,
        peers: typeof health?.peers === 'number' ? health.peers : null,
        isSyncing: typeof health?.isSyncing === 'boolean' ? health.isSyncing : null,
        shouldHavePeers: typeof health?.shouldHavePeers === 'boolean' ? health.shouldHavePeers : null,
        headerNumberHex: headerHex,
        headerNumberDecimal: headerHex ? hexToDecimal(headerHex) : null,
        status: error ? 'error' : 'ok',
        error,
      });
    };

    ws.onopen = () => {
      base.handshakeMs = Date.now() - start;
      for (const [id, method] of wanted) {
        ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params: [] }));
      }
    };
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { id?: unknown; result?: unknown; error?: { message?: string } };
        if (typeof parsed.id !== 'number' || !wanted.has(parsed.id)) return;
        if (parsed.error) {
          finish(`Node answered ${wanted.get(parsed.id)} with: ${parsed.error.message ?? 'unknown error'}`);
          return;
        }
        received.set(parsed.id, parsed.result);
        if (received.size === wanted.size) finish(null);
      } catch {
        finish('Node answered with a response that is not valid JSON.');
      }
    };
    ws.onerror = () => finish('WebSocket error while connecting to the node.');
    ws.onclose = () => {
      if (!settled && received.size > 0) finish('Connection closed before all answers arrived.');
      else if (!settled) finish('Connection closed before the node answered.');
    };
  });
}
