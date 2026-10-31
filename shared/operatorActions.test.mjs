import { describe, expect, it } from 'vitest';
import { computeHealthScoreV2, finalityPoints, WEIGHTS_V2 } from './liveStatus.mjs';
import { assessEndpointParity, assessTransportHeads, HEAD_GAP_TOLERANCE_BLOCKS } from './endpointParity.mjs';
import { finalityEpochContext, planOperatorActions } from './operatorActions.mjs';

function component(id, weight, points, detail = '') {
  return { id, label: id, weight, measured: true, points, detail };
}

const full = [
  component('availability', 20, 20),
  component('chain_identity', 10, 10),
  component('head_progression', 15, 15),
  component('finality', 15, 15),
  component('latency', 10, 10),
  component('transport_parity', 10, 10),
  component('peer_sync', 10, 10),
  component('rpc_reliability', 10, 10),
];

describe('operator actions', () => {
  it('keeps the canonical finality curve and treats one epoch as one hour of context', () => {
    expect(finalityPoints(4)).toBe(WEIGHTS_V2.finality);
    expect(finalityPoints(64)).toBe(0);
    const inside = finalityEpochContext({ lagBlocks: 12, finalizedAgeSeconds: 600 });
    expect(inside.epochSeconds).toBe(3600);
    expect(inside.placement).toBe('inside_epoch');
    expect(inside.note).toContain('1 hour');
    expect(inside.note).toContain('unchanged');
    expect(finalityEpochContext({ lagBlocks: 80, finalizedAgeSeconds: 3700 }).placement).toBe('past_epoch');
  });

  it('tells a validator to wait for the team when the public testnet is stalled', () => {
    const plan = planOperatorActions({
      scope: 'public_testnet',
      score: { score: 81, components: full },
      stall: { state: 'stalled', finalityLagBlocks: 2, finalizedAgeSeconds: 4000 },
      wsProbe: { status: 'ok', peers: 0, shouldHavePeers: true },
    });
    expect(plan.overall.kind).toBe('wait_for_team');
    expect(plan.overall.short).toContain('Wait for the Portaldot team');
    expect(plan.overall.short).toContain('Do not restart your validator');
    expect(plan.degradation).toMatch(/Degrade:/);
    expect(plan.degradation).toContain('public testnet');
  });

  it('tells the operator to check peers when their own node is stalled and isolated', () => {
    const plan = planOperatorActions({
      scope: 'self',
      score: { score: 40, components: full },
      stall: { state: 'stalled', finalizedAgeSeconds: 200 },
      wsProbe: { status: 'ok', peers: 0, shouldHavePeers: true },
    });
    expect(plan.overall.kind).toBe('check_peers');
    expect(plan.degradation).toMatch(/Degrade:/);
    expect(plan.degradation).toContain('Check peers');
  });

  it('points a peered stall at /status before a restart', () => {
    const plan = planOperatorActions({
      scope: 'self',
      stall: { state: 'stalled', finalizedAgeSeconds: 200 },
      wsProbe: { status: 'ok', peers: 4, shouldHavePeers: true },
      score: { score: 50, components: full },
    });
    expect(plan.overall.kind).toBe('wait_for_team');
    expect(plan.overall.nextStep).toContain('/status');
    expect(plan.overall.nextStep).toContain('restart');
    expect(plan.degradation).toMatch(/Degrade:/);
  });

  it('names a next step for a failing component without touching the canonical score', () => {
    const snapshots = [{
      timestamp: 1_000_000,
      endpointOrigin: 'https://rpc.example',
      endpointProfile: 'portaldot_v3_evm',
      checks: [
        { method: 'eth_chainId', success: true, outcome: 'success', observedValue: '0x190f1ca9', latencyMs: 800 },
        { method: 'eth_blockNumber', success: true, outcome: 'success', observedValue: '0x10', latencyMs: 800 },
      ],
    }];
    const before = computeHealthScoreV2({ snapshots });
    const plan = planOperatorActions({ scope: 'self', score: before, stall: { state: 'live' }, parity: null });
    const after = computeHealthScoreV2({ snapshots });
    expect(after).toEqual(before);
    expect(after.formula).toBe('nodescope.health-score.v2');
    expect(plan.schema).toBe('nodescope.operator-actions.v1');
    const latency = plan.components.find((c) => c.id === 'latency');
    expect(latency?.action.kind).toBe('switch_endpoint');
    expect(plan.overall.kind).not.toBe('none');
    expect(plan.overall.nextStep.length).toBeGreaterThan(10);
  });

  it('stays quiet when every component is at full marks', () => {
    const plan = planOperatorActions({
      scope: 'self',
      score: { score: 100, components: full },
      stall: { state: 'live', finalizedAgeSeconds: 12, finalityLagBlocks: 1 },
    });
    expect(plan.overall.kind).toBe('none');
    expect(plan.components).toEqual([]);
    expect(plan.degradation).toBeNull();
    expect(plan.finalityEpoch?.placement).toBe('inside_epoch');
  });

  it('switches endpoints only when the EVM and Substrate gap persists', () => {
    const once = planOperatorActions({
      scope: 'self',
      score: { score: 100, components: full },
      stall: { state: 'live' },
      parity: { status: 'gap_once', summary: 'One reading is not a persistent gap.' },
    });
    expect(once.overall.kind).toBe('none');
    const plan = planOperatorActions({
      scope: 'self',
      score: { score: 100, components: full },
      stall: { state: 'live' },
      parity: { status: 'persistent_gap', summary: 'Persistent gap of 6 blocks.' },
    });
    expect(plan.overall.kind).toBe('switch_endpoint');
    expect(plan.overall.short).toContain('persistent gap');
    expect(plan.overall.short).toContain('2 blocks');
  });

  it('asks for a second endpoint comparison when the score is low and components were not supplied', () => {
    const plan = planOperatorActions({
      scope: 'self',
      score: { score: 75, components: [] },
      stall: { state: 'live' },
    });
    expect(plan.overall.kind).toBe('switch_endpoint');
    expect(plan.overall.short).toContain('under 90');
  });
});

describe('EVM versus Substrate head gap', () => {
  it('accepts a gap of 2 blocks and does not treat one larger gap as persistent', () => {
    expect(HEAD_GAP_TOLERANCE_BLOCKS).toBe(2);
    const fine = assessTransportHeads({ evmHeight: '100', wssHeight: '98' });
    expect(fine.status).toBe('within_tolerance');
    expect(fine.persistent).toBe(false);
    expect(fine.summary).toContain('acceptable');
    const once = assessTransportHeads({ evmHeight: '110', wssHeight: '100' });
    expect(once.status).toBe('gap_once');
    expect(once.persistent).toBe(false);
    expect(once.summary).toContain('not a persistent gap');
    const again = assessTransportHeads({ evmHeight: '120', wssHeight: '100', priorAbsGaps: [10] });
    expect(again.status).toBe('persistent_gap');
    expect(again.persistent).toBe(true);
    expect(again.summary).toContain('does not change nodescope.health-score.v2');
  });

  it('reads the latest EVM height and the Substrate header, not a second EVM endpoint', () => {
    const parity = assessEndpointParity({
      snapshots: [{
        timestamp: 2,
        checks: [{ method: 'eth_blockNumber', success: true, observedValue: '0x10' }],
      }],
      wsProbe: { headerNumberDecimal: '14' },
    });
    expect(parity.status).toBe('within_tolerance');
    expect(parity.gap).toBe(2);
    expect(assessEndpointParity({ snapshots: [], wsProbe: null }).status).toBe('unmeasured');
  });
});
