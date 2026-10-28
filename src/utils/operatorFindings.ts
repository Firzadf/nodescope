import type { Finding } from '../types/diagnostic';
import type { SubstrateWsProbeResult } from '../services/substrateWsProbe';
import type { ReliabilityReport } from '../services/reliabilityProbe';
import type { StallAssessment } from './stall';
import type { UnitsSanity } from './unitsSanity';
import { SYNC_GAP_FULL_BLOCKS } from '../../shared/liveStatus.mjs';
import { parseHeight } from '../../shared/liveStatus.mjs';

/** Findings an operator can act on. Each one names the measurement. */
export function operatorFindings(input: {
  stall?: StallAssessment | null;
  wsProbe?: SubstrateWsProbeResult | null;
  reliability?: ReliabilityReport | null;
  units?: UnitsSanity | null;
}): Finding[] {
  const out: Finding[] = [];
  const stall = input.stall;
  if (stall?.state === 'stalled') {
    out.push({
      ruleId: 'chain.stalled',
      severity: 'error',
      title: 'Chain paused but RPC answers',
      evidence: stall.explanation,
      explanation: 'The endpoint is answering, and the best head and/or the finalized head has not advanced past the published threshold. Transfers broadcast in this window do not get included.',
      recommendation: 'Treat the node as STALLED, not healthy. Watch for a resume alert before retrying broadcasts.',
    });
  }
  const ws = input.wsProbe;
  if (ws?.status === 'ok' && ws.peers === 0 && ws.shouldHavePeers !== false) {
    out.push({
      ruleId: 'node.no-peers',
      severity: 'warning',
      title: 'No peers while the node expects them',
      evidence: `system_health.peers = 0, shouldHavePeers = ${String(ws.shouldHavePeers)}.`,
      explanation: 'An isolated node can keep serving RPC against a head that the rest of the network has left behind, or that has stopped.',
      recommendation: 'Check the node is reachable by the network and that reserved peers, if any, are up.',
    });
  }
  if (ws?.status === 'ok' && ws.isSyncing === true) {
    out.push({
      ruleId: 'node.syncing',
      severity: 'warning',
      title: 'Node is syncing',
      evidence: 'system_health.isSyncing = true.',
      explanation: 'A syncing node answers RPC with a head that is not the network head yet.',
      recommendation: 'Wait until isSyncing is false before treating this endpoint as a source of truth.',
    });
  }
  if (ws?.status === 'ok' && ws.syncCurrentBlock != null && ws.syncHighestBlock != null) {
    const current = parseHeight(ws.syncCurrentBlock);
    const highest = parseHeight(ws.syncHighestBlock);
    if (current !== null && highest !== null) {
      const gap = Number(highest - current);
      if (gap > SYNC_GAP_FULL_BLOCKS) {
        out.push({
          ruleId: 'node.sync-gap',
          severity: 'warning',
          title: 'Sync gap above the threshold',
          evidence: `system_syncState current ${current.toString()}, highest ${highest.toString()}, gap ${gap} blocks (threshold ${SYNC_GAP_FULL_BLOCKS}).`,
          explanation: 'The node knows of a higher block than the one it has imported.',
          recommendation: 'Leave it to catch up, or point reads at a node whose gap is inside the threshold.',
        });
      }
    }
  }
  if (ws?.status === 'ok' && ws.advertisedUnsafeMethods && ws.advertisedUnsafeMethods.length > 0) {
    out.push({
      ruleId: 'rpc.unsafe-methods-wss',
      severity: 'error',
      title: 'Substrate RPC advertises unsafe operator methods',
      evidence: ws.advertisedUnsafeMethods.join(', '),
      explanation: 'These names came from rpc_methods on the WebSocket. None of them were called.',
      recommendation: 'Disable unsafe RPC methods for external callers.',
    });
  }
  if (ws?.status === 'ok' && typeof ws.finalityLagBlocks === 'number' && ws.finalityLagBlocks > 4) {
    out.push({
      ruleId: 'finality.lag',
      severity: ws.finalityLagBlocks >= 64 ? 'error' : 'warning',
      title: 'Finality lag',
      evidence: `Best #${ws.headerNumberDecimal ?? '—'} − finalized #${ws.finalizedNumberDecimal ?? '—'} = ${ws.finalityLagBlocks} blocks.`,
      explanation: 'Blocks past the finalized head can still be re-orged. Full marks on the v2 score stop at 4 blocks of lag; 64 or more scores zero.',
      recommendation: 'Wait for finality before treating a recent block as settled.',
    });
  }
  const rel = input.reliability;
  if (rel && rel.samples > 0 && rel.errors > 0) {
    out.push({
      ruleId: 'rpc.error-rate',
      severity: rel.errors / rel.samples >= 0.5 ? 'error' : 'warning',
      title: 'Repeated RPC calls failed',
      evidence: `${rel.errors}/${rel.samples} eth_blockNumber calls failed, ${rel.http5xx} of them HTTP 5xx.`,
      explanation: 'A node that answers once and then returns 503s will pass a single health check and fail a real client.',
      recommendation: 'Retry from a second endpoint, and watch the error ratio rather than one success.',
    });
  }
  if (rel && rel.history === 'pruned-state') {
    out.push({
      ruleId: 'rpc.pruned-state',
      severity: 'info',
      title: 'Historical state is not available',
      evidence: rel.historyDetail,
      explanation: 'A pruned node is a valid node. Clients that read old state need an archival endpoint or an indexer.',
      recommendation: 'Do not use this endpoint for historical eth_call or eth_getBalance.',
    });
  } else if (rel && rel.history === 'pruned-headers') {
    out.push({
      ruleId: 'rpc.pruned-headers',
      severity: 'warning',
      title: 'Historical headers are not available',
      evidence: rel.historyDetail,
      explanation: 'The old block this probe asked for was not served.',
      recommendation: 'Use an endpoint that still has that history, or an indexer.',
    });
  } else if (rel && rel.history === 'historical') {
    out.push({
      ruleId: 'rpc.historical',
      severity: 'info',
      title: 'Historical state answered',
      evidence: rel.historyDetail,
      explanation: 'One old block served both its header and an account balance. That is evidence of history at that depth, not a proof of a full archive.',
      recommendation: 'No action. The depth checked is recorded in the evidence.',
    });
  }
  if (rel && rel.unsafe.length > 0) {
    out.push({
      ruleId: 'rpc.unsafe-methods',
      severity: 'error',
      title: 'Public RPC advertises unsafe operator methods',
      evidence: rel.unsafe.map((m) => m.method).join(', '),
      explanation: 'These names came from rpc_methods. None of them were called. author_insertKey, author_rotateKeys, offchain_localStorageSet, and the peer/log admin methods should not be reachable on a public endpoint.',
      recommendation: 'Restart the node with the unsafe RPC methods disabled for external callers.',
    });
  }
  const units = input.units;
  if (units?.mismatch) {
    out.push({
      ruleId: 'units.mismatch',
      severity: 'warning',
      title: 'Token decimals disagree',
      evidence: units.detail,
      explanation: 'system_properties reported more than one decimals value.',
      recommendation: 'Do not assume a single scale until the node reports one.',
    });
  } else if (units?.decimalTrap) {
    out.push({
      ruleId: 'units.decimal-trap',
      severity: 'warning',
      title: 'Decimal trap: native decimals are not 18',
      evidence: units.detail,
      explanation: 'EVM libraries format balances as 10^18 wei. This chain does not. The factor is the amount a balance is overstated by when that assumption is applied.',
      recommendation: `Format native balances with ${units.nativeDecimals} decimals (${units.symbol ?? 'the reported symbol'}), not 18.`,
    });
  }
  return out;
}
