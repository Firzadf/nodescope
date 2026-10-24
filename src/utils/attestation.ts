/**
 * On-chain attestation, read-only by design.
 *
 * NodeScope never asks for a private key, never signs a transaction, and
 * never holds a wallet. Anchoring is done by the user with their own wallet
 * tool (MetaMask, cast, or Remix) against the registry contract in
 * contracts/NodeScopeAttestation.sol. This module only does two things:
 *
 * 1. Build the exact anchor call the user runs, so there is nothing to
 *    guess about what gets anchored.
 * 2. Verify an anchoring transaction on chain, read-only, from its receipt:
 *    the transaction must exist, must have succeeded, must have been sent
 *    to the registry contract, and must contain a log whose first indexed
 *    topic is the report hash itself. Indexed bytes32 values are stored
 *    verbatim as log topics, so this check needs no function selector and
 *    no event signature hash.
 *
 * What this does NOT prove: that the node data inside the report was true.
 * It proves that a report with this hash was anchored at the receipt's
 * block. The report's own integrity stamp, checked at /verify, is what
 * proves the file was not altered after export.
 */

export interface AttestationReceiptLog {
  address?: string | null;
  topics?: string[] | null;
}

export interface AttestationReceipt {
  status?: string | null;
  to?: string | null;
  blockNumber?: string | null;
  logs?: AttestationReceiptLog[] | null;
}

export type AttestationStatus =
  | 'anchored'
  | 'not_found'
  | 'failed'
  | 'wrong_contract'
  | 'no_matching_log'
  | 'invalid_input';

export interface AttestationVerification {
  status: AttestationStatus;
  reason: string;
  blockNumber?: number | null;
}

const HASH_RE = /^0x[0-9a-f]{64}$/;
const ADDRESS_RE = /^0x[0-9a-f]{40}$/;

export function normalizeHex(value: string): string {
  return value.trim().toLowerCase();
}

export function isReportHash(value: string): boolean {
  return HASH_RE.test(normalizeHex(value));
}

export function isAddress(value: string): boolean {
  return ADDRESS_RE.test(normalizeHex(value));
}

export function hexToDecimal(hex: string | null | undefined): number | null {
  if (!hex) return null;
  const parsed = parseInt(hex, 16);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * The exact cast command that anchors a report. The user runs it with their
 * own account; the command deliberately contains no private key.
 */
export function buildAnchorCommand(
  contractAddress: string,
  reportHash: string,
  endpoint: string,
  chainId: number,
  blockNumber: number,
): string {
  return (
    `cast send ${contractAddress} ` +
    `"anchor(bytes32,string,uint256,uint256)" ${reportHash} "${endpoint}" ${chainId} ${blockNumber} ` +
    `--rpc-url https://test-evm-rpc-v3.portaldot.dev --account <your-testnet-account>`
  );
}

export function verifyAttestationReceipt(
  receipt: AttestationReceipt | null,
  contractAddress: string,
  reportHash: string,
): AttestationVerification {
  if (!isAddress(contractAddress) || !isReportHash(reportHash)) {
    return {
      status: 'invalid_input',
      reason: 'The contract address or the report hash is not a valid hex value.',
    };
  }
  if (!receipt) {
    return {
      status: 'not_found',
      reason: 'No transaction receipt was found for this hash. The transaction may not exist yet, or may not be on this endpoint.',
    };
  }
  if (receipt.status !== '0x1') {
    return {
      status: 'failed',
      reason: 'The transaction exists but did not succeed (receipt status is not 0x1). A failed transaction anchors nothing.',
    };
  }
  if (!receipt.to || normalizeHex(receipt.to) !== normalizeHex(contractAddress)) {
    return {
      status: 'wrong_contract',
      reason: 'The transaction succeeded, but it was not sent to this registry contract.',
    };
  }
  const target = normalizeHex(reportHash);
  const match = (receipt.logs ?? []).some((log) => {
    if (!log.address || normalizeHex(log.address) !== normalizeHex(contractAddress)) return false;
    const topics = (log.topics ?? []).map((t) => normalizeHex(t));
    // topics[0] is the event signature; topics[1] is the indexed reportHash.
    return topics.length >= 2 && topics[1] === target;
  });
  if (!match) {
    return {
      status: 'no_matching_log',
      reason: 'The transaction went to the registry contract, but none of its logs carries this report hash as an indexed topic.',
    };
  }
  return {
    status: 'anchored',
    reason: 'The receipt succeeded, went to the registry contract, and carries this report hash as an indexed log topic.',
    blockNumber: hexToDecimal(receipt.blockNumber),
  };
}

/** Extract a report's SHA-256 integrity hash from pasted report JSON. */
export function parseReportHashFromJson(text: string): string | null {
  try {
    const parsed = JSON.parse(text) as { integrity?: { hash?: unknown } };
    const hash = parsed?.integrity?.hash;
    if (typeof hash === 'string' && isReportHash(hash)) return normalizeHex(hash);
    return null;
  } catch {
    return null;
  }
}
