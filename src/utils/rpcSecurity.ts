/**
 * Unsafe / admin RPC method flags, from method discovery only.
 *
 * The probe may CALL only READ_ONLY_PROBE_METHODS. Everything in
 * UNSAFE_OPERATOR_METHODS is named in rpc_methods output and never sent.
 * author_submitExtrinsic and eth_sendRawTransaction are normal public
 * submission methods: they are listed as state-changing and not invoked,
 * and they are not an "unsafe operator" finding by themselves.
 * eth_sendTransaction (unlocked-account send) is.
 */

export const READ_ONLY_PROBE_METHODS = [
  'eth_chainId',
  'eth_blockNumber',
  'eth_getBlockByNumber',
  'eth_getBalance',
  'eth_getCode',
  'eth_syncing',
  'rpc_methods',
  'web3_clientVersion',
  'net_version',
  'system_health',
  'system_syncState',
  'system_chain',
  'system_version',
  'system_properties',
  'chain_getHeader',
  'chain_getFinalizedHead',
  'state_call',
] as const;

/** Runtime APIs state_call is allowed to name. Nothing else. */
export const READ_ONLY_STATE_CALLS = ['ReviveApi_account_id', 'ReviveApi_address'] as const;

/**
 * Operator methods that a public RPC should not advertise. Matches the
 * Substrate "unsafe" set operators usually hide behind --rpc-methods safe,
 * plus the dev/sudo/admin families called out in the Portaldot bug bounty.
 */
export const UNSAFE_OPERATOR_METHODS = [
  'author_insertKey',
  'author_rotateKeys',
  'author_rotateKeysWithOwner',
  'author_hasKey',
  'author_hasSessionKeys',
  'author_removeExtrinsic',
  'offchain_localStorageSet',
  'offchain_localStorageClear',
  'system_addReservedPeer',
  'system_removeReservedPeer',
  'system_addLogFilter',
  'system_resetLogFilter',
  'sync_state_genSyncSpec',
  'sudo_sudo',
  'sudo_sudoAs',
  'sudo_sudoUncheckedWeight',
] as const;

const UNSAFE_EXACT = new Set<string>(UNSAFE_OPERATOR_METHODS);

const UNSAFE_PREFIXES = ['dev_', 'sudo_', 'admin_', 'personal_', 'miner_', 'engine_', 'debug_'];

/** State-changing methods a public endpoint may expose. Reported, never called. */
const STATE_CHANGING_EXACT = new Set(['eth_sendTransaction', 'eth_sendRawTransaction', 'author_submitExtrinsic', 'author_submitAndWatchExtrinsic']);

export type MethodFlag = 'unsafe-operator' | 'state-changing';

export interface FlaggedMethod {
  method: string;
  flag: MethodFlag;
  reason: string;
}

export function flagAdvertisedMethod(method: string): FlaggedMethod | null {
  if (UNSAFE_EXACT.has(method) || UNSAFE_PREFIXES.some((p) => method.startsWith(p))) {
    return {
      method,
      flag: 'unsafe-operator',
      reason: 'Advertised by rpc_methods. Not invoked. Unsafe or admin methods should not be reachable on a public RPC.',
    };
  }
  if (STATE_CHANGING_EXACT.has(method) || method.startsWith('eth_sign')) {
    return {
      method,
      flag: 'state-changing',
      reason: 'Advertised by rpc_methods. Not invoked. State-changing methods are out of scope for a read-only probe.',
    };
  }
  return null;
}

export function classifyAdvertisedMethods(methods: string[]): { unsafe: FlaggedMethod[]; stateChanging: FlaggedMethod[] } {
  const unsafe: FlaggedMethod[] = [];
  const stateChanging: FlaggedMethod[] = [];
  const seen = new Set<string>();
  for (const method of methods) {
    if (seen.has(method)) continue;
    seen.add(method);
    const flag = flagAdvertisedMethod(method);
    if (!flag) continue;
    if (flag.flag === 'unsafe-operator') unsafe.push(flag);
    else stateChanging.push(flag);
  }
  return { unsafe, stateChanging };
}

/** Published Portaldot endpoints. Exposed-method names for these hosts are not shown. */
export const OFFICIAL_PORTALDOT_RPC_HOSTS = [
  'test-evm-rpc-v3.portaldot.dev',
  'test-node-v3.portaldot.dev',
] as const;

export const EXPOSED_METHODS_WITHHELD_NOTE =
  'Exposed-method findings for official Portaldot endpoints are withheld pending responsible disclosure to the Portaldot team.';

export function isOfficialPortaldotEndpoint(target: string): boolean {
  const raw = target.trim();
  if (!raw) return false;
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return (OFFICIAL_PORTALDOT_RPC_HOSTS as readonly string[]).includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Drop method names when the target is an official Portaldot host. Other hosts keep the full list. */
export function presentExposedMethodNames(endpoint: string, names: string[]): {
  withheld: boolean;
  note: string | null;
  names: string[];
} {
  if (isOfficialPortaldotEndpoint(endpoint)) {
    return { withheld: true, note: EXPOSED_METHODS_WITHHELD_NOTE, names: [] };
  }
  return { withheld: false, note: null, names };
}

export function readOnlyProbeIsDisjointFromUnsafe(): boolean {
  const called = new Set<string>(READ_ONLY_PROBE_METHODS);
  for (const method of UNSAFE_OPERATOR_METHODS) {
    if (called.has(method)) return false;
  }
  for (const method of READ_ONLY_PROBE_METHODS) {
    if (flagAdvertisedMethod(method)?.flag === 'unsafe-operator') return false;
    if (flagAdvertisedMethod(method)?.flag === 'state-changing') return false;
  }
  return true;
}

export type HistoryClass = 'historical' | 'pruned-state' | 'pruned-headers' | 'unknown';

const PRUNE_PATTERN = /missing trie|state already discarded|header not found|not found|pruned|unknown block|block not found|history|discarded/i;

/**
 * One old block, chosen by the caller (head − 10_000, or block 1 when the
 * chain is shorter). "historical" means that one block still serves state.
 * It is not a claim that every historical block is kept.
 */
export function classifyHistory(input: {
  block: string;
  headerOk: boolean;
  headerError?: string | null;
  stateOk: boolean;
  stateError?: string | null;
}): { klass: HistoryClass; detail: string } {
  if (input.headerOk && input.stateOk) {
    return { klass: 'historical', detail: `Header and account state at block ${input.block} both answered. This node is serving history at least that far back.` };
  }
  if (input.headerOk && !input.stateOk) {
    const pruned = PRUNE_PATTERN.test(input.stateError ?? '');
    return {
      klass: pruned ? 'pruned-state' : 'unknown',
      detail: pruned
        ? `Header at block ${input.block} answered, state did not (${input.stateError}). State looks pruned.`
        : `Header at block ${input.block} answered, state failed (${input.stateError ?? 'unknown'}). Not classified as pruned.`,
    };
  }
  if (!input.headerOk && PRUNE_PATTERN.test(input.headerError ?? '')) {
    return { klass: 'pruned-headers', detail: `Header at block ${input.block} was not available (${input.headerError}).` };
  }
  return { klass: 'unknown', detail: `Could not classify history at block ${input.block} (${input.headerError ?? input.stateError ?? 'no answer'}).` };
}
