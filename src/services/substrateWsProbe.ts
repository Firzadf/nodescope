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

import { flagAdvertisedMethod, presentExposedMethodNames } from '../utils/rpcSecurity';

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
  /** chain_getFinalizedHead, when the node reported one. Absent on older saved probes. */
  finalizedHeadHash?: string | null;
  finalizedNumberHex?: string | null;
  finalizedNumberDecimal?: string | null;
  /** Best minus finalized, when both heights were read. */
  finalityLagBlocks?: number | null;
  syncStartingBlock?: string | null;
  syncCurrentBlock?: string | null;
  syncHighestBlock?: string | null;
  /** Unsafe operator methods named by rpc_methods. Empty when withheld. Listed, never called. */
  advertisedUnsafeMethods?: string[];
  /** Official Portaldot hosts: names are omitted and this note is shown instead. */
  exposedMethodsWithheld?: boolean;
  exposedMethodsNote?: string | null;
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
    finalizedHeadHash: null,
    finalizedNumberHex: null,
    finalizedNumberDecimal: null,
    finalityLagBlocks: null,
    syncStartingBlock: null,
    syncCurrentBlock: null,
    syncHighestBlock: null,
    advertisedUnsafeMethods: [],
    exposedMethodsWithheld: false,
    exposedMethodsNote: null,
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

    const required = new Map<number, string>([
      [1, 'system_health'],
      [2, 'system_chain'],
      [3, 'system_version'],
      [4, 'chain_getHeader'],
    ]);
    const optional = new Map<number, string>([
      [5, 'chain_getFinalizedHead'],
      [7, 'system_syncState'],
      [8, 'rpc_methods'],
    ]);
    const wanted = new Map<number, string>([...required, ...optional, [6, 'chain_getHeader']]);
    const received = new Map<number, unknown>();
    const failedOptional = new Set<number>();
    let askedFinalizedHeader = false;

    const finish = (error: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      const health = received.get(1) as { peers?: unknown; isSyncing?: unknown; shouldHavePeers?: unknown } | undefined;
      const header = received.get(4) as { number?: unknown } | undefined;
      const headerHex = typeof header?.number === 'string' ? header.number : null;
      const headerDec = headerHex ? hexToDecimal(headerHex) : null;
      const finHash = typeof received.get(5) === 'string' ? (received.get(5) as string) : null;
      const finHeader = received.get(6) as { number?: unknown } | undefined;
      const finHex = typeof finHeader?.number === 'string' ? finHeader.number : null;
      const finDec = finHex ? hexToDecimal(finHex) : null;
      const sync = received.get(7) as { startingBlock?: unknown; currentBlock?: unknown; highestBlock?: unknown } | undefined;
      const methodsRaw = received.get(8) as { methods?: unknown } | unknown[] | undefined;
      const methodList = Array.isArray(methodsRaw)
        ? methodsRaw
        : methodsRaw && typeof methodsRaw === 'object' && Array.isArray((methodsRaw as { methods?: unknown }).methods)
          ? (methodsRaw as { methods: unknown[] }).methods
          : [];
      const unsafeNames = methodList.filter((m): m is string => typeof m === 'string').filter((m) => flagAdvertisedMethod(m)?.flag === 'unsafe-operator');
      const presented = presentExposedMethodNames(url, unsafeNames);
      const asBlock = (v: unknown) => (typeof v === 'number' || typeof v === 'string' ? String(v) : null);
      let lag: number | null = null;
      if (headerDec !== null && finDec !== null) {
        try { lag = Number(BigInt(headerDec) - BigInt(finDec)); } catch { lag = null; }
      }
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
        headerNumberDecimal: headerDec,
        finalizedHeadHash: finHash,
        finalizedNumberHex: finHex,
        finalizedNumberDecimal: finDec,
        finalityLagBlocks: lag,
        syncStartingBlock: asBlock(sync?.startingBlock),
        syncCurrentBlock: asBlock(sync?.currentBlock),
        syncHighestBlock: asBlock(sync?.highestBlock),
        advertisedUnsafeMethods: presented.names,
        exposedMethodsWithheld: presented.withheld,
        exposedMethodsNote: presented.note,
        status: error ? 'error' : 'ok',
        error,
      });
    };

    const maybeFinish = () => {
      const requiredDone = [...required.keys()].every((id) => received.has(id));
      const optionalDone = [...optional.keys()].every((id) => received.has(id) || failedOptional.has(id));
      if (!requiredDone || !optionalDone) return;
      const finHash = received.get(5);
      if (typeof finHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(finHash) && !askedFinalizedHeader) {
        askedFinalizedHeader = true;
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'chain_getHeader', params: [finHash] }));
        return;
      }
      if (askedFinalizedHeader && !received.has(6) && !failedOptional.has(6)) return;
      finish(null);
    };

    ws.onopen = () => {
      base.handshakeMs = Date.now() - start;
      for (const [id, method] of [...required, ...optional]) {
        ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params: [] }));
      }
    };
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { id?: unknown; result?: unknown; error?: { message?: string } };
        if (typeof parsed.id !== 'number' || !wanted.has(parsed.id)) return;
        if (parsed.error) {
          if (required.has(parsed.id)) {
            finish(`Node answered ${required.get(parsed.id)} with: ${parsed.error.message ?? 'unknown error'}`);
            return;
          }
          failedOptional.add(parsed.id);
          maybeFinish();
          return;
        }
        received.set(parsed.id, parsed.result);
        maybeFinish();
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
