/**
 * NodeScope judges page, at /judges. English only, like /verify, /mainnet,
 * and /docs. One page a judge can read in a minute and verify in the next:
 * the 60-second test path, the sample report with its real hash, the
 * on-chain evidence, the test count, and the limitations stated honestly.
 * Every fact here comes from utils/siteConstants or the bundled sample
 * report itself, never from a second copy of the numbers.
 */
import sampleReport from '../../public/sample-report.json';
import { DEFAULT_PORTALDOT_V3_EVM_RPC } from '../types/endpoint';
import { REPORT_SCHEMA_VERSION } from '../utils/reportBuilder';
import {
  ANCHORED_REPORTS,
  PORTALDOT_CHAIN_ID,
  PORTALDOT_SUBSTRATE_WSS,
  REGISTRY_CONTRACT,
  SITE_TEST_FILES,
  SITE_TESTS,
  SUPPLEMENT_ANCHOR_BLOCK,
  SUPPLEMENT_ANCHOR_TX,
  SUPPLEMENT_REGISTRY,
  SUPPLEMENT_REPORT_EXPORTED_AT,
  SUPPLEMENT_REPORT_HASH,
  SUPPLEMENT_REPORT_RECORDS,
} from '../utils/siteConstants';

const SAMPLE_HASH: string = sampleReport.integrity.hash;
const SAMPLE_EXPORTED_AT: string = sampleReport.exportedAt;
const SAMPLE_RECORDS: number = sampleReport.recordCount;

export function JudgesPage() {
  return (
    <div className="paper min-h-screen bg-ink text-slate-200">
      <header className="border-b border-line px-4 py-4">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="NodeScope logo" className="h-7 w-7 rounded-lg" />
            <span className="font-display text-[17px] font-semibold tracking-tight text-white">NodeScope</span>
          </a>
          <nav className="flex items-center gap-5 font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <a href="/" className="transition-colors hover:text-white">Landing</a>
            <a href="/app" className="transition-colors hover:text-white">Launch App</a>
            <a href="/verify" className="transition-colors hover:text-white">Verify</a>
            <a href="/docs" className="transition-colors hover:text-white">Docs</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">NodeScope / For judges</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Verify it in 60 seconds.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          NodeScope is a read-only diagnostics toolkit for Portaldot V3 EVM nodes (testnet,
          chain {PORTALDOT_CHAIN_ID}). It runs in your browser, talks to the node directly,
          and never asks for a wallet. It does not poll in the background and it never shows
          simulated data as live: every number is stamped with the check that produced it,
          and every report can be re-verified by its SHA-256 hash.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">The 60-second test path</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
            <li><span className="font-data text-slate-500">01 · </span>Open <a href="/app" className="text-signal-ink hover:text-white">/app</a>. The testnet endpoint is already filled in.</li>
            <li><span className="font-data text-slate-500">02 · </span>Press <strong className="text-slate-200">Run full diagnostic</strong> at the top of Overview. It runs connect, health check, capability discovery, the Substrate WSS probe, a snapshot, and the combined verdict, in that order.</li>
            <li><span className="font-data text-slate-500">03 · </span>Read the sticky verdict bar: overall verdict, EVM checks passed, WSS status, latency, and last-checked time.</li>
            <li><span className="font-data text-slate-500">04 · </span>Try the degraded endpoint preset, run a health check on it, and compare the two snapshots in panel 04.</li>
            <li><span className="font-data text-slate-500">05 · </span>Export the report from History, then drop it at <a href="/verify" className="text-signal-ink hover:text-white">/verify</a> — or press Load sample report there for a one-click verification.</li>
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">Sample report</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            A real export, bundled in the repo as <code className="font-data text-slate-300">/sample-report.json</code>. It is
            labeled <span className="font-data text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">Sample</span> wherever
            it is shown, and it was <strong className="text-slate-200">not</strong> anchored on chain — it exists so the
            verifier can be tested without running a diagnostic first.
          </p>
          <div className="mt-4 rounded-xl border border-line bg-panel/60 p-4">
            <p className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-500">SHA-256 of the canonical report</p>
            <p className="mt-2 break-all font-data text-[13px] text-slate-200">{SAMPLE_HASH}</p>
            <p className="mt-2 text-xs text-slate-500">
              Exported {SAMPLE_EXPORTED_AT} · {SAMPLE_RECORDS} records · schema {REPORT_SCHEMA_VERSION} · every record origin {DEFAULT_PORTALDOT_V3_EVM_RPC}
            </p>
            <p className="mt-3 text-sm">
              <a href="/sample-report.json" className="text-signal-ink hover:text-white">Download the sample file</a>
              <span className="text-slate-500"> · </span>
              <a href="/verify" className="text-signal-ink hover:text-white">Verify it on /verify</a>
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">On-chain evidence</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Three reports are anchored on the current registry. Each one has its own
            /verify link, and its report file is committed in the repo so anyone can
            recompute its SHA-256.
          </p>
          <div className="mt-4 rounded-xl border border-line bg-panel/60 p-4">
            <p className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-500">Registry contract</p>
            <p className="mt-2 break-all font-data text-[13px] text-slate-200">{REGISTRY_CONTRACT}</p>
            <p className="mt-1 text-xs text-slate-500">Portaldot V3 testnet · chain {PORTALDOT_CHAIN_ID} · ownerless</p>
          </div>
          <div className="mt-4 space-y-3">
            {ANCHORED_REPORTS.map((anchor) => (
              <div key={anchor.hash} className="rounded-xl border border-line bg-panel/60 p-4">
                <p className="text-sm font-semibold text-white">{anchor.label}</p>
                <p className="mt-2 break-all font-data text-[13px] text-slate-200">{anchor.hash}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Anchor tx <span className="break-all font-data text-slate-300">{anchor.tx}</span>
                  {' '}· Anchor block {anchor.block} · Exported {anchor.exportedAt} · {anchor.records} records
                </p>
                <p className="mt-3 text-sm">
                  <a
                    href={`/verify?hash=${anchor.hash}&contract=${REGISTRY_CONTRACT}&tx=${anchor.tx}`}
                    className="text-signal-ink hover:text-white"
                  >
                    Check this anchor on /verify
                  </a>
                  <span className="text-slate-500"> · </span>
                  <a href={anchor.reportFile} className="text-signal-ink hover:text-white">Download the anchored report</a>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">Earlier anchor (25 Oct 2026, supplement)</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            The anchor above is the current evidence. This earlier anchor, on the first registry
            deployed 25 Oct 2026, is kept here for history, not as a replacement: it still
            verifies, and it proves a report with its hash existed at block{' '}
            {SUPPLEMENT_ANCHOR_BLOCK}.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-line bg-panel/60 p-4">
              <p className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-500">Earlier registry</p>
              <p className="mt-2 break-all font-data text-[13px] text-slate-200">{SUPPLEMENT_REGISTRY}</p>
              <p className="mt-1 text-xs text-slate-500">Portaldot V3 testnet · chain {PORTALDOT_CHAIN_ID} · ownerless</p>
            </div>
            <div className="rounded-xl border border-line bg-panel/60 p-4">
              <p className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-500">Earlier anchor transaction</p>
              <p className="mt-2 break-all font-data text-[13px] text-slate-200">{SUPPLEMENT_ANCHOR_TX}</p>
              <p className="mt-1 text-xs text-slate-500">Anchor block {SUPPLEMENT_ANCHOR_BLOCK} · receipt status success</p>
            </div>
            <div className="rounded-xl border border-line bg-panel/60 p-4">
              <p className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-500">Earlier anchored report hash</p>
              <p className="mt-2 break-all font-data text-[13px] text-slate-200">{SUPPLEMENT_REPORT_HASH}</p>
              <p className="mt-1 text-xs text-slate-500">Exported {SUPPLEMENT_REPORT_EXPORTED_AT} · {SUPPLEMENT_REPORT_RECORDS} records</p>
            </div>
          </div>
          <p className="mt-3 text-sm">
            <a
              href={`/verify?hash=${SUPPLEMENT_REPORT_HASH}&contract=${SUPPLEMENT_REGISTRY}&tx=${SUPPLEMENT_ANCHOR_TX}`}
              className="text-signal-ink hover:text-white"
            >
              Check this earlier anchor on /verify
            </a>
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">Tests and source</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            <strong className="text-slate-200">{SITE_TESTS} tests passing</strong> across{' '}
            <strong className="text-slate-200">{SITE_TEST_FILES} files</strong>, run with Vitest. Tests live next to
            the code they cover, not in a separate tests folder:{' '}
            <a href="https://github.com/Firzadf/nodescope/tree/main/src" target="_blank" rel="noreferrer" className="text-signal-ink hover:text-white">
              github.com/Firzadf/nodescope/tree/main/src
            </a>. The full test count is also on the landing page, and a consistency test fails the
            suite if the two ever disagree.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            DoraHacks BUIDL: <a href="https://dorahacks.io/build/50146" target="_blank" rel="noreferrer" className="text-signal-ink hover:text-white">dorahacks.io/build/50146</a> ·
            Docs: <a href="/docs" className="text-signal-ink hover:text-white">/docs</a>
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">Known limitations, stated honestly</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-400">
            <li>Testnet only. No public mainnet EVM RPC for Portaldot has been verified, so NodeScope makes no mainnet claim; the <a href="/mainnet" className="text-signal-ink hover:text-white">/mainnet</a> page is a profile of public links, not a live check.</li>
            <li>Anchoring is optional and covers the report hash only. It proves a report existed at anchor time; it does not prove the node was healthy.</li>
            <li>Three reports are anchored on the current registry (see above). The sample report above is not anchored.</li>
            <li>The 25 Oct 2026 registry&apos;s deploy transaction is not listed because it was not recorded when that contract was deployed. The anchor transaction in the supplement section is the verifiable on-chain fact for that registry.</li>
            <li>Browser CORS applies: an endpoint that does not allow cross-origin requests cannot be checked directly from the browser. The Substrate probe uses {PORTALDOT_SUBSTRATE_WSS}.</li>
            <li>No background polling. A verdict is only as fresh as its last-checked time, which is always shown next to it.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
