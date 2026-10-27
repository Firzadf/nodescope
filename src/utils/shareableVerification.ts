import { isAddress, isReportHash } from './attestation';
import deployments from '../../deployments/portaldot-v3.json';

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
 * The default registry comes from deployments/portaldot-v3.json, written
 * by scripts/deploy-attestation.sh and scripts/anchor-report.sh — never
 * from a second hand-written copy of the address. The 25 Oct 2026 anchor
 * on the earlier registry is kept separately as SUPPLEMENT_* in
 * utils/siteConstants and shown on /judges with its date label.
 *
 * Canonical form:
 *   /verify?hash=0x…&contract=0x…&tx=0x…
 * where hash is the report SHA-256, contract is the registry address,
 * and tx is the anchoring transaction hash.
 */

export const DEPLOYED_REGISTRY_ADDRESS: string = deployments.contract;
export const DEPLOYED_REGISTRY_CHAIN_ID: number = deployments.chainId;

/**
 * The latest anchor recorded in deployments/portaldot-v3.json (the last
 * entry of the anchors array), or null when the file records a deployment
 * with no anchor yet. The attestation panel offers it as a one-click
 * fill-in; it never signs anything.
 *
 * Blocks are stored as decimal integers in the deployments file; the
 * panel's display helper takes a hex string, so the block is converted
 * back here (216346 -> "0x34d1a").
 */
const LATEST_ANCHOR =
  Array.isArray(deployments.anchors) && deployments.anchors.length > 0
    ? deployments.anchors[deployments.anchors.length - 1]
    : null;
export const REFERENCE_ANCHOR: { hash: string; tx: string; block: string } | null =
  LATEST_ANCHOR == null
    ? null
    : {
        hash: LATEST_ANCHOR.reportHash as string,
        tx: LATEST_ANCHOR.txHash as string,
        block: `0x${(LATEST_ANCHOR.block as number).toString(16)}`,
      };

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
