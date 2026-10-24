import { isAddress, isReportHash } from './attestation';

/**
 * Shareable verification links.
 *
 * A judge should not have to copy three hex values by hand to check an
 * anchor, as the first anchor proved: a hash pasted into the wrong field
 * fails a check that would otherwise pass. One link carries all three
 * values to the public /verify page, which pre-fills the attestation
 * panel from them. The link itself proves nothing: the panel still fetches
 * the receipt on chain and checks it read-only, and an invalid value in
 * the link is ignored, never treated as verified.
 *
 * Canonical form:
 *   /verify?hash=0x…&contract=0x…&tx=0x…
 * where hash is the report SHA-256, contract is the registry address,
 * and tx is the anchoring transaction hash.
 */

export const DEPLOYED_REGISTRY_ADDRESS = '0x74c88d3090aD6915BFDc373eD6F037e2da4557Ce';
export const DEPLOYED_REGISTRY_CHAIN_ID = 420420777;

export interface ShareParams {
  hash?: string;
  contract?: string;
  tx?: string;
}

const TX_RE = /^0x[0-9a-fA-F]{64}$/;

export function isTransactionHash(value: string): boolean {
  return TX_RE.test(value.trim());
}

/** Parse a query string, keeping only values that pass their own validation. */
export function parseShareParams(search: string): ShareParams {
  const params = new URLSearchParams(search);
  const out: ShareParams = {};
  const hash = params.get('hash');
  if (hash && isReportHash(hash)) out.hash = hash.trim().toLowerCase();
  const contract = params.get('contract');
  if (contract && isAddress(contract)) out.contract = contract.trim();
  const tx = params.get('tx');
  if (tx && isTransactionHash(tx)) out.tx = tx.trim().toLowerCase();
  return out;
}

/** Build a shareable /verify link from validated values only. */
export function buildAttestationShareLink(origin: string, params: ShareParams): string | null {
  const parsed = parseShareParams(
    new URLSearchParams({
      ...(params.hash ? { hash: params.hash } : {}),
      ...(params.contract ? { contract: params.contract } : {}),
      ...(params.tx ? { tx: params.tx } : {}),
    }).toString(),
  );
  if (!parsed.hash || !parsed.contract || !parsed.tx) return null;
  const query = new URLSearchParams({
    hash: parsed.hash,
    contract: parsed.contract,
    tx: parsed.tx,
  }).toString();
  return `${origin.replace(/\/$/, '')}/verify?${query}`;
}
