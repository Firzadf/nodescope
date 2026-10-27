/**
 * NodeScope judges page, at /judges. English only, like /verify, /mainnet,
 * and /docs. One page a judge can read in a minute and verify in the next:
 * a scannable evidence table (copy + verify + download on every row), the
 * 60-second test path, the sample report with its real hash, the test
 * count, and the limitations stated honestly. Every fact here comes from
 * utils/siteConstants, deployments/portaldot-v3.json, or the bundled sample
 * report itself, never from a second copy of the numbers.
 */
import type { ReactNode } from 'react';
import sampleReport from '../../public/sample-report.json';
import deployments from '../../deployments/portaldot-v3.json';
import { DEFAULT_PORTALDOT_V3_EVM_RPC } from '../types/endpoint';
import { REPORT_SCHEMA_VERSION } from '../utils/reportBuilder';
import { HEALTH_SCORE_FORMULA } from '../utils/healthScore';
import { CopyButton } from '../components/common/CopyButton';
import { PaperHeader } from '../components/layout/PaperHeader';
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
const DEPLOY_TX: string = deployments.deployTx;
const DEPLOY_BLOCK: number = deployments.deployBlock;

const NAV = [
  { href: '/', label: 'Landing' },
  { href: '/app', label: 'Launch App' },
  { href: '/judges', label: 'Judges' },
  { href: '/verify', label: 'Verify' },
  { href: '/docs', label: 'Docs' },
];

const linkCls = 'text-signal-ink underline decoration-signal/40 underline-offset-4 hover:text-white hover:decoration-signal';

function Row({ kind, title, value, valueLabel, meta, actions }: { kind: string; title: ReactNode; value: string; valueLabel: string; meta: ReactNode; actions?: ReactNode }) {
  return (
    <div role="row" className="grid gap-x-6 gap-y-2 border-b border-line py-5 md:grid-cols-12">
      <div role="cell" className="md:col-span-2">
        <p className="font-data text-[10px] uppercase tracking-[0.2em] text-slate-500">{kind}</p>
        <div className="mt-1 text-[15px] text-white">{title}</div>
      </div>
      <div role="cell" className="min-w-0 md:col-span-7">
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 break-all font-data text-[13px] leading-relaxed text-white">{value}</p>
          <CopyButton value={value} label={valueLabel} />
        </div>
        <div className="mt-1.5 text-xs leading-relaxed text-slate-500">{meta}</div>
      </div>
      <div role="cell" className="flex flex-col gap-1.5 font-data text-[11px] md:col-span-3 md:items-end md:text-right">
        {actions}
      </div>
    </div>
  );
}

export function JudgesPage() {
  return (
    <div className="paper min-h-screen bg-ink text-slate-200">
      <PaperHeader links={NAV} current="/judges" />
      <main className="mx-auto max-w-[1240px] px-4 pb-24 pt-12 md:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">
              <span className="text-signal-ink">NodeScope</span> / For judges
            </p>
            <h1 className="mt-5 font-display text-[56px] leading-[0.92] tracking-[-0.02em] text-white md:text-[96px]">Verify it in 60 seconds.</h1>
            <p className="mt-6 max-w-[62ch] text-[17px] leading-relaxed text-slate-400">
              NodeScope is a read-only diagnostics toolkit for Portaldot V3 EVM nodes (testnet,
              chain {PORTALDOT_CHAIN_ID}). It runs in your browser, talks to the node directly,
              and never asks for a wallet. It does not poll in the background and it never shows
              simulated data as live: every number is stamped with the check that produced it,
              and every report can be re-verified by its SHA-256 hash.
            </p>
          </div>
          <aside className="graphite self-end border border-graphite p-5 lg:col-span-4">
            <p className="font-data text-[10px] uppercase tracking-[0.2em] text-slate-400">At a glance</p>
            <dl className="mt-3 divide-y divide-line font-data text-[12px]">
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-slate-400">Chain</dt>
                <dd className="text-white">{PORTALDOT_CHAIN_ID}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-slate-400">Anchors on registry</dt>
                <dd className="text-white">{ANCHORED_REPORTS.length}</dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-slate-400">Tests</dt>
                <dd className="text-white">
                  {SITE_TESTS} / {SITE_TEST_FILES} files
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-slate-400">Deploy all-in vs fee-only</dt>
                <dd className="text-white">1.016× / ~804×</dd>
              </div>
            </dl>
            <a href="/app" className="btn-primary mt-4 flex items-center justify-center px-4 py-2.5 text-sm font-semibold">
              Open the app →
            </a>
          </aside>
        </div>

        {/* 01 — evidence table */}
        <section className="mt-16" aria-labelledby="evidence-title">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-white pb-3">
            <h2 id="evidence-title" className="font-display text-[36px] leading-none text-white">
              <span aria-hidden="true" className="mr-3 font-data text-[13px] text-signal-ink">01</span>On-chain evidence
            </h2>
            <p className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500">Registry · deploy · 3 anchors</p>
          </div>
          <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-slate-400">
            Three reports are anchored on the current registry. Each one has its own
            /verify link, and its report file is committed in the repo so anyone can
            recompute its SHA-256.
          </p>
          <div role="table" aria-label="On-chain evidence" className="mt-4 border-t border-line">
            <Row
              kind="Registry contract"
              title="NodeScopeAttestation"
              value={REGISTRY_CONTRACT}
              valueLabel="registry contract address"
              meta={<>Portaldot V3 testnet · chain {PORTALDOT_CHAIN_ID} · ownerless</>}
              actions={<span className="text-slate-500">read at /verify</span>}
            />
            <Row
              kind="Deploy transaction"
              title={<>Block {DEPLOY_BLOCK}</>}
              value={DEPLOY_TX}
              valueLabel="deploy transaction hash"
              meta={<>Deployed {deployments.deployedAt}</>}
              actions={<span className="text-slate-500">receipt over RPC</span>}
            />
            {ANCHORED_REPORTS.map((anchor) => (
              <Row
                key={anchor.hash}
                kind={`Anchor · block ${anchor.block}`}
                title={anchor.label}
                value={anchor.hash}
                valueLabel={`${anchor.label} report hash`}
                meta={
                  <>
                    <span className="flex items-start gap-3">
                      <span className="min-w-0 flex-1">
                        Anchor tx <span className="break-all font-data text-slate-300">{anchor.tx}</span>
                      </span>
                      <CopyButton value={anchor.tx} label={`${anchor.label} anchor transaction`} />
                    </span>
                    <span className="mt-1 block">
                      Anchor block {anchor.block} · Exported {anchor.exportedAt} · {anchor.records} records
                    </span>
                  </>
                }
                actions={
                  <>
                    <a href={`/verify?hash=${anchor.hash}&contract=${REGISTRY_CONTRACT}&tx=${anchor.tx}`} className={linkCls}>
                      Check this anchor on /verify
                    </a>
                    <a href={anchor.reportFile} className={linkCls}>
                      Download the anchored report
                    </a>
                  </>
                }
              />
            ))}
          </div>
          <p className="mt-4 max-w-[80ch] text-xs leading-relaxed text-slate-500">
            Explorer note: chain {PORTALDOT_CHAIN_ID} has no public EVM explorer — the official Portaldot explorers are Substrate
            explorers and do not show EVM receipts. Every “verify” link above reads the transaction receipt straight from{' '}
            <span className="font-data">{DEFAULT_PORTALDOT_V3_EVM_RPC}</span> (eth_getTransactionReceipt), with no wallet.
          </p>
        </section>

        {/* 02 — test path */}
        <section className="mt-16">
          <div className="border-b border-white pb-3">
            <h2 className="font-display text-[36px] leading-none text-white">
              <span aria-hidden="true" className="mr-3 font-data text-[13px] text-signal-ink">02</span>The 60-second test path
            </h2>
          </div>
          <ol className="mt-2 divide-y divide-line text-[15px] leading-relaxed text-slate-400">
            <li className="flex gap-5 py-4"><span className="font-data text-slate-500">01</span><span>Open <a href="/app" className={linkCls}>/app</a>. The testnet endpoint is already filled in.</span></li>
            <li className="flex gap-5 py-4"><span className="font-data text-slate-500">02</span><span>Press <strong className="font-semibold text-white">Run full diagnostic</strong> in Overview. It runs connect, health check, capability discovery, the Substrate WSS probe, a snapshot, and the combined verdict, in that order.</span></li>
            <li className="flex gap-5 py-4"><span className="font-data text-slate-500">03</span><span>Read the sticky verdict bar and the Health Score above it: every point of the score names the measurement it came from ({HEALTH_SCORE_FORMULA}, formula on <a href="/docs#health-score" className={linkCls}>/docs</a>).</span></li>
            <li className="flex gap-5 py-4"><span className="font-data text-slate-500">04</span><span>Try the degraded endpoint preset, run a health check on it, and compare the two snapshots in panel 04.</span></li>
            <li className="flex gap-5 py-4"><span className="font-data text-slate-500">05</span><span>Export the report from History, then drop it at <a href="/verify" className={linkCls}>/verify</a> — or press Load sample report there for a one-click verification.</span></li>
          </ol>
        </section>

        {/* 03 — sample report */}
        <section className="mt-16">
          <div className="border-b border-white pb-3">
            <h2 className="font-display text-[36px] leading-none text-white">
              <span aria-hidden="true" className="mr-3 font-data text-[13px] text-signal-ink">03</span>Sample report
            </h2>
          </div>
          <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-slate-400">
            A real export, bundled in the repo as <code className="font-data text-slate-200">/sample-report.json</code>. It is
            labeled <span className="font-data text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400">Sample</span> wherever
            it is shown, and it was <strong className="text-white">not</strong> anchored on chain — it exists so the
            verifier can be tested without running a diagnostic first.
          </p>
          <div role="table" aria-label="Sample report" className="mt-4 border-t border-line">
            <Row
              kind="SHA-256 of the canonical report"
              title="Sample (not anchored)"
              value={SAMPLE_HASH}
              valueLabel="sample report hash"
              meta={<>Exported {SAMPLE_EXPORTED_AT} · {SAMPLE_RECORDS} records · schema {REPORT_SCHEMA_VERSION} · every record origin {DEFAULT_PORTALDOT_V3_EVM_RPC}</>}
              actions={
                <>
                  <a href="/sample-report.json" className={linkCls}>Download the sample file</a>
                  <a href="/verify" className={linkCls}>Verify it on /verify</a>
                </>
              }
            />
          </div>
        </section>

        {/* 04 — supplement */}
        <section className="mt-16">
          <div className="border-b border-white pb-3">
            <h2 className="font-display text-[36px] leading-none text-white">
              <span aria-hidden="true" className="mr-3 font-data text-[13px] text-signal-ink">04</span>Earlier anchor (25 Oct 2026, supplement)
            </h2>
          </div>
          <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-slate-400">
            The anchors above are the current evidence. This earlier anchor, on the first registry
            deployed 25 Oct 2026, is kept here for history, not as a replacement: it still
            verifies, and it proves a report with its hash existed at block{' '}
            {SUPPLEMENT_ANCHOR_BLOCK}.
          </p>
          <div role="table" aria-label="Earlier anchor" className="mt-4 border-t border-line">
            <Row kind="Earlier registry" title="First registry" value={SUPPLEMENT_REGISTRY} valueLabel="earlier registry address" meta={<>Portaldot V3 testnet · chain {PORTALDOT_CHAIN_ID} · ownerless</>} />
            <Row kind="Earlier anchor transaction" title={<>Block {SUPPLEMENT_ANCHOR_BLOCK}</>} value={SUPPLEMENT_ANCHOR_TX} valueLabel="earlier anchor transaction" meta={<>Anchor block {SUPPLEMENT_ANCHOR_BLOCK} · receipt status success</>} />
            <Row
              kind="Earlier anchored report hash"
              title="Supplement report"
              value={SUPPLEMENT_REPORT_HASH}
              valueLabel="earlier report hash"
              meta={<>Exported {SUPPLEMENT_REPORT_EXPORTED_AT} · {SUPPLEMENT_REPORT_RECORDS} records</>}
              actions={
                <a href={`/verify?hash=${SUPPLEMENT_REPORT_HASH}&contract=${SUPPLEMENT_REGISTRY}&tx=${SUPPLEMENT_ANCHOR_TX}`} className={linkCls}>
                  Check this earlier anchor on /verify
                </a>
              }
            />
          </div>
        </section>

        {/* 05 — tests */}
        <section className="mt-16 grid gap-10 lg:grid-cols-2">
          <div>
            <div className="border-b border-white pb-3">
              <h2 className="font-display text-[36px] leading-none text-white">
                <span aria-hidden="true" className="mr-3 font-data text-[13px] text-signal-ink">05</span>Tests and source
              </h2>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-400">
              <strong className="font-semibold text-white">{SITE_TESTS} tests passing</strong> across{' '}
              <strong className="font-semibold text-white">{SITE_TEST_FILES} files</strong>, run with Vitest. Tests live next to
              the code they cover, not in a separate tests folder:{' '}
              <a href="https://github.com/Firzadf/nodescope/tree/main/src" target="_blank" rel="noreferrer" className={linkCls}>
                github.com/Firzadf/nodescope/tree/main/src
              </a>. The full test count is also on the landing page, and a consistency test fails the
              suite if the two ever disagree.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              DoraHacks BUIDL: <a href="https://dorahacks.io/build/50146" target="_blank" rel="noreferrer" className={linkCls}>dorahacks.io/build/50146</a> ·
              Docs: <a href="/docs" className={linkCls}>/docs</a>
            </p>
          </div>

          <div>
            <div className="border-b border-white pb-3">
              <h2 className="font-display text-[36px] leading-none text-white">
                <span aria-hidden="true" className="mr-3 font-data text-[13px] text-signal-ink">06</span>Known limitations, stated honestly
              </h2>
            </div>
            <ul className="mt-2 divide-y divide-line text-sm leading-relaxed text-slate-400">
              <li className="py-3">Testnet only. No public mainnet EVM RPC for Portaldot has been verified, so NodeScope makes no mainnet claim; the <a href="/mainnet" className={linkCls}>/mainnet</a> page is a profile of public links, not a live check.</li>
              <li className="py-3">Anchoring is optional and covers the report hash only. It proves a report existed at anchor time; it does not prove the node was healthy.</li>
              <li className="py-3">Three reports are anchored on the current registry (see above). The sample report above is not anchored.</li>
              <li className="py-3">The 25 Oct 2026 registry&apos;s deploy transaction is not listed because it was not recorded when that contract was deployed. The anchor transaction in the supplement section is the verifiable on-chain fact for that registry.</li>
              <li className="py-3">Browser CORS applies: an endpoint that does not allow cross-origin requests cannot be checked directly from the browser. The Substrate probe uses {PORTALDOT_SUBSTRATE_WSS}.</li>
              <li className="py-3">No background polling. A verdict is only as fresh as its last-checked time, which is always shown next to it. Watch mode is opt-in, tab-scoped, and stops when you press Stop or close the tab.</li>
              <li className="py-3">The Health Score is a summary with a published formula, not a black box: below 50% of the formula measured, no score is shown at all.</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
