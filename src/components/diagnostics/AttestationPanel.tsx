import { useState } from 'react';
import { Anchor, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import { sendJsonRpcRequest } from '../../services/rpcClient';
import {
  buildAnchorCommand,
  isAddress,
  isReportHash,
  parseReportHashFromJson,
  verifyAttestationReceipt,
  type AttestationVerification,
} from '../../utils/attestation';

/**
 * Optional on-chain attestation, verified read-only.
 *
 * NodeScope never signs anything here. The user anchors a report hash with
 * their own wallet tool, then this panel checks the anchoring transaction's
 * receipt on chain. Until a registry contract is deployed and a report is
 * anchored, this panel honestly reports that there is nothing to verify.
 * See contracts/NodeScopeAttestation.sol and docs/ATTESTATION.md.
 */
export function AttestationPanel({ endpoint }: { endpoint: string }) {
  const [reportText, setReportText] = useState('');
  const [reportHash, setReportHash] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [txHash, setTxHash] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AttestationVerification | null>(null);

  const extracted = parseReportHashFromJson(reportText);
  const effectiveHash = reportHash.trim() || extracted || '';
  const canCheck =
    isAddress(contractAddress) && isReportHash(effectiveHash) && /^0x[0-9a-fA-F]{64}$/.test(txHash.trim());

  async function checkOnChain() {
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const res = await sendJsonRpcRequest(endpoint, 'eth_getTransactionReceipt', [txHash.trim()], 10000);
      if (!res.success) {
        setError(res.error || 'The endpoint did not answer the receipt request.');
        return;
      }
      const receipt = res.response?.result as
        | { status?: string; to?: string | null; blockNumber?: string; logs?: { address?: string; topics?: string[] }[] }
        | null;
      setResult(verifyAttestationReceipt(receipt, contractAddress.trim(), effectiveHash));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Receipt check failed.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card ticks>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PanelLabel index="04" label="ON-CHAIN ATTESTATION — OPTIONAL" />
        <span className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-600">
          Read-only check · NodeScope signs nothing
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">
        Anchoring is optional and separate from the report itself. A report is already verifiable
        off chain at /verify through its SHA-256 stamp. Anchoring adds one more fact: that a report
        with this hash existed at a specific block, recorded by the registry contract. It does not
        prove the node data inside the report was true, and NodeScope never asks for a private key
        to do it. Anchor with your own wallet tool, then verify the transaction here.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Report JSON (optional — extracts its integrity hash)
          </span>
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            rows={3}
            placeholder="Paste an exported report here, or type its integrity hash below."
            className="mt-1.5 w-full rounded-lg border border-line bg-black/25 px-3 py-2 font-data text-xs text-slate-200"
          />
        </label>
        {reportText.trim() && !extracted && (
          <p className="text-xs text-amber-400">
            No valid integrity hash was found in that JSON. Paste a full exported report, or type the hash below.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">Report hash (SHA-256)</span>
            <input
              value={reportHash}
              onChange={(e) => setReportHash(e.target.value)}
              placeholder={extracted || '0x… (64 hex characters)'}
              className="mt-1.5 w-full rounded-lg border border-line bg-black/25 px-3 py-2 font-data text-xs text-slate-200"
            />
          </label>
          <label className="block">
            <span className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">Registry contract address</span>
            <input
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="0x… (deployed NodeScopeAttestation)"
              className="mt-1.5 w-full rounded-lg border border-line bg-black/25 px-3 py-2 font-data text-xs text-slate-200"
            />
          </label>
        </div>
        <label className="block">
          <span className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">Anchoring transaction hash</span>
          <input
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0x…"
            className="mt-1.5 w-full rounded-lg border border-line bg-black/25 px-3 py-2 font-data text-xs text-slate-200"
          />
        </label>
        {canCheck && (
          <div className="rounded-lg border border-line bg-black/25 p-3">
            <p className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Anchor command (run with your own wallet tool — no key in this command)
            </p>
            <code className="mt-1.5 block break-all font-data text-[11px] leading-relaxed text-slate-300">
              {buildAnchorCommand(contractAddress.trim(), effectiveHash.toLowerCase(), 'https://test-evm-rpc-v3.portaldot.dev', 420420777, 0)}
            </code>
            <p className="mt-1.5 text-[11px] text-slate-500">
              The block number above is a placeholder: use the block at which you anchor. The
              command is shown for reference only; this panel never runs it.
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={checkOnChain}
          disabled={!canCheck || checking}
          className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium"
        >
          <Anchor className="h-4 w-4" />
          {checking ? 'Checking on chain…' : 'Verify anchor on chain'}
        </button>
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{error}</div>
        )}
        {result && (
          <div
            className={`flex items-start gap-3 rounded-lg border p-3 ${
              result.status === 'anchored'
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-amber-500/30 bg-amber-500/10'
            }`}
          >
            {result.status === 'anchored' ? (
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
            )}
            <div>
              <p className={`font-data text-xs font-semibold uppercase tracking-[0.16em] ${result.status === 'anchored' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {result.status === 'anchored' ? 'Anchored' : 'Not verified as anchored'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{result.reason}</p>
              {result.blockNumber !== null && result.blockNumber !== undefined && (
                <p className="mt-1 font-data text-xs text-slate-400">Anchor block: {result.blockNumber}</p>
              )}
            </div>
          </div>
        )}
        {!result && !error && (
          <p className="text-xs text-slate-500">
            No registry contract is deployed yet, so there is currently nothing to verify. That
            state is reported here plainly, not filled with a placeholder transaction.
          </p>
        )}
      </div>
    </Card>
  );
}
