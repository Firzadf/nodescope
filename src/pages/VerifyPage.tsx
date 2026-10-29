import { PaperHeader } from '../components/layout/PaperHeader';
import { ReportVerifier } from '../components/diagnostics/ReportVerifier';
import { AttestationPanel } from '../components/diagnostics/AttestationPanel';
import { parseShareParams } from '../utils/shareableVerification';
import { DEFAULT_PORTALDOT_V3_EVM_RPC } from '../types/endpoint';

const PAPER_NAV = [
  { href: '/', label: 'Landing' },
  { href: '/app', label: 'Launch App' },
  { href: '/judges', label: 'Judges' },
  { href: '/verify', label: 'Verify' },
  { href: '/status', label: 'Status' },
  { href: '/docs', label: 'Docs' },
  { href: '/mainnet', label: 'Mainnet' },
];

/**
 * Public report verification page, at /verify.
 * No account, no wallet, no upload: the file is read and hashed locally
 * in the visitor's browser, exactly like the Verify panel inside the app.
 * This page exists so a reviewer can be sent one link and check a report
 * without opening the full toolkit first.
 */
export function VerifyPage() {
  const share = typeof window !== 'undefined' ? parseShareParams(window.location.search) : {};
  return (
    <div className="paper min-h-screen bg-ink text-slate-200">
      <PaperHeader links={PAPER_NAV} current="/verify" />
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-12 md:px-8">
        <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">NodeScope / Verify</p>
        <h1 className="mt-5 font-display text-[52px] leading-[0.95] tracking-[-0.02em] text-white md:text-[80px]">
          Check a report, without an account.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Drop a NodeScope diagnostic report JSON file below. Its SHA-256 integrity stamp is
          recomputed locally in your browser and compared with the stamp it was exported with.
          Nothing is uploaded, nothing is signed, and no wallet is needed. Verification proves
          the file matches its stamp, it does not prove the node data inside it was true.
        </p>
        <div className="mt-8">
          <ReportVerifier />
        </div>
        <div className="mt-8">
          <AttestationPanel
            endpoint={DEFAULT_PORTALDOT_V3_EVM_RPC}
            initialHash={share.hash}
            initialContract={share.contract}
            initialTx={share.tx}
          />
        </div>
      </main>
    </div>
  );
}
