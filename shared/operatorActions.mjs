/**
 * Next step for a node operator or validator running a self-check.
 *
 * The canonical score stays nodescope.health-score.v2. This module only
 * reads that score (and the stall assessment) and names what to do:
 * restart the node, switch or compare endpoints, check peers, or wait
 * for the Portaldot team. A stall adds a degradation line.
 *
 * `scope: 'public_testnet'` is the /status page, which checks the
 * published endpoints. A stall there is the chain, not the operator's
 * process, so the step is to wait rather than restart a validator.
 */

import {
  FINALITY_FULL_LAG_BLOCKS,
  FINALITY_ZERO_LAG_BLOCKS,
  PORTALDOT_EPOCH_SECONDS,
} from './liveStatus.mjs';

export const OPERATOR_ACTIONS_SCHEMA = 'nodescope.operator-actions.v1';

const PRIORITY = [
  'chain_identity',
  'transport_parity',
  'availability',
  'head_progression',
  'peer_sync',
  'finality',
  'rpc_reliability',
  'latency',
];

function action(kind, title, nextStep, short) {
  return { kind, title, nextStep, short };
}

const NONE = action(
  'none',
  'No action',
  'No action. This node is fit for your validator reads. Re-check before the next epoch if you are about to produce a block.',
  'No action. This node is fit for your validator reads.',
);

const RUN_CHECK = action(
  'run_check',
  'Run a self-check',
  'Run a health check and the Substrate probe on your node before you act on a score.',
  'Run a health check on your node before acting on a score.',
);

function failingComponents(score) {
  return (score?.components ?? []).filter(
    (c) => c && c.measured && typeof c.points === 'number' && typeof c.weight === 'number' && c.points < c.weight - 0.05,
  );
}

export function finalityEpochContext(input = {}) {
  const lagBlocks = input.lagBlocks;
  const age = input.finalizedAgeSeconds;
  let placement = 'unknown';
  if (typeof age === 'number' && Number.isFinite(age)) {
    placement = age >= PORTALDOT_EPOCH_SECONDS ? 'past_epoch' : 'inside_epoch';
  }
  const curve = `Canonical v2 still scores full marks at lag ≤ ${FINALITY_FULL_LAG_BLOCKS} blocks and zero at ≥ ${FINALITY_ZERO_LAG_BLOCKS} blocks. That curve is unchanged, so existing reports still verify.`;
  let timeText = 'One Portaldot epoch is 1 hour. The block-count thresholds were not retuned to that hour, because block lag and epoch time are different units.';
  if (placement === 'inside_epoch') {
    timeText = `The finalized head is ${age}s old, inside one Portaldot epoch (1 hour). Wait. Do not restart for lag that is still inside the epoch.`;
  } else if (placement === 'past_epoch') {
    timeText = `The finalized head is ${age}s old, past one Portaldot epoch (1 hour). If /status is also stalled, wait for the Portaldot team. If only this node is stuck, restart it.`;
  }
  const lagText = typeof lagBlocks === 'number' && Number.isFinite(lagBlocks)
    ? `Finality lag is ${lagBlocks} blocks.`
    : 'Finality lag was not measured as a block count.';
  return {
    epochSeconds: PORTALDOT_EPOCH_SECONDS,
    placement,
    note: `${lagText} ${curve} ${timeText}`,
  };
}

function componentAction(component, epoch) {
  const id = component.id;
  const detail = component.detail ?? '';
  if (id === 'chain_identity') {
    return action(
      'switch_endpoint',
      'Switch endpoint',
      'This endpoint is not your Portaldot node (chain 420420777). Point the self-check at that RPC.',
      'Switch to your Portaldot RPC. This endpoint is the wrong chain.',
    );
  }
  if (id === 'transport_parity') {
    return action(
      'switch_endpoint',
      'Compare transports',
      'The Substrate WebSocket did not answer. Compare it with your EVM RPC. If only the socket is down, restart the node or switch the WebSocket endpoint.',
      'WebSocket is down. Compare endpoints, then restart the node if the socket stays closed.',
    );
  }
  if (id === 'availability') {
    const hard = component.points === 0;
    return hard
      ? action(
          'restart_node',
          'Restart your node',
          'Your node did not answer the eligible checks. Restart it, then switch reads to a second endpoint until this check passes.',
          'Restart your node. It did not answer the eligible checks.',
        )
      : action(
          'switch_endpoint',
          'Switch endpoint',
          'Some RPC checks failed. Switch clients to a second endpoint. If that one is healthy and this one is yours, restart it.',
          'Switch to a second endpoint. Some RPC checks failed.',
        );
  }
  if (id === 'head_progression') {
    if (/inconclusive|only \d+ s apart/i.test(detail)) {
      return action(
        'wait',
        'Wait for another check',
        'The two head samples are too close to call a stall. Wait at least 30 seconds and run the check again before you restart.',
        'Wait and run the check again. The head gap is too short to act on.',
      );
    }
    if (/regressed/i.test(detail)) {
      return action(
        'switch_endpoint',
        'Switch endpoint',
        'The head went backwards. Switch endpoints and compare. Do not produce on a node whose head regressed.',
        'Switch endpoints. The head went backwards.',
      );
    }
    return action(
      'restart_node',
      'Restart if only this node is stuck',
      'The head is not advancing on your node. Open /status. If the public testnet is live, restart this node. If /status is stalled, wait for the Portaldot team.',
      'Head is not advancing. Restart only if /status shows the public testnet is live.',
    );
  }
  if (id === 'peer_sync') {
    if (/0 peers|peers 0/i.test(detail)) {
      return action(
        'check_peers',
        'Check peers',
        'Check peers and reserved peers on your node. An isolated validator serves a head the rest of the network has left.',
        'Check peers. This node looks isolated.',
      );
    }
    if (/syncing(?! unknown)/i.test(detail) && !/not syncing/i.test(detail)) {
      return action(
        'wait',
        'Wait for sync',
        'Your node is still syncing. Wait until it reports not syncing before you serve validator reads. Do not restart a node that is catching up unless peers are zero.',
        'Wait for sync to finish before serving reads.',
      );
    }
    return action(
      'check_peers',
      'Check sync',
      'The sync gap is above the line this score uses. Leave the node to catch up, or switch reads to a node inside the gap. Check peers if the gap is not closing.',
      'Check peers and sync. The gap is above the score line.',
    );
  }
  if (id === 'finality') {
    if (epoch?.placement === 'past_epoch') {
      return action(
        'wait_for_team',
        'Wait if the chain is paused',
        epoch.note,
        'Finality is past one epoch (1 hour). Wait for the team if /status is stalled; otherwise restart this node.',
      );
    }
    return action(
      'wait',
      'Wait for finality',
      epoch?.note ?? 'Finality is behind. Wait. One Portaldot epoch is 1 hour, and the canonical block curve was not retuned.',
      'Wait for finality. One Portaldot epoch is 1 hour. Do not restart yet.',
    );
  }
  if (id === 'rpc_reliability') {
    return action(
      'switch_endpoint',
      'Switch endpoint',
      'Repeated calls failed. Switch clients to a second endpoint. Restart this node if the error ratio stays high on the next self-check.',
      'Switch endpoints. Repeated RPC calls failed.',
    );
  }
  if (id === 'latency') {
    return action(
      'switch_endpoint',
      'Compare latency',
      'Latency is above the full-marks line (300 ms). Compare a second endpoint and switch reads to the faster one if this node stays slow against your baseline.',
      'Compare a second endpoint. Latency is above the full-marks line.',
    );
  }
  return action(
    'switch_endpoint',
    'Compare endpoints',
    `${component.label ?? id} lost points. Compare a second endpoint before you keep serving from this one.`,
    `Compare endpoints. ${component.label ?? id} lost points.`,
  );
}

function stallPlan(scope, ws) {
  if (scope === 'public_testnet') {
    return {
      overall: action(
        'wait_for_team',
        'Wait for the team',
        'Wait for the Portaldot team. The public testnet itself is stalled. Restarting your validator will not move a paused chain.',
        'Wait for the Portaldot team. The public testnet is stalled. Do not restart your validator only because this page is stalled.',
      ),
      degradation: 'Degrade: stop broadcasts and do not treat recent blocks as included. The public testnet head is not progressing. Wait for the Portaldot team.',
    };
  }
  const peers = ws && typeof ws.peers === 'number' ? ws.peers : null;
  const expectsPeers = !ws || ws.shouldHavePeers !== false;
  if (peers === 0 && expectsPeers) {
    return {
      overall: action(
        'check_peers',
        'Check peers',
        'Your node looks stalled and reports no peers. Check peers and reserved peers. If the count stays at zero, restart the node. If peers return and /status is also stalled, wait for the Portaldot team instead of restarting again.',
        'Check peers on your node. If the count stays at zero, restart it.',
      ),
      degradation: 'Degrade: stop using this endpoint for inclusion. Check peers first. Restart only if the node stays isolated. If /status is stalled too, wait for the Portaldot team.',
    };
  }
  if (ws && ws.status && ws.status !== 'ok') {
    return {
      overall: action(
        'switch_endpoint',
        'Switch endpoint',
        'Your node looks stalled and the WebSocket did not answer. Switch reads to a second endpoint, then restart this node if the socket stays closed.',
        'Switch endpoints. The WebSocket is down while the head is stalled.',
      ),
      degradation: 'Degrade: do not serve reads from a node whose WebSocket is down. Switch endpoints, then restart this node if the socket stays closed.',
    };
  }
  return {
    overall: action(
      'wait_for_team',
      'Wait if the chain is paused',
      'Your node looks stalled and it still has peers (or peer count was not read). Open /status. If the public testnet is stalled too, wait for the Portaldot team and do not restart. If /status is live, only this node is stuck: restart it.',
      'Open /status. If the public testnet is stalled too, wait for the team. If only this node is stuck, restart it.',
    ),
    degradation: 'Degrade: do not broadcast and do not treat the latest block as finalized. Open /status. Wait for the Portaldot team when the public testnet is stalled. Restart this node only when /status is live and this head is the one that stopped.',
  };
}

function underScoreFallback(score) {
  if (score?.score == null) return null;
  if (score.score >= 90) return NONE;
  return action(
    'switch_endpoint',
    'Compare endpoints',
    'The score is under 90. Open the component list and follow the one that lost points. If you cannot tell which part failed, switch to a second endpoint and compare.',
    'Score under 90. Compare a second endpoint before you keep serving from this one.',
  );
}

/**
 * @param {object} input
 * @param {'self'|'public_testnet'} [input.scope]
 * @param {object|null} [input.score] computeHealthScoreV2 result, or a partial {score, components}
 * @param {object|null} [input.stall] assessStall result
 * @param {object|null} [input.wsProbe]
 * @param {object|null} [input.parity] assessEndpointParity result
 */
export function planOperatorActions(input = {}) {
  const scope = input.scope === 'public_testnet' ? 'public_testnet' : 'self';
  const score = input.score ?? null;
  const stall = input.stall ?? null;
  const ws = input.wsProbe ?? null;
  const parity = input.parity ?? null;
  const lag = typeof stall?.finalityLagBlocks === 'number'
    ? stall.finalityLagBlocks
    : typeof ws?.finalityLagBlocks === 'number'
      ? ws.finalityLagBlocks
      : null;
  const epoch = finalityEpochContext({
    lagBlocks: lag,
    finalizedAgeSeconds: stall?.finalizedAgeSeconds ?? null,
  });
  const failing = failingComponents(score);
  const components = failing
    .map((c) => ({ id: c.id, label: c.label ?? c.id, action: componentAction(c, epoch) }))
    .sort((a, b) => PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id));

  let overall = NONE;
  let degradation = null;
  if (stall?.state === 'stalled') {
    const stalled = stallPlan(scope, ws);
    overall = stalled.overall;
    degradation = stalled.degradation;
  } else if (failing.some((c) => c.id === 'chain_identity' && c.points === 0)) {
    overall = componentAction(failing.find((c) => c.id === 'chain_identity'), epoch);
  } else if (parity?.status === 'persistent_gap') {
    overall = action(
      'switch_endpoint',
      'Switch endpoint',
      parity.summary || 'EVM and Substrate heads disagree by more than 2 blocks, and the gap persisted across checks. Switch or compare endpoints.',
      'Switch endpoints. EVM and Substrate heads show a persistent gap above 2 blocks.',
    );
  } else if (failing.length > 0) {
    const ranked = [...failing].sort((a, b) => {
      const lost = (b.weight - b.points) - (a.weight - a.points);
      if (Math.abs(lost) > 0.05) return lost;
      return PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id);
    });
    overall = componentAction(ranked[0], epoch);
  } else if (!score || score.score == null) {
    const measured = (score?.components ?? []).some((c) => c.measured);
    overall = measured ? underScoreFallback(score) ?? RUN_CHECK : RUN_CHECK;
    if (score && score.score == null && measured) {
      overall = action(
        'run_check',
        'Measure more of the score',
        'Less than half of the formula is measured, so there is no score to act on. Run the health check and the Substrate probe on your node.',
        'Run the health check and the Substrate probe. The score is not covered yet.',
      );
    }
  } else {
    const fallback = underScoreFallback(score);
    const componentsProvided = Array.isArray(score.components) && score.components.length > 0;
    overall = componentsProvided ? NONE : (fallback ?? NONE);
  }

  const showEpoch = failing.some((c) => c.id === 'finality') || stall?.state === 'stalled' || epoch.placement !== 'unknown';

  return {
    schema: OPERATOR_ACTIONS_SCHEMA,
    scope,
    overall,
    degradation,
    components,
    parity: parity
      ? { status: parity.status, summary: parity.summary }
      : null,
    finalityEpoch: showEpoch ? epoch : null,
  };
}
