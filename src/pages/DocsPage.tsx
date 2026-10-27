/**
 * NodeScope docs, at /docs. English only, like /verify and /mainnet.
 * Everything here describes what the app actually does: no feature is
 * documented before it ships, and every check meaning matches the code
 * that performs it.
 */
import { PaperHeader } from '../components/layout/PaperHeader';
import {
  HEALTH_SCORE_FORMULA,
  HEALTH_SCORE_LABELS,
  HEALTH_SCORE_WEIGHTS,
  HEAD_STALL_MIN_GAP_SECONDS,
  LATENCY_FULL_MARKS_MS,
  LATENCY_ZERO_MS,
  MIN_COVERAGE_TO_SCORE,
  type HealthScoreComponentId,
} from '../utils/healthScore';
import {
  ANCHOR_BLOCK,
  ANCHOR_TX,
  ANCHORED_REPORT_HASH,
  REGISTRY_CONTRACT,
} from '../utils/siteConstants';

const SCORE_RULES: Record<HealthScoreComponentId, string> = {
  availability: `${HEALTH_SCORE_WEIGHTS.availability} × checks answered ÷ checks eligible, from the latest health snapshot. An answer of -32601 (method not found) is not a failure and is left out of "eligible".`,
  chain_identity: `${HEALTH_SCORE_WEIGHTS.chain_identity} when eth_chainId in the latest snapshot equals 420420777, otherwise 0 (a failed eth_chainId also scores 0).`,
  head_progression: `Two newest snapshots of the same endpoint and profile that carry a block height: advanced → ${HEALTH_SCORE_WEIGHTS.head_progression}; same height less than ${HEAD_STALL_MIN_GAP_SECONDS} s apart → ${HEALTH_SCORE_WEIGHTS.head_progression / 2} (inconclusive); same height ${HEAD_STALL_MIN_GAP_SECONDS} s or more apart, or a lower height → 0.`,
  latency: `Median latency of the successful checks in the latest snapshot: ${HEALTH_SCORE_WEIGHTS.latency} at ≤ ${LATENCY_FULL_MARKS_MS} ms, 0 at ≥ ${LATENCY_ZERO_MS} ms, linear in between (rounded to 0.1).`,
  transport_parity: `Latest Substrate WSS probe: answered → 10, plus 5 when the node is not syncing and has peers > 0 (or expects none). A failed probe scores 0.`,
};

const PAPER_NAV = [
  { href: '/', label: 'Landing' },
  { href: '/app', label: 'Launch App' },
  { href: '/judges', label: 'Judges' },
  { href: '/verify', label: 'Verify' },
  { href: '/docs', label: 'Docs' },
  { href: '/mainnet', label: 'Mainnet' },
];

export function DocsPage() {
  return (
    <div className="paper min-h-screen bg-ink text-slate-200">
      <PaperHeader links={PAPER_NAV} current="/docs" />
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-12 md:px-8">
        <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">NodeScope / Docs</p>
        <h1 className="mt-5 font-display text-[52px] leading-[0.95] tracking-[-0.02em] text-white md:text-[80px]">
          Read the node. Keep the receipt.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          NodeScope is a read-only diagnostics toolkit for Portaldot V3 EVM nodes. It runs in
          your browser, talks to the node directly, and never asks for a wallet — except when
          you choose to anchor a report hash on chain with your own wallet tool. Nothing is
          polled in the background: every check is triggered by you.
        </p>

        <section className="mt-10">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">Quick start</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
            <li><span className="font-data text-slate-500">01 · </span>Open <a href="/app" className="text-signal-ink underline decoration-signal/40 underline-offset-4 hover:text-white">/app</a>. The Portaldot V3 EVM testnet endpoint is already filled in: <code className="font-data text-slate-300">https://test-evm-rpc-v3.portaldot.dev</code> (chain 420420777).</li>
            <li><span className="font-data text-slate-500">02 · </span>Press <strong className="text-slate-200">Run full diagnostic</strong> for the whole flow at once, or run the panels one by one: Connect &amp; Test, then Run Health Check.</li>
            <li><span className="font-data text-slate-500">03 · </span>Run the Substrate WSS probe (panel 06). Panel 07 then reads the EVM snapshot and the Substrate probe together as one combined verdict.</li>
            <li><span className="font-data text-slate-500">04 · </span>Compare any two snapshots in panel 04. To see a degraded endpoint, use the “Try a degraded endpoint” preset, run a health check on it, and compare it with the healthy snapshot.</li>
            <li><span className="font-data text-slate-500">05 · </span>In History, export the diagnostic report, then drop the same file at <a href="/verify" className="text-signal-ink underline decoration-signal/40 underline-offset-4 hover:text-white">/verify</a>. Or press Load sample report there to verify a real export in one click.</li>
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">What every check means</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-black/25 font-data text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  <th className="px-4 py-3 font-medium">Check</th>
                  <th className="px-4 py-3 font-medium">Transport</th>
                  <th className="px-4 py-3 font-medium">What it tells you</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-panel/60 text-slate-300">
                <tr><td className="px-4 py-3 font-data">eth_chainId</td><td className="px-4 py-3">EVM HTTP</td><td className="px-4 py-3">Network identity. Portaldot V3 testnet answers 0x190f1ca9 (420420777). Anything else is the wrong chain.</td></tr>
                <tr><td className="px-4 py-3 font-data">eth_blockNumber</td><td className="px-4 py-3">EVM HTTP</td><td className="px-4 py-3">Latest block. Rising across snapshots means the chain is moving; a stuck value across time is a finding.</td></tr>
                <tr><td className="px-4 py-3 font-data">net_version</td><td className="px-4 py-3">EVM HTTP</td><td className="px-4 py-3">Network id as a decimal. Cross-checked against the chain id.</td></tr>
                <tr><td className="px-4 py-3 font-data">web3_clientVersion</td><td className="px-4 py-3">EVM HTTP</td><td className="px-4 py-3">Node software string. A change between snapshots is a client change worth noticing.</td></tr>
                <tr><td className="px-4 py-3 font-data">net_peerCount</td><td className="px-4 py-3">EVM HTTP</td><td className="px-4 py-3">Connected peers. The live testnet RPC answers 0x1.</td></tr>
                <tr><td className="px-4 py-3 font-data">Capability discovery</td><td className="px-4 py-3">EVM HTTP</td><td className="px-4 py-3">Calls rpc_methods, then keeps only an allowlist of safe read-only methods. Write methods (eth_send, eth_sign, personal_, author_, state_) are never advertised.</td></tr>
                <tr><td className="px-4 py-3 font-data">system_health</td><td className="px-4 py-3">Substrate WSS</td><td className="px-4 py-3">Syncing state and peer count from the Substrate side of the node.</td></tr>
                <tr><td className="px-4 py-3 font-data">system_chain, system_version, chain_getHeader</td><td className="px-4 py-3">Substrate WSS</td><td className="px-4 py-3">Chain name, node version, and latest Substrate header. The header number is a Substrate counter, not an EVM block height — the two are never subtracted from each other.</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Error code <code className="font-data text-slate-300">-32601</code> means “method not found” on that
            transport. It is expected when a Substrate method is asked of the EVM endpoint (or the
            reverse) — it proves the transport answered, it does not prove the node is broken. The
            RPC console ships presets that demonstrate this on purpose.
          </p>
        </section>


        <section id="health-score" className="mt-10 scroll-mt-20">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">Health Score methodology ({HEALTH_SCORE_FORMULA})</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            The Health Score is one number from 0 to 100 that summarizes the measurements NodeScope
            already makes. It adds no probe and no polling. It sits next to the deterministic,
            rule-based verdict (Trends &amp; Verdict), never in place of it: the verdict explains, the
            score summarizes. Every component prints its points and the input it came from in the app.
          </p>
          <div className="mt-4 overflow-x-auto border-t border-line">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <th className="py-3 pr-4 font-medium">Component</th>
                  <th className="py-3 pr-4 text-right font-medium">Weight</th>
                  <th className="py-3 font-medium">Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-slate-300">
                {(Object.keys(HEALTH_SCORE_WEIGHTS) as HealthScoreComponentId[]).map((id) => (
                  <tr key={id} className="align-top">
                    <td className="py-3 pr-4 text-white">{HEALTH_SCORE_LABELS[id]}</td>
                    <td className="py-3 pr-4 text-right font-data text-white">{HEALTH_SCORE_WEIGHTS[id]}</td>
                    <td className="py-3 leading-relaxed text-slate-400">{SCORE_RULES[id]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 border border-line bg-panel px-4 py-3 font-data text-[12px] leading-relaxed text-slate-200">
            score = round(100 × Σ points ÷ Σ measured weight) · coverage = Σ measured weight · no score when coverage &lt; {MIN_COVERAGE_TO_SCORE}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-400">
            <li>Missing data is never scored: a component with no input is “not measured” and drops out of both the numerator and the denominator. Coverage is always printed next to the score.</li>
            <li>Below {MIN_COVERAGE_TO_SCORE}% coverage there is no number at all (“not scored”), because a score built from less than half the formula would overstate what was measured.</li>
            <li>Bands: 90–100 healthy · 70–89 degraded · 0–69 critical.</li>
            <li>The computation is pure and deterministic: the same snapshots and probe give the same score, in any order (<code className="font-data text-slate-300">src/utils/healthScore.ts</code>, covered by <code className="font-data text-slate-300">healthScore.test.ts</code>).</li>
            <li>New exports carry a <code className="font-data text-slate-300">healthScore</code> block (score, band, coverage, every component) inside the SHA-256 stamp. Reports exported before the score existed — including the three anchored evidence files — are unchanged and still verify.</li>
          </ul>
        </section>

        <section id="alerts" className="mt-10 scroll-mt-20">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">Watch mode and webhook alerts</h2>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-400">
            <li>Opt-in and tab-scoped. In Overview, press <strong className="text-white">Start watch</strong>: each cycle runs the EVM health check and the Substrate probe once, every 30 s, 1 min, or 5 min (30 s is the floor). Stop, or closing the tab, ends it.</li>
            <li>Paste a Discord (<code className="font-data text-slate-300">discord.com/api/webhooks/…</code>) or Slack (<code className="font-data text-slate-300">hooks.slack.com/…</code>) incoming-webhook URL. It is stored only in this browser&apos;s localStorage and shown masked; it never goes into a report or a link.</li>
            <li>A message is sent only on a verdict transition — degrade (healthy → degraded/down, degraded → down) or recover — and when you press <strong className="text-white">Send test</strong>. The first cycle is the baseline. Steady state sends nothing.</li>
            <li>Slack webhooks do not answer browser CORS, so the browser falls back to a form post it cannot read the reply of; the app then says “delivery unconfirmed” instead of claiming success.</li>
            <li>CLI: <code className="font-data text-slate-300">nodescope check &lt;rpc&gt; --webhook &lt;url&gt; [--watch 60]</code> applies the same transition rule from a terminal or a cron job.</li>
          </ul>
        </section>

        <section id="cost-gate" className="mt-10 scroll-mt-20">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">Pre-deploy cost gate (GitHub Action)</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            A composite Action at <code className="font-data text-slate-300">.github/actions/cost-gate</code> prices a contract deploy with the Fee Lab formula
            (<code className="font-data text-slate-300">eth_estimateGas</code> × <code className="font-data text-slate-300">eth_gasPrice</code>; with <code className="font-data text-slate-300">surface: cheapest</code>, also the native fee + refundable deposit) and fails the job when the cost is above <code className="font-data text-slate-300">max-tpot</code> — or when the deploy cannot be priced at all.
          </p>
          <pre className="mt-3 overflow-x-auto border border-line bg-panel p-4 font-data text-[12px] leading-relaxed text-slate-200">{`- uses: Firzadf/nodescope/.github/actions/cost-gate@main
  with:
    artifact: out/MyContract.sol/MyContract.json
    max-tpot: '150'`}</pre>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Outputs: <code className="font-data text-slate-300">cost-tpot</code>, <code className="font-data text-slate-300">over</code>, <code className="font-data text-slate-300">surface</code>, <code className="font-data text-slate-300">block</code>, plus a job-summary table. The test suite executes the Action&apos;s own run step against a mock RPC, so the gate is tested, not only documented. Read-only: nothing signs.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">Report schema: nodescope.diagnostic-report.v1</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            An export is a JSON file with these top-level fields:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-400">
            <li><code className="font-data text-slate-300">schemaVersion</code> — always <code className="font-data text-slate-300">nodescope.diagnostic-report.v1</code>.</li>
            <li><code className="font-data text-slate-300">exportedAt</code> — ISO timestamp of the export.</li>
            <li><code className="font-data text-slate-300">recordCount, records[]</code> — every diagnostic result in the session: request method, timestamp, endpoint origin, outcome, latency, metric status and result, evidence label, data origin (<code className="font-data text-slate-300">real_request</code> for live results), and error.</li>
            <li><code className="font-data text-slate-300">findings[]</code> — rule-based findings from the session.</li>
            <li><code className="font-data text-slate-300">sessionTrends</code> — verdict, pass rate, block progression, and snapshot count, when snapshots exist.</li>
            <li><code className="font-data text-slate-300">healthScore</code> — new exports only: score, band, coverage, and every component with its points (<a href="#health-score" className="text-signal-ink underline decoration-signal/40 underline-offset-4 hover:text-white">methodology</a>).</li>
            <li><code className="font-data text-slate-300">integrity</code> — <code className="font-data text-slate-300">algorithm: SHA-256</code>, the hash, and its scope.</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            The stamp is SHA-256 over the canonical JSON of the whole report excluding the
            integrity block itself (object keys sorted, array order preserved). Recomputing it
            over a file whose values changed produces a different hash, so any edit after export
            breaks verification. Verification proves the file matches its stamp — it does not
            prove the node data inside it was true.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">How to verify a report and its anchor</h2>
          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-slate-400">
            <li><span className="font-data text-slate-500">01 · </span>At <a href="/verify" className="text-signal-ink underline decoration-signal/40 underline-offset-4 hover:text-white">/verify</a>, drop a report file, paste report JSON, or press Load sample report. A VERIFIED banner means the file matches its stamp.</li>
            <li><span className="font-data text-slate-500">02 · </span>For the on-chain step, enter the report hash, the registry contract address, and the anchor transaction hash, then press Verify anchor on chain. A shareable link can pre-fill all three.</li>
            <li><span className="font-data text-slate-500">03 · </span>The panel asks the testnet RPC for the transaction receipt (<code className="font-data text-slate-300">eth_getTransactionReceipt</code>) and checks three things: the receipt succeeded, it was sent to the registry contract, and one of its logs carries the report hash as a topic. The anchor block is shown next to the result.</li>
            <li><span className="font-data text-slate-500">04 · </span>There is no public EVM explorer for this chain, so no “view on explorer” link is offered for EVM transactions. The RPC is the source of truth, and the panel reads it directly.</li>
            <li><span className="font-data text-slate-500">05 · </span>The anchors verified so far are listed on <a href="/judges" className="text-signal-ink underline decoration-signal/40 underline-offset-4 hover:text-white">/judges</a>; the latest is: registry contract <code className="font-data text-slate-300 break-all">{REGISTRY_CONTRACT}</code>, anchor transaction <code className="font-data text-slate-300 break-all">{ANCHOR_TX}</code>, anchor block {ANCHOR_BLOCK}, anchored report hash <code className="font-data text-slate-300 break-all">{ANCHORED_REPORT_HASH}</code>. The same values are on the landing page and on <a href="/judges" className="text-signal-ink underline decoration-signal/40 underline-offset-4 hover:text-white">/judges</a>, and a consistency test fails the suite if they ever disagree.</li>
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">Fee Lab: the same operation on both surfaces</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            The Fee Lab section in <a href="/app/fee-lab" className="text-signal-ink underline decoration-signal/40 underline-offset-4 hover:text-white">/app</a> measures
            one operation twice, live, from your browser: once through the EVM endpoint
            (<code className="font-data text-slate-300">eth_estimateGas</code> ×{' '}
            <code className="font-data text-slate-300">eth_gasPrice</code>) and once natively through the
            Substrate WebSocket (a <code className="font-data text-slate-300">ReviveApi</code> dry-run plus{' '}
            <code className="font-data text-slate-300">TransactionPaymentApi.query_info</code>). The EVM gas
            figure already includes the storage deposit; the native figure reports it separately as
            a refundable hold. That is why a fee-only comparison can read ~800× while the all-in
            comparison lands near 1×. The From address is only a dry-run origin: nothing signs.
            The section opens no connection until you measure, polls nothing, and closes the
            Substrate connection when you leave it.
          </p>
        </section>

        <section className="mt-10 border-t border-line pt-6">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">Honest scope</h2>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-400">
            <li>Testnet only. Portaldot V3 mainnet is live, but no public mainnet EVM RPC has been published, so NodeScope runs no mainnet EVM check and claims none. See <a href="/mainnet" className="text-signal-ink underline decoration-signal/40 underline-offset-4 hover:text-white">/mainnet</a>.</li>
            <li>Read-only by default. The app signs nothing and never asks for a private key. Anchoring happens in your own wallet tool; NodeScope only verifies the resulting transaction.</li>
            <li>Independent build. NodeScope is not built by Portaldot and does not speak for it.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
