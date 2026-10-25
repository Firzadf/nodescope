import type { HealthCheckSnapshot } from '../types/healthCheck';
import type { SubstrateWsProbeResult } from '../services/substrateWsProbe';
import { getV3Era, v3EraLabel } from './v3Era';

/**
 * Combined EVM + Substrate verdict.
 *
 * The two sides are shown side by side, never subtracted from each other:
 * the EVM block height comes from eth_blockNumber over HTTP, while the
 * Substrate header number comes from chain_getHeader over WebSocket.
 * They are different counters on different transports, so a difference
 * between them is not a lag, a drift, or a finding. It is just two
 * numbers from two transports, each with its own timestamp.
 */

export interface EvmSide {
  endpointOrigin: string;
  timestamp: string;
  era: string;
  blockHeightHex: string | null;
  blockHeightDecimal: string | null;
  chainIdHex: string | null;
  chainIdDecimal: string | null;
  checksPassed: number;
  checksTotal: number;
}

export type CombinedStatus = 'complete' | 'partial' | 'unavailable';

export interface CombinedVerdict {
  status: CombinedStatus;
  evm: EvmSide | null;
  substrate: SubstrateWsProbeResult | null;
  warnings: string[];
}

export const CROSS_TRANSPORT_NOTE =
  'EVM block height and Substrate header number are different counters on different transports. ' +
  'They are shown side by side with their own timestamps and are never subtracted from each other.';

export function hexToDecimal(raw: string | number | boolean | null): string | null {
  if (typeof raw !== 'string' || !/^0x[0-9a-fA-F]+$/.test(raw)) return null;
  try {
    return BigInt(raw).toString(10);
  } catch {
    return null;
  }
}

function checkValue(snapshot: HealthCheckSnapshot, method: string): string | null {
  const check = snapshot.checks.find((c) => c.method === method);
  if (!check || !check.success) return null;
  if (typeof check.observedValue === 'string') return check.observedValue;
  if (typeof check.observedValue === 'number') return String(check.observedValue);
  return null;
}

export function extractEvmSide(snapshot: HealthCheckSnapshot | null): EvmSide | null {
  if (!snapshot) return null;
  const blockHex = checkValue(snapshot, 'eth_blockNumber');
  const chainHex = checkValue(snapshot, 'eth_chainId');
  return {
    endpointOrigin: snapshot.endpointOrigin,
    timestamp: new Date(snapshot.timestamp).toISOString(),
    era: v3EraLabel(getV3Era(snapshot.timestamp)),
    blockHeightHex: blockHex,
    blockHeightDecimal: blockHex ? hexToDecimal(blockHex) : null,
    chainIdHex: chainHex,
    chainIdDecimal: chainHex ? hexToDecimal(chainHex) : null,
    checksPassed: snapshot.checks.filter((c) => c.success).length,
    checksTotal: snapshot.checks.length,
  };
}

export function computeCombinedVerdict(
  evm: EvmSide | null,
  substrate: SubstrateWsProbeResult | null,
): CombinedVerdict {
  const warnings: string[] = [];
  const evmOk = evm !== null && evm.checksPassed > 0;
  const wsOk = substrate !== null && substrate.status === 'ok';

  if (evm === null) {
    warnings.push('No EVM health snapshot yet. Run a health check to add the EVM side.');
  } else if (!evmOk) {
    warnings.push('The latest EVM health snapshot has no passing check, so the EVM side is not attested.');
  }
  if (substrate === null) {
    warnings.push('No Substrate probe result yet. Run the Substrate WS probe below to add the second transport.');
  } else if (!wsOk) {
    warnings.push(`The Substrate probe failed (${substrate.error ?? 'unknown error'}), so this verdict covers the EVM side only.`);
  }
  if (evm && evm.chainIdDecimal !== null && evm.chainIdDecimal !== '420420777') {
    warnings.push(`EVM chain ID is ${evm.chainIdDecimal}, not the documented Portaldot V3 testnet chain 420420777.`);
  }

  const status: CombinedStatus = evmOk && wsOk ? 'complete' : evmOk || wsOk ? 'partial' : 'unavailable';
  return { status, evm, substrate, warnings };
}
