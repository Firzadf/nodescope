import { describe, expect, it } from 'vitest';
import {
  BEST_STALL_AGE_SECONDS,
  FINALITY_FULL_LAG_BLOCKS,
  WEIGHTS_V2,
  assessStall,
  computeHealthScoreV2,
  formatPrometheus,
  renderBadgeSvg,
  badgeTarget,
} from '../../shared/liveStatus.mjs';
import { computeHealthScore, HEAD_STALL_MIN_GAP_SECONDS, HEALTH_SCORE_FORMULA } from './healthScore';
import { HEAD_SAMPLE_STALL_SECONDS } from './healthScore';
import { mapAddress } from './addressMap';
import { unitsFromProperties } from './unitsSanity';
import { classifyAdvertisedMethods, classifyHistory, EXPOSED_METHODS_WITHHELD_NOTE, presentExposedMethodNames, readOnlyProbeIsDisjointFromUnsafe, READ_ONLY_STATE_CALLS } from './rpcSecurity';
import { operatorFindings } from './operatorFindings';
import { alertKindForCycle, detectStallTransition } from './alertWebhook';

function snap(id: string, timestamp: number, height: string, latency = 200) {
  const check = (method: string, observedValue: string) => ({ method, outcome: 'success', success: true, latencyMs: latency, observedValue, error: null });
  return {
    id,
    timestamp,
    endpointOrigin: 'https://test-evm-rpc-v3.portaldot.dev',
    endpointProfile: 'portaldot_v3_evm',
    checks: [check('eth_chainId', '0x190f1ca9'), check('eth_blockNumber', height), check('web3_clientVersion', 'x'), check('net_version', '420420777')],
  };
}

const wsOk = {
  status: 'ok',
  chain: 'PortaldotV3 Test',
  peers: 1,
  isSyncing: false,
  shouldHavePeers: true,
  headerNumberDecimal: '232115',
  finalizedNumberDecimal: '232113',
  syncCurrentBlock: '232115',
  syncHighestBlock: '232115',
};

describe('health score v2', () => {
  it('publishes weights that sum to 100 and keeps the v1 stall gap', () => {
    expect(Object.values(WEIGHTS_V2).reduce((a, b) => a + b, 0)).toBe(100);
    expect(HEAD_SAMPLE_STALL_SECONDS).toBe(HEAD_STALL_MIN_GAP_SECONDS);
    expect(HEALTH_SCORE_FORMULA).toBe('nodescope.health-score.v1');
  });

  it('leaves v1 reproducible on the same inputs', () => {
    const snapshots = [snap('a', 1_000_000, '0x231a0'), snap('b', 1_076_000, '0x231ac')];
    const v1 = computeHealthScore({ snapshots: snapshots as never, wsProbe: { ...wsOk, url: 'wss://x', handshakeMs: 1, totalMs: 1, version: '1', headerNumberHex: '0x1', error: null } as never });
    expect(v1.formula).toBe('nodescope.health-score.v1');
    expect(v1.score).toBe(100);
  });

  it('scores a fresh node with a small finality lag at 100 when reliability ran clean', () => {
    const score = computeHealthScoreV2({
      snapshots: [snap('a', 1_000_000, '0x100'), snap('b', 1_040_000, '0x104')],
      wsProbe: { ...wsOk, headerNumberDecimal: '260', finalizedNumberDecimal: '258' },
      motion: { bestTimestampSec: 1_000, observedAtMs: 1_010_000 },
      reliability: { samples: 6, errors: 0, http5xx: 0, p50Ms: 80, p95Ms: 120 },
    });
    expect(score.formula).toBe('nodescope.health-score.v2');
    expect(score.coverage).toBe(100);
    expect(score.score).toBe(100);
    expect(score.components.find((c) => c.id === 'finality')?.points).toBe(WEIGHTS_V2.finality);
  });

  it('zeros head progression when the best block timestamp is the 232115 halt', () => {
    const observedAtMs = Date.parse('2026-10-28T20:24:10Z');
    const bestTimestampSec = 1793191554;
    const score = computeHealthScoreV2({
      snapshots: [snap('a', observedAtMs, '0x38ab3')],
      wsProbe: wsOk,
      motion: { bestTimestampSec, observedAtMs, bestHeight: '232115' },
    });
    const head = score.components.find((c) => c.id === 'head_progression');
    expect(head?.points).toBe(0);
    expect(head?.detail).toMatch(/232115/);
    expect(head?.detail).toMatch(/Chain paused but RPC answers/);
    const fin = score.components.find((c) => c.id === 'finality');
    expect(fin?.points).toBe(WEIGHTS_V2.finality);
    expect(fin?.detail).toMatch(/2 blocks/);
  });

  it('scores finality linearly and gives zero peers no peer points', () => {
    const lagged = computeHealthScoreV2({
      snapshots: [snap('a', 1, '0x10'), snap('b', 40_000, '0x20')],
      wsProbe: { ...wsOk, headerNumberDecimal: '1000', finalizedNumberDecimal: '968', peers: 0 },
    });
    const fin = lagged.components.find((c) => c.id === 'finality');
    expect(fin?.measured).toBe(true);
    expect(fin?.points).toBeLessThan(WEIGHTS_V2.finality);
    expect(fin?.points).toBeGreaterThan(0);
    const peers = lagged.components.find((c) => c.id === 'peer_sync');
    expect(peers?.points).toBe(6);
    const zero = computeHealthScoreV2({
      snapshots: [],
      wsProbe: { status: 'ok', headerNumberDecimal: '200', finalizedNumberDecimal: '100' },
    });
    expect(zero.components.find((c) => c.id === 'finality')?.points).toBe(0);
    expect(FINALITY_FULL_LAG_BLOCKS).toBe(4);
  });

  it('drops reliability points for errors and 5xx, and leaves it unmeasured otherwise', () => {
    const dirty = computeHealthScoreV2({
      snapshots: [snap('a', 1, '0x1'), snap('b', 40_000, '0x2')],
      reliability: { samples: 4, errors: 2, http5xx: 2, p50Ms: 100, p95Ms: 100 },
    });
    expect(dirty.components.find((c) => c.id === 'rpc_reliability')?.points).toBe(5);
    const none = computeHealthScoreV2({ snapshots: [snap('a', 1, '0x1')] });
    expect(none.components.find((c) => c.id === 'rpc_reliability')?.measured).toBe(false);
  });
});

describe('STALLED', () => {
  it('flags the 232115 halt from a timestamp and does not call a silent RPC stalled', () => {
    const nowMs = 1793191554 * 1000 + BEST_STALL_AGE_SECONDS * 1000;
    const stalled = assessStall({ nowMs, rpcAnswered: true, bestTimestampSec: 1793191554, bestHeight: '232115', finalizedHeight: '232113' });
    expect(stalled.state).toBe('stalled');
    expect(stalled.explanation).toMatch(/chain paused but RPC answers/);
    expect(stalled.finalityLagBlocks).toBe(2);
    const down = assessStall({ nowMs, rpcAnswered: false, bestTimestampSec: 1793191554, bestHeight: '232115' });
    expect(down.state).toBe('unknown');
    const fresh = assessStall({ nowMs: 1_000_000, rpcAnswered: true, bestTimestampSec: 990, bestHeight: '10' });
    expect(fresh.state).toBe('live');
  });

  it('stalls on two samples that did not move, and resumes only into live', () => {
    const paused = assessStall({
      nowMs: 90_000,
      rpcAnswered: true,
      bestSamples: [{ height: '232115', atMs: 0 }, { height: '232115', atMs: 60_000 }],
    });
    expect(paused.state).toBe('stalled');
    expect(detectStallTransition(null, 'stalled')).toBeNull();
    expect(detectStallTransition('live', 'stalled')).toBe('stall');
    expect(detectStallTransition('stalled', 'live')).toBe('resume');
    expect(detectStallTransition('stalled', 'unknown')).toBeNull();
    expect(alertKindForCycle('healthy', 'stalled', 'live', 'stalled')).toBe('stall');
    expect(alertKindForCycle('stalled', 'down', 'stalled', 'unknown')).toBe('degrade');
    expect(alertKindForCycle('stalled', 'healthy', 'stalled', 'live')).toBe('resume');
  });
});

describe('address mapping matches pallet-revive on the live runtime vectors', () => {
  it('maps H160 to the 0xEE suffix fallback and back', () => {
    const mapped = mapAddress('0x' + '11'.repeat(20), 42);
    expect(mapped.fallbackAccountId).toBe('0x' + '11'.repeat(20) + 'ee'.repeat(12));
    expect(mapped.rule).toBe('fallback-suffix');
    expect(mapped.ss58.startsWith('5')).toBe(true);
    const back = mapAddress(mapped.fallbackAccountId, 42);
    expect(back.h160).toBe('0x' + '11'.repeat(20));
    expect(back.rule).toBe('strip-ee-suffix');
  });

  it('hashes a non-eth account with keccak256 and keeps the last 20 bytes', () => {
    const mapped = mapAddress('0x' + 'ab'.repeat(32));
    expect(mapped.h160).toBe('0x73b8f93c94a80264b7bb3cc5c7d2fb54d07ef6b9');
    expect(mapped.rule).toBe('keccak256-last-20');
    expect(mapped.ethDerived).toBe(false);
  });
});

describe('units and unsafe methods', () => {
  it('flags the 14-versus-18 decimal trap and a decimals mismatch', () => {
    const trap = unitsFromProperties({ tokenDecimals: 14, tokenSymbol: 'tPOT', ss58Format: 42 });
    expect(trap.decimalTrap).toBe(true);
    expect(trap.trapFactor).toBe('10000');
    expect(trap.detail).toMatch(/10,000×|10000×/);
    const mismatch = unitsFromProperties({ tokenDecimals: [14, 18], tokenSymbol: 'tPOT' });
    expect(mismatch.mismatch).toBe(true);
    expect(mismatch.decimalTrap).toBe(false);
  });

  it('never calls an unsafe method, and classifies a generic advertised list', () => {
    expect(readOnlyProbeIsDisjointFromUnsafe()).toBe(true);
    expect(READ_ONLY_STATE_CALLS).toEqual(['ReviveApi_account_id', 'ReviveApi_address']);
    const flagged = classifyAdvertisedMethods([
      'eth_blockNumber',
      'author_insertKey',
      'eth_sendRawTransaction',
      'dev_exampleProbe',
    ]);
    expect(flagged.unsafe.map((m) => m.method)).toEqual(['author_insertKey', 'dev_exampleProbe']);
    expect(flagged.stateChanging.map((m) => m.method)).toEqual(['eth_sendRawTransaction']);
  });

  it('withholds exposed-method names for official Portaldot hosts and keeps them for any other host', () => {
    const names = ['dev_exampleProbe'];
    const official = presentExposedMethodNames('https://test-evm-rpc-v3.portaldot.dev', names);
    expect(official.withheld).toBe(true);
    expect(official.names).toEqual([]);
    expect(official.note).toBe(EXPOSED_METHODS_WITHHELD_NOTE);
    expect(JSON.stringify(official)).not.toContain('dev_exampleProbe');
    const wss = presentExposedMethodNames('wss://test-node-v3.portaldot.dev/ws', names);
    expect(wss.withheld).toBe(true);
    const custom = presentExposedMethodNames('https://rpc.example.test', names);
    expect(custom.withheld).toBe(false);
    expect(custom.names).toEqual(names);
  });

  it('classifies history without calling anything', () => {
    expect(classifyHistory({ block: '222115', headerOk: true, stateOk: true }).klass).toBe('historical');
    expect(classifyHistory({ block: '222115', headerOk: true, stateOk: false, stateError: 'missing trie node' }).klass).toBe('pruned-state');
    expect(classifyHistory({ block: '1', headerOk: false, stateOk: false, headerError: 'header not found' }).klass).toBe('pruned-headers');
  });
});

describe('operator findings and prometheus', () => {
  it('turns a stall, zero peers, and the decimal trap into findings', () => {
    const stall = assessStall({ nowMs: 200_000, rpcAnswered: true, bestTimestampSec: 0, bestHeight: '232115' });
    const findings = operatorFindings({
      stall,
      wsProbe: { ...wsOk, peers: 0, url: 'wss://x', handshakeMs: 1, totalMs: 1, version: null, headerNumberHex: null, error: null } as never,
      units: unitsFromProperties({ tokenDecimals: 14, tokenSymbol: 'tPOT', ss58Format: 42 }),
    });
    expect(findings.map((f) => f.ruleId)).toEqual(expect.arrayContaining(['chain.stalled', 'node.no-peers', 'units.decimal-trap']));
  });

  it('renders prometheus text and omits a missing score', () => {
    const text = formatPrometheus({
      up: 1,
      verdict: 'stalled',
      score: 72,
      stalled: true,
      bestBlock: 232115,
      finalizedBlock: 232113,
      finalityLag: 2,
      peers: 0,
      syncing: false,
      bestAgeSeconds: 27496,
    });
    expect(text).toContain('nodescope_stalled 1');
    expect(text).toContain('nodescope_health_score{formula="nodescope.health-score.v2"} 72');
    expect(text).toContain('nodescope_verdict{verdict="stalled"} 1');
    expect(text).toContain('nodescope_finality_lag_blocks 2');
    expect(text).toContain('# TYPE nodescope_up gauge');
    const bare = formatPrometheus({ up: 0, verdict: 'down', score: null, stalled: false });
    expect(bare).not.toContain('nodescope_health_score{');
  });
});

describe('status badge', () => {
  it('draws the verdict and refuses any host that is not the published testnet', () => {
    const svg = renderBadgeSvg({ verdict: 'stalled', score: 72, detail: 'chain paused but RPC answers' });
    expect(svg).toContain('STALLED 72');
    expect(svg).toContain('chain paused but RPC answers');
    expect(svg).toContain('<svg');
    const ok = badgeTarget(new URLSearchParams('target=portaldot-v3-testnet'));
    expect(ok.ok).toBe(true);
    expect(ok.evm).toBe('https://test-evm-rpc-v3.portaldot.dev');
    const evil = badgeTarget(new URLSearchParams('target=portaldot-v3-testnet&rpc=https://169.254.169.254/'));
    expect(evil.ok).toBe(false);
    const other = badgeTarget(new URLSearchParams('target=other'));
    expect(other.ok).toBe(false);
  });
});
