/**
 * NodeScope docs, at /docs. English only, like /verify and /mainnet.
 * Everything here describes what the app actually does: no feature is
 * documented before it ships, and every check meaning matches the code
 * that performs it.
 */
import { PaperHeader } from '../components/layout/PaperHeader';
import {
  BEST_STALL_AGE_SECONDS,
  FINALITY_FULL_LAG_BLOCKS,
  FINALITY_ZERO_LAG_BLOCKS,
  FINALIZED_STALL_AGE_SECONDS,
  HEALTH_SCORE_FORMULA,
  HEALTH_SCORE_FORMULA_V2,
  HEALTH_SCORE_V2_LABELS,
  HEALTH_SCORE_V2_WEIGHTS,
  HEAD_SAMPLE_STALL_SECONDS,
  LATENCY_FULL_MARKS_MS,
  LATENCY_ZERO_MS,
  MIN_COVERAGE_TO_SCORE,
} from '../utils/healthScore';
import {
  ANCHOR_BLOCK,
  ANCHOR_TX,
  ANCHORED_REPORT_HASH,
  REGISTRY_CONTRACT,
} from '../utils/siteConstants';

const V2_RULES: Record<keyof typeof HEALTH_SCORE_V2_WEIGHTS, string> = {
  availability: `${HEALTH_SCORE_V2_WEIGHTS.availability} × checks answered ÷ checks eligible, from the latest health snapshot. An answer of -32601 (method not found) is not a failure and is left out of "eligible".`,
  chain_identity: `${HEALTH_SCORE_V2_WEIGHTS.chain_identity} when eth_chainId equals 420420777, otherwise 0.`,
  head_progression: `A best-block timestamp ${BEST_STALL_AGE_SECONDS}s or older scores 0 (chain paused). Otherwise two snapshots: advanced → ${HEALTH_SCORE_V2_WEIGHTS.head_progression}; same height under ${HEAD_SAMPLE_STALL_SECONDS}s → half; stalled ≥ ${HEAD_SAMPLE_STALL_SECONDS}s or regressed → 0. One fresh timestamp, under ${BEST_STALL_AGE_SECONDS}s, scores full marks.`,
  finality: `Best head minus finalized head on the Substrate WebSocket. Full marks at lag ≤ ${FINALITY_FULL_LAG_BLOCKS} blocks, zero at lag ≥ ${FINALITY_ZERO_LAG_BLOCKS}, linear between. Unmeasured when the finalized head was not read. A failed WSS probe does not zero this component.`,
  latency: `Median latency of successful checks: ${HEALTH_SCORE_V2_WEIGHTS.latency} at ≤ ${LATENCY_FULL_MARKS_MS} ms, 0 at ≥ ${LATENCY_ZERO_MS} ms, linear in between.`,
  transport_parity: `Latest Substrate WSS probe answered → ${HEALTH_SCORE_V2_WEIGHTS.transport_parity}, failed → 0. Peer and sync credit moved to Peers & sync.`,
  peer_sync: `When the probe answered: 4 if peers > 0 (or the node expects none), 3 if not syncing, 3 if the sync gap is unknown or ≤ 8 blocks. 0 peers with shouldHavePeers scores 0 of the 4.`,
  rpc_reliability: `${HEALTH_SCORE_V2_WEIGHTS.rpc_reliability} × (1 − error ratio) × a p95 factor (full ≤ ${LATENCY_FULL_MARKS_MS} ms, zero ≥ ${LATENCY_ZERO_MS} ms). Unmeasured until the reliability probe runs. HTTP 5xx counts as an error.`,
};

const PAPER_NAV = [
  { href: '/', label: 'Landing' },
  { href: '/app', label: 'Launch App' },
  { href: '/judges', label: 'Judges' },
  { href: '/verify', label: 'Verify' },
  { href: '/status', label: 'Status' },
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
            The reliability probe and the Substrate probe also read <code className="font-data text-slate-300">rpc_methods</code> and can list unsafe operator methods. Those methods are never called. On the published Portaldot testnet hosts the names are withheld pending disclosure to the Portaldot team. Any other endpoint shows the full list.
          </p>
        </section>


        <section id="health-score" className="mt-10 scroll-mt-20">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">Health Score methodology ({HEALTH_SCORE_FORMULA_V2})</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            The Health Score is one number from 0 to 100. New exports, the diagnostic UI, Watch, the CLI,
            and the status badge use <code className="font-data text-slate-300">{HEALTH_SCORE_FORMULA_V2}</code>.
            It sits next to the verdict, never in place of it: the verdict explains, the score summarizes.
            Every component prints its points and the input it came from.
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
                {(Object.keys(HEALTH_SCORE_V2_WEIGHTS) as Array<keyof typeof HEALTH_SCORE_V2_WEIGHTS>).map((id) => (
                  <tr key={id} className="align-top">
                    <td className="py-3 pr-4 text-white">{HEALTH_SCORE_V2_LABELS[id]}</td>
                    <td className="py-3 pr-4 text-right font-data text-white">{HEALTH_SCORE_V2_WEIGHTS[id]}</td>
                    <td className="py-3 leading-relaxed text-slate-400">{V2_RULES[id]}</td>
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
            <li>The computation is pure and deterministic: the same inputs give the same score, in any order (<code className="font-data text-slate-300">shared/liveStatus.mjs</code>, covered by <code className="font-data text-slate-300">healthScore.v2.test.ts</code>).</li>
            <li>New exports carry a <code className="font-data text-slate-300">healthScore</code> block with formula <code className="font-data text-slate-300">{HEALTH_SCORE_FORMULA_V2}</code> inside the SHA-256 stamp.</li>
            <li><code className="font-data text-slate-300">{HEALTH_SCORE_FORMULA}</code> is frozen: availability 30, chain identity 15, head progression 20, latency 20, transport parity 15 (10 for an answer, +5 when not syncing and peers &gt; 0). <code className="font-data text-slate-300">computeHealthScore</code> still reproduces it, so an old report&apos;s inputs recompute to the same number. Reports exported before v2, including the three anchored evidence files, are byte-for-byte verifiable and are not rewritten.</li>
          </ul>
        </section>

        <section id="stalled" className="mt-10 scroll-mt-20">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">STALLED: chain paused but RPC answers</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            STALLED is a verdict, not a score band. It fires when a transport answered and either the best head or the finalized head has not advanced past a threshold. DOWN stays reserved for “nothing answered”.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-400">
            <li>Best head: block timestamp {BEST_STALL_AGE_SECONDS}s or older, or two samples {HEAD_SAMPLE_STALL_SECONDS}s apart at the same height.</li>
            <li>Finalized head: timestamp {FINALIZED_STALL_AGE_SECONDS}s or older, or the same two-sample rule, or a lag of {FINALITY_ZERO_LAG_BLOCKS} blocks that is itself not moving.</li>
            <li>Verdict order: not checked, then DOWN, then STALLED, then HEALTHY, then DEGRADED. A low score can pull HEALTHY to DEGRADED. It cannot pull a stall back to HEALTHY, and it cannot invent DOWN.</li>
            <li>Watch and the CLI send <strong className="text-white">stall</strong> and <strong className="text-white">resume</strong> webhooks for that transition. They replace degrade/recover for the same cycle. stalled → down is a degrade, not a resume, because the RPC stopped answering.</li>
            <li>The first observation is the baseline. A chain that is already paused when you press Start does not alert until it changes.</li>
            <li>Observed on the V3 testnet on 28 Oct 2026: best head stayed at block 232115 while <code className="font-data text-slate-300">eth_blockNumber</code> kept answering. That is the condition this rule is for.</li>
          </ul>
        </section>

        <section id="metrics" className="mt-10 scroll-mt-20">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">Prometheus and Grafana</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            <code className="font-data text-slate-300">nodescope check &lt;rpc&gt; --format prometheus</code> prints the text exposition.
            With <code className="font-data text-slate-300">--watch 60 --metrics-file ./nodescope.prom</code> the file is replaced each cycle.
            Point the node_exporter textfile collector, or Grafana Alloy, at that file. Gauges: <code className="font-data text-slate-300">nodescope_up</code>, <code className="font-data text-slate-300">nodescope_health_score</code>, <code className="font-data text-slate-300">nodescope_verdict</code>, <code className="font-data text-slate-300">nodescope_stalled</code>, <code className="font-data text-slate-300">nodescope_best_block</code>, <code className="font-data text-slate-300">nodescope_finalized_block</code>, <code className="font-data text-slate-300">nodescope_finality_lag_blocks</code>, <code className="font-data text-slate-300">nodescope_peers</code>, <code className="font-data text-slate-300">nodescope_syncing</code>, <code className="font-data text-slate-300">nodescope_best_head_age_seconds</code>, and, with <code className="font-data text-slate-300">--reliability</code>, the RPC error ratio and latency quantiles. Missing signals are omitted, not reported as zero.
          </p>
        </section>

        <section id="status" className="mt-10 scroll-mt-20">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">Status, history, and several nodes</h2>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-400">
            <li><a href="/status" className="text-signal-ink underline decoration-signal/40 underline-offset-4 hover:text-white">/status</a> checks the published testnet once when the page opens, and again only when you press Refresh. It shows the verdict, Health Score v2, best and finalized heads, finality lag, peers, and latency, plus the embeddable badge. It does not accept an arbitrary RPC.</li>
            <li>Score history, on Overview, plots the Health Score, finality lag, and best head from the health checks in this session. An orange dot is a stalled head. A ring is a degrade, recover, stall, or resume. Two checks are required. New exports include a <code className="font-data text-slate-300">scoreHistory</code> block when those checks exist. Reports that do not have the block, including the anchored evidence, still verify.</li>
            <li>Nodes, at <a href="/app/nodes" className="text-signal-ink underline decoration-signal/40 underline-offset-4 hover:text-white">/app/nodes</a>, checks the published EVM RPC, the WebSocket, and any endpoint you add, side by side. The lowest head is marked behind. Check all is manual. Watch uses the same 30 second floor as the single-node watch.</li>
          </ul>
        </section>

        <section id="badge" className="mt-10 scroll-mt-20">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">Status badge</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            <code className="font-data text-slate-300">/api/badge?target=portaldot-v3-testnet</code> (also <code className="font-data text-slate-300">/badge.svg</code>) computes the v2 score and the verdict on request, read-only, with no secrets. The host allowlist is the published testnet EVM RPC and WSS only, so the URL is not an open proxy. Responses send <code className="font-data text-slate-300">Cache-Control: public, max-age=15, s-maxage=30</code>.
          </p>
          <pre className="mt-3 overflow-x-auto border border-line bg-panel p-4 font-data text-[12px] leading-relaxed text-slate-200">{`[![NodeScope](https://nodescope.vercel.app/api/badge?target=portaldot-v3-testnet)](https://nodescope.vercel.app)`}</pre>
        </section>

        <section id="alerts" className="mt-10 scroll-mt-20">
          <h2 className="border-b border-white pb-2 font-display text-[32px] leading-tight text-white">Watch mode and webhook alerts</h2>
          <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-slate-400">
            <li>Opt-in and tab-scoped. In Overview, press <strong className="text-white">Start watch</strong>: each cycle runs the EVM health check and the Substrate probe once, every 30 s, 1 min, or 5 min (30 s is the floor). Stop, or closing the tab, ends it.</li>
            <li>Paste a Discord (<code className="font-data text-slate-300">discord.com/api/webhooks/…</code>) or Slack (<code className="font-data text-slate-300">hooks.slack.com/…</code>) incoming-webhook URL. It is stored only in this browser&apos;s localStorage and shown masked; it never goes into a report or a link.</li>
            <li>A message is sent only on a verdict transition — degrade or recover — or on stall/resume, and when you press <strong className="text-white">Send test</strong>. The first cycle is the baseline. Steady state sends nothing. See <a href="#stalled" className="text-signal-ink underline decoration-signal/40 underline-offset-4 hover:text-white">STALLED</a>.</li>
            <li>Slack webhooks do not answer browser CORS, so the browser falls back to a form post it cannot read the reply of; the app then says “delivery unconfirmed” instead of claiming success.</li>
            <li>CLI: <code className="font-data text-slate-300">nodescope check &lt;rpc&gt; --wss &lt;wss&gt; --webhook &lt;url&gt; [--watch 60] [--format prometheus]</code> applies the same transition rule, including stall and resume.</li>
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
            <li><code className="font-data text-slate-300">healthScore</code> — new exports use <code className="font-data text-slate-300">{HEALTH_SCORE_FORMULA_V2}</code> (<a href="#health-score" className="text-signal-ink underline decoration-signal/40 underline-offset-4 hover:text-white">methodology</a>). Older files may carry <code className="font-data text-slate-300">{HEALTH_SCORE_FORMULA}</code> and still verify.</li>
            <li><code className="font-data text-slate-300">operatorSignals</code> — stall assessment, reliability probe, and units, when those were run.</li>
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
