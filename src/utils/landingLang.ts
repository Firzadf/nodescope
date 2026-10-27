/**
 * EN/ID copy for the landing page only. The app at /app, /verify, and
 * /mainnet are intentionally untouched by this module.
 *
 * Rules baked into this file:
 * - EN strings are byte-identical to the copy that shipped before the
 *   switcher existed, so existing test-guarded strings keep passing.
 * - Method names, endpoint URLs, chain IDs, hashes, block numbers, the
 *   report schema string, URLs, and the brand name NodeScope are never
 *   translated; they appear identically in both languages.
 * - The Tutorial ID copy is the pre-existing Indonesian copy, unchanged.
 *   The Tutorial EN copy is a faithful translation of that Indonesian copy.
 */
import { SITE_TESTS, SITE_TEST_FILES } from './siteConstants';

export type Lang = 'en' | 'id';

export function readStoredLang(): Lang {
  try {
    return sessionStorage.getItem('nodescope-lang') === 'id' ? 'id' : 'en';
  } catch {
    return 'en';
  }
}

export function storeLang(lang: Lang): void {
  try {
    sessionStorage.setItem('nodescope-lang', lang);
  } catch {
    // Session storage may be unavailable (private mode, tests without it);
    // the in-memory language still applies for this page view.
  }
}

export interface NavLink {
  href: string;
  label: string;
}

export interface StatItem {
  value: string;
  label: string;
  sub: string;
}

export interface StepItem {
  title: string;
  body: string;
}

export interface CapabilityRow {
  cap: string;
  tone: 'amber' | 'sky' | 'slate' | 'emerald';
  what: string;
  proof: string;
}

export interface EvidenceRow {
  block: string;
  label: string;
  delta?: string;
  when: string;
}

export interface ScreenshotItem {
  src: string;
  caption: string;
}

export interface V3Card {
  label: string;
  href: string;
  note: string;
}

export interface RoadmapItem {
  title: string;
  body: string;
}

export interface FooterColumn {
  header: string;
  links: { label: string; href: string | null }[];
}

export interface PillarCardCopy {
  kicker: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  measureLabel: string;
  measuringLabel: string;
  unavailableLabel: string;
  measuredLabel: string;
}

export interface LandingCopy {
  nav: NavLink[];
  heroPill: string;
  heroLine1: string;
  heroAccent: string;
  heroParagraph: string;
  heroParagraphEmphasis: string;
  heroParagraphTail: string;
  launchApp: string;
  watchDemo: string;
  heroFactLine: string;
  heroMeta: string[];
  heroFigureCaption: string;
  heroChipEvm: string;
  heroChipSchema: string;
  banner: string;
  stats: StatItem[];
  problemTitle: string;
  problemRight: string;
  problemStatement: string;
  problemPara1a: string;
  problemPara1Emphasis: string;
  problemPara1b: string;
  problemPara2: string;
  whyTitle: string;
  whyItems: string[];
  consoleLabel: string;
  consoleQuote: string;
  nodescopeLabel: string;
  nodescopeQuote: string;
  flowHeader: string;
  flowRight: string;
  flowConsoleLane: string;
  flowConsoleBody: string;
  flowNodescopeLane: string;
  flowReportExported: string;
  flowNodescopeBody: string;
  flowDelta: string;
  howTitle: string;
  howRight: string;
  howSteps: StepItem[];
  archTitle: string;
  archRight: string;
  archNodes: string[];
  transcriptHeader: string;
  transcriptPause: string;
  transcriptPlay: string;
  transcriptObserved: string;
  transcriptLatency: string;
  transcriptOutcome: string;
  transcriptSuccess: string;
  transcriptRunning: string;
  transcriptPass: string;
  transcriptNote: string;
  checkObservedClient: string;
  reportSampleLabel: string;
  reportSampleRight: string;
  typeReplay: string;
  backToTop: string;
  tutorialTitle: string;
  tutorialRight: string;
  tutorialIntro: string;
  tutorialSteps: { n: string; title: string; body: string }[];
  tutorialCtaTitle: string;
  tutorialCtaBody: string;
  tutorialCtaPrimary: string;
  tutorialCtaSecondary: string;
  instrumentTitle: string;
  instrumentRight: string;
  diffHeader: string;
  diffRight: string;
  diffUnchanged: string;
  diffFindings: string;
  diffFooter: string;
  capabilityHeaders: [string, string, string];
  capabilities: CapabilityRow[];
  evidenceTitle: string;
  evidenceRight: string;
  evidenceGridCaption: string;
  evidenceGridAria: string;
  evidenceHeaders: [string, string, string];
  evidenceRows: EvidenceRow[];
  evidenceFootnote: string;
  onchainTitle: string;
  onchainRight: string;
  onchainIntro: string;
  onchainCheckTitle: string;
  onchainCheckSteps: string[];
  onchainVerifyNote: string;
  whoTitle: string;
  whoRight: string;
  whoItems: { title: string; body: string }[];
  galleryLabel: string;
  screenshots: ScreenshotItem[];
  v3Title: string;
  v3Right: string;
  v3Intro: string;
  v3Cards: V3Card[];
  v3Footnote: string;
  roadmapTitle: string;
  roadmapRight: string;
  roadmapShipped: string;
  roadmapItems: RoadmapItem[];
  roadmapFootnote: string;
  roadmapNextLabel: string;
  roadmapNextItems: RoadmapItem[];
  roadmapNewLabel: string;
  roadmapNewItems: RoadmapItem[];
  scoreTitle: string;
  scoreRight: string;
  scoreIntro: string;
  scoreHeaders: [string, string, string];
  scoreRows: { label: string; weight: number; rule: string }[];
  scoreFormula: string;
  scoreFootnote: string;
  scoreCta: string;
  marqueeLive: string;
  marqueeItems: string[];
  sectionLabels: Record<string, string>;
  judgeTitle: string;
  judgeRight: string;
  judgeIntro: string;
  judgeSteps: StepItem[];
  judgeFootnote: string;
  heroPillarLine: string;
  pillarSectionTitle: string;
  pillarSectionIntro: string;
  pillarHealth: PillarCardCopy;
  pillarFees: PillarCardCopy;
  feeBlockTitle: string;
  feeBlockBody: string;
  feeBlockEvm: string;
  feeBlockNative: string;
  feeBlockFootnote: string;
  feeBlockCta: string;
  ctaTitleA: string;
  ctaTitleB: string;
  ctaBody: string;
  footerLive: string;
  footerDescription: string;
  footerDisclaimer: string;
  footerColumns: FooterColumn[];
  footerCopyright: string;
  footerSchema: string;
  packetYou: string;
  packetReceipt: string;
  packetNote: string;
  liveReadoutHeader: string;
  liveReadoutLatest: string;
  liveReadoutProbing: string;
  liveReadoutMatch: string;
  liveReadoutMismatch: string;
  liveReadoutAnsweredIn: string;
  liveReadoutAt: string;
  liveReadoutFetchedOnce: string;
  liveReadoutUnreachable: string;
  liveReadoutUnreachableBody: string;
  liveReadoutLastObserved: string;
  lightboxClose: string;
  motionCaption: string;
  motionNote: string;
  langGroupAria: string;
  menuToggleAria: string;
}

const en: LandingCopy = {
  nav: [
    { href: '#problem', label: 'The Problem' },
    { href: '#how', label: 'How It Works' },
    { href: '#instrument', label: 'The Instrument' },
    { href: '#evidence', label: 'Evidence' },
    { href: '/fees', label: 'Fees' },
    { href: '#roadmap', label: 'Roadmap' },
    { href: '/mainnet', label: 'Mainnet' },
    { href: '/verify', label: 'Verify' },
  ],
  heroPill: 'HUD · Portaldot V3 EVM · Read-only by default',
  heroLine1: 'Consoles interact.',
  heroAccent: 'proves.',
  heroParagraph:
    "A read-only diagnostics toolkit for Portaldot nodes. It records health checks as snapshots, diffs them deterministically, and exports the report — so a node's health is something you can ",
  heroParagraphEmphasis: 'show',
  heroParagraphTail: ', not something you assert.',
  launchApp: 'Launch App',
  watchDemo: 'Watch the demo',
  heroFactLine:
    'Portaldot V3 EVM · Chain 420420777 · Testnet · Read-only by default · Optional on-chain anchor · Nothing polls',
  heroMeta: ['Chain 420420777', 'Testnet', 'No account', 'No wallet required', 'Nothing polls'],
  heroFigureCaption: 'The app — snapshot comparison, cropped from a real session',
  heroChipEvm: 'Portaldot V3 EVM',
  heroChipSchema: 'Report schema v1',
  banner: 'Portaldot Hacker House 2026 · Check-in 22 Oct 2026 · Final / code freeze 6 Nov 2026, 11:00 WIB',
  stats: [
    { value: '420420777', label: 'Chain ID', sub: 'Portaldot V3 EVM · hex 0x190F1CA9 · returned by eth_chainId' },
    { value: SITE_TESTS, label: 'Tests passing', sub: `${SITE_TEST_FILES} files · Vitest · suite verified 26 Oct 2026` },
    {
      value: '38',
      label: 'RPC methods probed',
      sub: '7 supported on this EVM profile · the rest answered method-not-found — reported, not hidden',
    },
    {
      value: '+12',
      label: 'Blocks between demo snapshots',
      sub: 'A 143,764 at 15:48:05 → B 143,776 at 15:49:21 WIB · 76 seconds apart',
    },
  ],
  problemTitle: 'The Problem',
  problemRight: 'Why NodeScope exists',
  problemStatement: 'A green checkmark is not evidence.',
  problemPara1a: 'Consoles and explorers tell you a node answered ',
  problemPara1Emphasis: 'once',
  problemPara1b:
    ". They don't show drift, silent regressions, or whether the same check still passes an hour later — and they leave you nothing you can hand to anyone as proof.",
  problemPara2:
    'NodeScope treats every check as an observation worth keeping: timestamped, structured, and comparable. When something changes, the diff says exactly what — method by method.',
  whyTitle: "Why a console isn't enough",
  whyItems: [
    'Consoles show one response right now. NodeScope records timestamped snapshots, so a claim about health is anchored to a moment, not a mood.',
    'Snapshots are diffed deterministically, method by method — drift and silent regressions become visible instead of deniable.',
    'EVM and Substrate are checked together, so one verdict covers both transports a Portaldot node speaks.',
    'Every session exports as a hashed report anyone can verify — the proof survives the browser tab it was made in.',
  ],
  consoleLabel: 'CONSOLE —',
  consoleQuote: '“Reachable right now.”',
  nodescopeLabel: 'NODESCOPE —',
  nodescopeQuote:
    "“Healthy at 15:48 and 15:49 — 76 seconds apart — +12 blocks, zero regressions. Here's the report.”",
  flowHeader: 'ONE QUESTION — eth_blockNumber — TWO ANSWERS',
  flowRight: 'Demo data · 22 Oct 2026',
  flowConsoleLane: 'Console — asks once',
  flowConsoleBody: ' — answered, then gone. Nothing is kept, nothing can be shown later.',
  flowNodescopeLane: 'NodeScope — proves over time',
  flowReportExported: 'report exported',
  flowNodescopeBody: 'The same answers, kept as snapshots — so the change between them is a fact, not a memory.',
  flowDelta: 'Δ +12 · 76 s',
  howTitle: 'How It Works',
  howRight: 'Three steps, no setup',
  howSteps: [
    {
      title: 'Connect & check',
      body: 'Point NodeScope at any Portaldot V3 EVM endpoint. A health check runs the core JSON-RPC methods and records the result as a structured snapshot.',
    },
    {
      title: 'Snapshot',
      body: 'Snapshots are timestamped observations — block height, chain ID, client version, latency, per-method outcomes — stored for the session, up to 20.',
    },
    {
      title: 'Compare & export',
      body: 'Pick any two snapshots — or read the whole session. NodeScope diffs snapshots deterministically, trends latency and block progression across all of them, and ends in a verdict whose rules are printed, not hidden. Everything folds into an exportable diagnostic report (schema v1) you can share — stamped with a SHA-256 integrity hash, so anyone can verify the file was not altered after export.',
    },
  ],
  archTitle: 'How the pieces fit',
  archRight: 'Browser only · No server in between',
  archNodes: [
    'EVM JSON-RPC — eth_chainId, eth_blockNumber, net_version, web3_clientVersion',
    'Substrate WebSocket — system_health, system_chain, chain_getHeader',
    'Snapshot engine — timestamped observations, up to 20 per session',
    'Deterministic diff & verdict — rules printed, never hidden',
    'Canonical JSON + SHA-256 report — verifiable at /verify',
    'Optional on-chain anchor — report hash only, on Portaldot V3',
  ],
  transcriptHeader: '>_ HEALTH CHECK — RECORDED RUN',
  transcriptPause: 'Pause transcript',
  transcriptPlay: 'Play transcript',
  transcriptObserved: 'Observed value',
  transcriptLatency: 'LATENCY',
  transcriptOutcome: 'OUTCOME',
  transcriptSuccess: 'SUCCESS',
  transcriptRunning: 'RUNNING',
  transcriptPass: 'PASS',
  transcriptNote:
    'One step of a real check recorded 22 Oct 2026. Four methods, four receipts — saved as snapshot ',
  checkObservedClient: 'client string, recorded in snapshot',
  reportSampleLabel: 'nodescope — diagnostic-report.v1',
  reportSampleRight: 'Trimmed sample of a real export',
  typeReplay: 'Replay typing',
  backToTop: 'Back to top',
  tutorialTitle: 'Tutorial',
  tutorialRight: 'Five steps, no setup',
  tutorialIntro:
    'Opening NodeScope for the first time? Follow these five steps, all using buttons that already exist in the app, with no account, no wallet, and no configuration. The For judges section below is the same verification flow, written for judges.',
  tutorialSteps: [
    {
      n: '01',
      title: 'Open the app, endpoint already filled in',
      body: 'Open /app. The Portaldot V3 EVM endpoint is already filled in, nothing needs configuring and nothing needs signing.',
    },
    {
      n: '02',
      title: 'Connect & Test',
      body: 'Press Connect & Test. The app tests the connection to the endpoint and shows the status as it is, including when the endpoint does not answer.',
    },
    {
      n: '03',
      title: 'Run Health Check',
      body: 'Press Run Health Check. Four core methods run and the result is saved as a timestamped snapshot in this session, up to 20 snapshots.',
    },
    {
      n: '04',
      title: 'Compare and read the verdict',
      body: 'Pick two snapshots to compare, or read Trends & Verdict for the whole session. The verdict is deterministic and its rules are printed together with the evidence, with no score.',
    },
    {
      n: '05',
      title: 'Export, verify, optional anchor',
      body: 'Export the JSON report from History, then drop that same file on /verify to check its SHA-256 stamp. If you want, anchor the report hash on-chain from panel 04, then verify the transaction in the same place.',
    },
  ],
  tutorialCtaTitle: 'Ready to try?',
  tutorialCtaBody: 'One click to the app, and the five steps above can be practiced right away.',
  tutorialCtaPrimary: 'Start in the app',
  tutorialCtaSecondary: 'To the Verify page',
  instrumentTitle: 'The Instrument',
  instrumentRight: 'Real output, not mockups',
  diffHeader: '>_ SNAPSHOT COMPARISON — REAL OUTPUT',
  diffRight: 'Demo · 22 Oct 2026',
  diffUnchanged: 'UNCHANGED',
  diffFindings: '0 new · 0 resolved · 0 regressions',
  diffFooter: 'Deterministic — same two snapshots, same diff, every time',
  capabilityHeaders: ['Capability', 'What it does', 'Proof'],
  capabilities: [
    {
      cap: 'Trends & verdict',
      tone: 'amber',
      what: 'Across a session of snapshots: per-method latency trends, block progression with stall and regression findings, and a deterministic verdict whose rules are printed with their evidence.',
      proof: 'Needs ≥2 health checks · rules shown, no score',
    },
    {
      cap: 'Capability discovery',
      tone: 'sky',
      what: 'Probes 38 JSON-RPC methods; an unsupported answer is reported as data, never dressed up as success.',
      proof: '7 supported on Portaldot V3 EVM',
    },
    {
      cap: 'RPC console',
      tone: 'slate',
      what: 'Run any method by hand — presets, custom params, and evidence badges drawn from your own run history.',
      proof: 'User-triggered only · nothing polls',
    },
    {
      cap: 'Diagnostic reports',
      tone: 'sky',
      what: 'Every run folds into one shareable JSON report with categorized findings and recommendations.',
      proof: 'Schema nodescope.diagnostic-report.v1',
    },
    {
      cap: 'Combined verdict',
      tone: 'emerald',
      what: 'The latest EVM health snapshot and the Substrate WebSocket probe, read together in one panel — with each number shown with its own timestamp, and the two counters never subtracted from each other.',
      proof: 'Panel 07 in Overview · both transports, no score',
    },
    {
      cap: 'Report verification',
      tone: 'emerald',
      what: 'Exports are stamped with SHA-256 over a canonical form of the report. Anyone can drop the file back into NodeScope and check the stamp — changing any value in the file breaks it.',
      proof: 'Verify in History, or at /verify · no server, no account, no wallet',
    },
    {
      cap: 'Command palette',
      tone: 'slate',
      what: '⌘K drives navigation, connection, health checks, diagnostics, and copying evidence — keyboard first.',
      proof: 'Press ⌘K inside the app',
    },
  ],
  evidenceTitle: 'Live Evidence',
  evidenceRight: 'Observed on the real testnet',
  evidenceGridCaption:
    "BLOCKS 147,592 → 147,639 · ONE CELL PER BLOCK · SHADE = POSITION IN RANGE · THE RANGE WAS OBSERVED END-TO-END IN ONE SESSION — THE CHAIN DIDN'T PAUSE FOR US",
  evidenceGridAria: '48 consecutive blocks observed during one session, from 147,592 to 147,639',
  evidenceHeaders: ['Block height', 'Observation', 'When'],
  evidenceRows: [
    { block: '133,242', label: 'First recorded observation', when: 'Oct 2026' },
    { block: '143,764', label: 'Demo Snapshot A', when: '22 Oct 2026 · 15:48 WIB' },
    { block: '143,776', label: 'Demo Snapshot B', delta: '+12', when: '22 Oct 2026 · 15:49 WIB' },
    { block: '147,639', label: 'QA session', delta: '+1 in 7s', when: '22 Oct 2026 · 22:16 WIB' },
  ],
  evidenceFootnote:
    'Endpoint: test-evm-rpc-v3.portaldot.dev · Chain ID 420420777 · Evidence is observed, never manufactured — the optional on-chain anchor stores only a report hash, never the report itself.',
  onchainTitle: 'On-chain evidence',
  onchainRight: 'One anchored report · Verifiable now',
  onchainIntro:
    'Anchoring is optional and stores only a report hash, never the report itself. One real report has been anchored on the Portaldot V3 testnet — the registry contract, the anchor transaction, and the block are below, and the same check runs live on /verify.',
  onchainCheckTitle: 'How to check it yourself',
  onchainCheckSteps: [
    'Open the verification link below. The report hash, contract address, and anchor transaction are pre-filled.',
    'Press Verify anchor on chain. The panel asks the testnet RPC for the transaction receipt (eth_getTransactionReceipt) — no wallet, no signing.',
    'An anchored result means the receipt succeeded, was sent to the registry contract, and carries a log whose topic matches the report hash, at the block shown.',
  ],
  onchainVerifyNote:
    'There is no public EVM explorer for this chain: the two official Portaldot explorers are Substrate explorers and do not show EVM receipts. Verification here is done through the RPC itself, which is the same source the panel reads.',
  whoTitle: 'Who uses NodeScope',
  whoRight: 'Built for operators, useful to everyone checking a node',
  whoItems: [
    {
      title: 'Portaldot node operators & validators',
      body: 'Prove an endpoint stayed healthy across a session, with snapshots to show for it — not just a green light at one moment.',
    },
    {
      title: 'RPC providers proving an SLA',
      body: 'Export timestamped sessions as evidence for uptime and latency claims, in a file the other side can verify.',
    },
    {
      title: 'Ecosystem & foundation teams',
      body: 'Audit public endpoints before the mainnet EVM RPC launch, with a deterministic record of what was actually observed.',
    },
    {
      title: 'dApp builders choosing an RPC',
      body: 'Compare endpoints on real observations — block progression, latency, method support — before hardcoding one.',
    },
    {
      title: 'Incident responders',
      body: 'Capture a shareable record of what the node did, when — a report that outlives the incident channel.',
    },
  ],
  galleryLabel: 'NodeScope · screenshot',
  screenshots: [
    { src: '/screenshots/01-endpoint-config.jpg', caption: '01 — Endpoint configuration' },
    { src: '/screenshots/02-health-check-results.jpg', caption: '02 — Health check results' },
    { src: '/screenshots/03-snapshot-comparison.jpg', caption: '03 — Snapshot comparison' },
    { src: '/screenshots/04-findings-categorized.jpg', caption: '04 — Findings, categorized' },
    { src: '/screenshots/05-report-export.jpg', caption: '05 — Report export' },
  ],
  v3Title: 'Portaldot V3, as published',
  v3Right: 'Official references, not guesses',
  v3Intro:
    'Portaldot V3.0 rolled out 23 Oct 2026, 23:00 UTC (24 Oct 2026, 06:00 WIB), per the official @PortaldotL0 and @Portaldot_Dev posts. NodeScope tags every health snapshot Pre-V3 or Post-V3 against that instant, so evidence from before and after the upgrade is never silently mixed. The testnet EVM RPC below is the endpoint NodeScope checks; the WebSocket node is probed separately in the app with Substrate methods.',
  v3Cards: [
    { label: 'Mainnet · Node Console', href: 'https://node-console.portaldot.dev/', note: 'Official mainnet access point' },
    { label: 'Mainnet · Block Explorer', href: 'https://scanner-live-v3.portaldot.dev/', note: 'Substrate explorer, not an EVM explorer' },
    { label: 'Mainnet · Cross-Chain Bridge', href: 'https://bridge.portaldot.dev/', note: 'Official bridge' },
    { label: 'Testnet · EVM RPC', href: 'https://test-evm-rpc-v3.portaldot.dev', note: 'Checked by NodeScope · chain 420420777' },
    {
      label: 'Testnet · WebSocket Node',
      href: 'https://x.com/Portaldot_Dev/status/2113571130527318088',
      note: 'Probed by NodeScope as wss://test-node-v3.portaldot.dev · endpoint list by @Portaldot_Dev',
    },
    { label: 'Testnet · Block Explorer', href: 'https://scanner-testnet-v3.portaldot.dev/', note: 'Substrate testnet explorer' },
  ],
  v3Footnote:
    'No public mainnet EVM RPC is published in those references, so NodeScope does not claim a mainnet EVM check. That absence is stated here on purpose.',
  roadmapTitle: 'Roadmap',
  roadmapRight: 'Honestly labeled',
  roadmapShipped: 'Shipped — live in the app',
  roadmapItems: [
    {
      title: 'Trends & Verdict',
      body: 'Per-method latency trends and block progression across a whole session of snapshots, ending in a deterministic verdict — HEALTHY, DEGRADED, or UNSTABLE — with every rule that fired printed next to it. No score, no black box.',
    },
    {
      title: 'Multi-Endpoint Comparison',
      body: 'Health snapshots from different endpoints, compared side by side — with comparability discipline: matching chain IDs earn a caveated block delta, different chains are declared not comparable instead of subtracted, and method-support and client differences surface as findings. (Not a watchlist — nothing is monitored in the background; you bring the snapshots.)',
    },
    {
      title: 'Portaldot Mainnet Profile',
      body: 'Mainnet V3 is live since 24 Oct 2026, 06:00 WIB, but no public mainnet EVM RPC is published yet, so NodeScope does not fake a mainnet check. The Mainnet Profile page at /mainnet links the official console, explorer, and bridge and states that absence plainly, and the same snapshot and evidence engine is ready the day a mainnet RPC is published.',
    },
  ],
  roadmapFootnote:
    "NodeScope's whole point is evidence — so planned work is labeled planned. Nothing on this page claims to exist before it does.",
  roadmapNewLabel: 'New in this build — live in the app',
  roadmapNewItems: [
    {
      title: 'Health Score 0–100, formula published',
      body: 'Five weighted components — RPC availability 30, chain identity 15, head progression 20, latency 20, transport parity 15 — each shown with its points and the input it came from. Missing data is never scored; coverage is printed next to the number, and below 50% coverage there is no number at all. New exports carry the score inside the SHA-256 stamp.',
    },
    {
      title: 'Watch mode + Discord / Slack alerts',
      body: 'Opt-in and tab-scoped: press Start watch and each cycle runs the health check and the Substrate probe once (30 s floor). A message goes to your webhook only on a degrade or recover transition, or when you press Send test. The webhook URL stays in your browser. The CLI has the same rule behind --webhook and --watch.',
    },
    {
      title: 'Pre-deploy cost gate (GitHub Action)',
      body: 'A composite Action that prices a contract deploy with the Fee Lab formula and fails the job above max-tpot — or when the deploy cannot be priced at all. Its own run: block is executed by the test suite, so the Action is tested, not just documented.',
    },
  ],
  scoreTitle: 'Health Score',
  scoreRight: 'One number · formula published · nodescope.health-score.v1',
  scoreIntro:
    'The verdict explains; the score summarizes. Every point comes from a measurement NodeScope already makes, and every component prints the input it was computed from. A component with no data counts on neither side of the fraction.',
  scoreHeaders: ['Component', 'Weight', 'Rule'],
  scoreRows: [
    { label: 'RPC availability', weight: 30, rule: '30 × checks answered ÷ checks eligible (latest snapshot). -32601 “method not found” is not a failure and is not eligible.' },
    { label: 'Chain identity', weight: 15, rule: '15 when eth_chainId = 420420777, otherwise 0.' },
    { label: 'Head progression', weight: 20, rule: 'Two newest snapshots, same endpoint: advanced 20 · same height under 30 s apart 10 · stalled ≥ 30 s or regressed 0.' },
    { label: 'Latency', weight: 20, rule: 'Median of successful checks: 20 at ≤ 300 ms, 0 at ≥ 2000 ms, linear in between.' },
    { label: 'Transport parity (WSS)', weight: 15, rule: 'Substrate probe answered 10, +5 when not syncing and peers > 0.' },
  ],
  scoreFormula: 'score = round(100 × Σ points ÷ Σ measured weight) · shown only when measured weight ≥ 50',
  scoreFootnote: 'Bands: 90–100 healthy · 70–89 degraded · 0–69 critical. The score is new and lives next to the deterministic verdict, not in place of it.',
  scoreCta: 'Read the full methodology',
  marqueeLive: 'Live block',
  marqueeItems: [
    'Chain 420420777',
    'Registry 0xd48d…c99c',
    '3 anchors · blocks 216341 · 216343 · 216346',
    'Deploy all-in 1.016× · fee-only ~804×',
    'Native transfer 0.880×',
    'SHA-256 stamped reports',
    'Read-only · nothing signs',
  ],
  sectionLabels: {
    pillars: 'Two pillars',
    score: 'Health Score',
    problem: 'The problem',
    how: 'How it works',
    tutorial: 'First run',
    instrument: 'The instrument',
    evidence: 'Evidence',
    onchain: 'Proof on chain',
    who: 'Who it is for',
    v3: 'References',
    roadmap: 'Roadmap',
    judge: 'For judges',
  },
  roadmapNextLabel: 'Planned — not shipped yet',
  roadmapNextItems: [
    {
      title: 'Scheduled watch mode',
      body: 'Hosted, scheduled re-checks that keep running after you close the tab. Today’s Watch mode is tab-scoped: it runs only while the app is open and only after you press Start.',
    },
    {
      title: 'Telegram alerts + alert history',
      body: 'Discord and Slack alerts ship today. Next: Telegram, and alerts that carry the full snapshot diff plus a kept history of every transition.',
    },
    {
      title: 'Monthly SLA reports for RPC providers',
      body: 'Roll session exports into a monthly evidence pack: uptime, latency distribution, and method support over the month.',
    },
    {
      title: 'Public endpoint leaderboard for the ecosystem',
      body: 'Rank public endpoints on observed evidence only — every score traceable to snapshots anyone can re-check.',
    },
  ],
  judgeTitle: 'For judges: 60 seconds to verify',
  judgeRight: 'No account · No wallet · No setup',
  judgeIntro:
    'Do not take any number on this page on trust. Every claim below is a button you can press yourself, in the live app, against the live testnet.',
  judgeSteps: [
    {
      title: 'Launch the app',
      body: 'Open /app. The Portaldot V3 EVM endpoint is already filled in. Nothing to configure, nothing to sign.',
    },
    {
      title: 'Connect and check',
      body: 'Press Connect & Test, then Run Health Check. Four methods run and the result is saved as a timestamped snapshot.',
    },
    {
      title: 'Probe the second transport',
      body: 'In Overview, panel 06, press Probe WSS Node. Panel 07 then reads the EVM snapshot and the Substrate probe together, with each number carrying its own timestamp.',
    },
    {
      title: 'Export and verify',
      body: 'In History, export the diagnostic report, then drop the same file at /verify. The SHA-256 stamp covers everything except the stamp itself, so changing any value in the file breaks it.',
    },
    {
      title: 'Anchor, optionally',
      body: 'The registry contract is deployed on the Portaldot V3 testnet. Anchor the report hash on chain with your own wallet tool, then verify the transaction in History, panel 04, or open the shareable verification link from the same panel.',
    },
  ],
  judgeFootnote:
    'If any step fails, that failure is itself the result: NodeScope reports a node that did not answer, it does not dress it up as success.',
  heroPillarLine: 'Two questions, one suite: is the node honest about its condition, and are its fees honest?',
  pillarSectionTitle: 'One suite, two pillars',
  pillarSectionIntro: 'Health asks whether the node tells the truth about its condition. Fees asks whether its prices tell the truth. Each card below measures one live number, once, when you open this section or press Measure. Nothing polls, and a failed measurement shows as unavailable, never as a made-up number.',
  pillarHealth: {
    kicker: 'Pillar 01 · Health',
    title: 'NodeScope Health',
    body: 'Live diagnostics across the EVM and Substrate surfaces, with a verdict you can verify on-chain. Press Measure for the latest block the EVM RPC reports right now.',
    ctaLabel: 'Open the app',
    ctaHref: '/app',
    measureLabel: 'Measure live block',
    measuringLabel: 'Reading the chain…',
    unavailableLabel: 'Block unavailable right now',
    measuredLabel: 'Measured at',
  },
  pillarFees: {
    kicker: 'Pillar 02 · Fees',
    title: 'NodeScope Fees',
    body: 'The same operation priced on EVM and native, fee-only versus all-in, with the storage deposit shown separately. Press Measure for a fresh deploy estimate on both surfaces.',
    ctaLabel: 'Open the Fees page',
    ctaHref: '/fees',
    measureLabel: 'Measure live deploy',
    measuringLabel: 'Estimating on both surfaces…',
    unavailableLabel: 'Estimate unavailable right now',
    measuredLabel: 'Measured at',
  },
  feeBlockTitle: 'The number that started the Fees pillar',
  feeBlockBody: 'One measured deploy of the sample token: EVM 124.098219 tPOT against native 122.191411 tPOT all-in. Compared fee-only, the gap reads 804x; compared all-in, it is 1.016x. The difference is the storage deposit, refundable when storage is freed.',
  feeBlockEvm: 'EVM total: 124.098219 tPOT',
  feeBlockNative: 'Native all-in: 122.191411 tPOT (fee 0.154411 + deposit 122.037)',
  feeBlockFootnote: 'Measured 26 Oct 2026, the same run as the /fees findings table. Re-measure it live in Fee Lab.',
  feeBlockCta: 'See how fees are measured',
  ctaTitleA: 'Put your node ',
  ctaTitleB: 'under the scope.',
  ctaBody: 'Open the live toolkit, run a health check against the Portaldot V3 testnet, and keep the receipt.',
  footerLive: 'Live · Chain 420420777 · Portaldot V3 EVM Testnet',
  footerDescription:
    'The Portaldot diagnostics toolkit. Consoles interact — NodeScope proves, with a receipt you can hand to anyone.',
  footerDisclaimer: 'Independent Hacker House build · Not an official Portaldot product · Testnet only',
  footerColumns: [
    {
      header: 'Product',
      links: [
        { label: 'Launch App', href: '/app' },
        { label: 'How It Works', href: '#how' },
        { label: 'The Instrument', href: '#instrument' },
        { label: 'Live Evidence', href: '#evidence' },
        { label: 'Verify a Report', href: '/verify' },
        { label: 'Mainnet Profile', href: '/mainnet' },
        { label: 'Fees', href: '/fees' },
        { label: 'Docs', href: '/docs' },
        { label: 'For Judges', href: '/judges' },
      ],
    },
    {
      header: 'Resources',
      links: [
        { label: 'DoraHacks BUIDL', href: 'https://dorahacks.io/build/50146' },
        { label: 'GitHub Repository', href: 'https://github.com/Firzadf/nodescope' },
        { label: 'Node Console', href: 'https://node-console.portaldot.dev/' },
        { label: 'Block Explorer', href: 'https://scanner-live-v3.portaldot.dev/' },
        { label: 'Cross-Chain Bridge', href: 'https://bridge.portaldot.dev/' },
      ],
    },
    {
      header: 'Community',
      links: [
        { label: 'Portaldot on X', href: 'https://x.com/PortaldotL0' },
        { label: 'Portaldot Dev on X', href: 'https://x.com/Portaldot_Dev' },
        { label: 'X — @dutzozan', href: 'https://x.com/dutzozan' },
        { label: 'Telegram — @inidutaa', href: 'https://t.me/inidutaa' },
        { label: 'Discord · dutzozan', href: null },
        { label: 'Demo video', href: 'https://youtu.be/TyTudF3MUaI' },
        { label: 'Built solo by Firza Duta Fauzan', href: 'https://github.com/Firzadf/nodescope' },
      ],
    },
  ],
  footerCopyright: '© 2026 NodeScope',
  footerSchema: 'Report schema · nodescope.diagnostic-report.v1',
  packetYou: 'You',
  packetReceipt: 'Receipt',
  packetNote: 'Decorative flow · carries no live data',
  liveReadoutHeader: '>_ LIVE READOUT · PORTALDOT V3 EVM',
  liveReadoutLatest: 'Latest block — observed by this page',
  liveReadoutProbing: 'PROBING THE ENDPOINT…',
  liveReadoutMatch: '— MATCHES THE DOCUMENTED CHAIN',
  liveReadoutMismatch: '— DID NOT MATCH 420420777',
  liveReadoutAnsweredIn: 'ANSWERED IN',
  liveReadoutAt: 'AT',
  liveReadoutFetchedOnce: 'Fetched once, when this page loaded. Not a poll — reload to re-observe.',
  liveReadoutUnreachable: 'THE ENDPOINT DID NOT ANSWER WHILE THIS PAGE LOADED.',
  liveReadoutUnreachableBody: "NodeScope reports that too — it's the whole point. Last documented observation: ",
  liveReadoutLastObserved: 'block 147,639 · 22 Oct 2026',
  lightboxClose: 'Close',
  motionCaption: 'Watch the flow — five real screens, animated',
  motionNote: 'Screenshots from a real session on 25 Oct 2026, animated with a slow zoom and crossfade. This is not a live recording and it carries no live data — the stills below are the same screens.',
  langGroupAria: 'Language',
  menuToggleAria: 'Toggle navigation menu',
};

const id: LandingCopy = {
  nav: [
    { href: '#problem', label: 'Masalah' },
    { href: '#how', label: 'Cara Kerja' },
    { href: '#instrument', label: 'Instrumen' },
    { href: '#evidence', label: 'Bukti' },
    { href: '/fees', label: 'Fees' },
    { href: '#roadmap', label: 'Roadmap' },
    { href: '/mainnet', label: 'Mainnet' },
    { href: '/verify', label: 'Verifikasi' },
  ],
  heroPill: 'HUD · Portaldot V3 EVM · Read-only secara bawaan',
  heroLine1: 'Konsol berinteraksi.',
  heroAccent: 'membuktikan.',
  heroParagraph:
    'Perangkat diagnostik read-only untuk node Portaldot. Ia merekam health check sebagai snapshot, membandingkannya secara deterministik, dan mengekspor laporannya, sehingga kesehatan sebuah node adalah sesuatu yang bisa kamu ',
  heroParagraphEmphasis: 'tunjukkan',
  heroParagraphTail: ', bukan sekadar klaim.',
  launchApp: 'Buka App',
  watchDemo: 'Tonton demo',
  heroFactLine:
    'Portaldot V3 EVM · Chain 420420777 · Testnet · Read-only secara bawaan · Anchor on-chain opsional · Tanpa polling',
  heroMeta: ['Chain 420420777', 'Testnet', 'Tanpa akun', 'Tanpa wallet', 'Tanpa polling'],
  heroFigureCaption: 'App-nya — perbandingan snapshot, dipotong dari sesi nyata',
  heroChipEvm: 'Portaldot V3 EVM',
  heroChipSchema: 'Report schema v1',
  banner: 'Portaldot Hacker House 2026 · Check-in 22 Okt 2026 · Final / code freeze 6 Nov 2026, 11:00 WIB',
  stats: [
    { value: '420420777', label: 'Chain ID', sub: 'Portaldot V3 EVM · hex 0x190F1CA9 · dikembalikan oleh eth_chainId' },
    { value: SITE_TESTS, label: 'Test lolos', sub: `${SITE_TEST_FILES} file · Vitest · suite terverifikasi 26 Okt 2026` },
    {
      value: '38',
      label: 'Metode RPC diuji',
      sub: '7 didukung pada profil EVM ini · sisanya menjawab method-not-found — dilaporkan, bukan disembunyikan',
    },
    {
      value: '+12',
      label: 'Blok di antara snapshot demo',
      sub: 'A 143,764 pukul 15:48:05 → B 143,776 pukul 15:49:21 WIB · selisih 76 detik',
    },
  ],
  problemTitle: 'Masalahnya',
  problemRight: 'Kenapa NodeScope ada',
  problemStatement: 'Centang hijau bukan bukti.',
  problemPara1a: 'Konsol dan explorer hanya memberi tahu bahwa sebuah node pernah menjawab ',
  problemPara1Emphasis: 'sekali',
  problemPara1b:
    '. Mereka tidak menunjukkan drift, regresi diam-diam, atau apakah pemeriksaan yang sama masih lolos satu jam kemudian, dan mereka tidak memberimu apa pun yang bisa kamu serahkan sebagai bukti.',
  problemPara2:
    'NodeScope memperlakukan setiap pemeriksaan sebagai observasi yang layak disimpan: bertimestamp, terstruktur, dan bisa dibandingkan. Ketika sesuatu berubah, diff-nya mengatakan persis apa yang berubah, metode demi metode.',
  whyTitle: 'Kenapa konsol saja tidak cukup',
  whyItems: [
    'Konsol hanya menunjukkan satu respons saat ini. NodeScope merekam snapshot bertimestamp, sehingga klaim soal kesehatan tertambat pada suatu momen, bukan sekadar kesan.',
    'Snapshot dibandingkan secara deterministik, metode demi metode, sehingga drift dan regresi diam-diam menjadi terlihat, bukan bisa disangkal.',
    'EVM dan Substrate diperiksa bersama, sehingga satu verdict mencakup kedua transport yang dipakai node Portaldot.',
    'Setiap sesi diekspor sebagai laporan ber-hash yang bisa diverifikasi siapa pun, sehingga buktinya tetap ada meski tab browser sudah ditutup.',
  ],
  consoleLabel: 'KONSOL —',
  consoleQuote: '“Dapat dijangkau saat ini.”',
  nodescopeLabel: 'NODESCOPE —',
  nodescopeQuote: '“Sehat pukul 15:48 dan 15:49, selisih 76 detik, +12 blok, nol regresi. Ini laporannya.”',
  flowHeader: 'ONE QUESTION — eth_blockNumber — TWO ANSWERS',
  flowRight: 'Data demo · 22 Okt 2026',
  flowConsoleLane: 'Konsol — bertanya sekali',
  flowConsoleBody: ' — terjawab, lalu hilang. Tidak ada yang disimpan, tidak ada yang bisa ditunjukkan kemudian.',
  flowNodescopeLane: 'NodeScope — membuktikan dari waktu ke waktu',
  flowReportExported: 'laporan diekspor',
  flowNodescopeBody:
    'Jawaban yang sama, disimpan sebagai snapshot, sehingga perubahan di antaranya adalah fakta, bukan ingatan.',
  flowDelta: 'Δ +12 · 76 dtk',
  howTitle: 'Cara Kerja',
  howRight: 'Tiga langkah, tanpa setup',
  howSteps: [
    {
      title: 'Hubungkan & periksa',
      body: 'Arahkan NodeScope ke endpoint Portaldot V3 EVM mana pun. Sebuah health check menjalankan metode JSON-RPC inti dan merekam hasilnya sebagai snapshot terstruktur.',
    },
    {
      title: 'Snapshot',
      body: 'Snapshot adalah observasi bertimestamp yang berisi tinggi blok, chain ID, versi client, latensi, dan hasil per metode, yang disimpan selama sesi, sampai 20.',
    },
    {
      title: 'Bandingkan & ekspor',
      body: 'Pilih dua snapshot mana pun, atau baca seluruh sesi. NodeScope membandingkan snapshot secara deterministik, melacak tren latensi dan progresi blok di semuanya, dan berakhir pada verdict yang aturannya dicetak, bukan disembunyikan. Semuanya menyatu menjadi laporan diagnostik yang bisa diekspor (skema v1) dan dibagikan, distempel dengan hash integritas SHA-256, sehingga siapa pun bisa memverifikasi bahwa file tidak diubah setelah diekspor.',
    },
  ],
  archTitle: 'Cara kerja tiap bagian',
  archRight: 'Hanya browser · Tanpa server perantara',
  archNodes: [
    'EVM JSON-RPC — eth_chainId, eth_blockNumber, net_version, web3_clientVersion',
    'Substrate WebSocket — system_health, system_chain, chain_getHeader',
    'Mesin snapshot — observasi bertimestamp, hingga 20 per sesi',
    'Diff deterministik & verdict — aturannya ditampilkan, tidak disembunyikan',
    'JSON kanonis + laporan SHA-256 — bisa diverifikasi di /verify',
    'Anchor on-chain opsional — hanya hash laporan, di Portaldot V3',
  ],
  transcriptHeader: '>_ HEALTH CHECK — RUN YANG DIREKAM',
  transcriptPause: 'Jeda transkrip',
  transcriptPlay: 'Putar transkrip',
  transcriptObserved: 'Nilai yang teramati',
  transcriptLatency: 'LATENSI',
  transcriptOutcome: 'HASIL',
  transcriptSuccess: 'SUKSES',
  transcriptRunning: 'BERJALAN',
  transcriptPass: 'LULUS',
  transcriptNote: 'Satu langkah dari pemeriksaan nyata yang direkam 22 Okt 2026. Empat metode, empat receipt, disimpan sebagai snapshot ',
  checkObservedClient: 'string client, direkam di snapshot',
  reportSampleLabel: 'nodescope — diagnostic-report.v1',
  reportSampleRight: 'Sampel terpotong dari ekspor nyata',
  typeReplay: 'Putar ulang ketikan',
  backToTop: 'Kembali ke atas',
  tutorialTitle: 'Tutorial',
  tutorialRight: 'Lima langkah, tanpa setup',
  tutorialIntro:
    'Baru pertama kali buka NodeScope? Ikuti lima langkah ini, semuanya memakai tombol yang sudah ada di app, tanpa akun, tanpa wallet, dan tanpa konfigurasi. Bagian For judges di bawah adalah versi verifikasi yang sama, ditulis untuk juri.',
  tutorialSteps: [
    {
      n: '01',
      title: 'Buka app, endpoint sudah terisi',
      body: 'Buka /app. Endpoint Portaldot V3 EVM sudah terisi, tidak ada yang perlu dikonfigurasi dan tidak ada yang perlu ditandatangani.',
    },
    {
      n: '02',
      title: 'Connect & Test',
      body: 'Tekan Connect & Test. App menguji koneksi ke endpoint dan menampilkan statusnya apa adanya, termasuk kalau endpoint tidak menjawab.',
    },
    {
      n: '03',
      title: 'Run Health Check',
      body: 'Tekan Run Health Check. Empat metode inti berjalan dan hasilnya disimpan sebagai snapshot bertimestamp di sesi ini, sampai 20 snapshot.',
    },
    {
      n: '04',
      title: 'Bandingkan dan baca verdict',
      body: 'Pilih dua snapshot untuk dibandingkan, atau baca Trends & Verdict untuk seluruh sesi. Verdict-nya deterministik dan aturannya dicetak bersama buktinya, tanpa skor.',
    },
    {
      n: '05',
      title: 'Export, verifikasi, anchor opsional',
      body: 'Export laporan JSON dari History, lalu jatuhkan file yang sama di /verify untuk memeriksa stempel SHA-256-nya. Kalau mau, anchor hash laporan itu on-chain dari panel 04, lalu verifikasi transaksinya di tempat yang sama.',
    },
  ],
  tutorialCtaTitle: 'Siap mencoba?',
  tutorialCtaBody: 'Satu klik ke app, dan lima langkah di atas bisa langsung dipraktikkan.',
  tutorialCtaPrimary: 'Mulai di app',
  tutorialCtaSecondary: 'Ke halaman Verify',
  instrumentTitle: 'Instrumen',
  instrumentRight: 'Output nyata, bukan mockup',
  diffHeader: '>_ PERBANDINGAN SNAPSHOT — OUTPUT NYATA',
  diffRight: 'Demo · 22 Okt 2026',
  diffUnchanged: 'TIDAK BERUBAH',
  diffFindings: '0 baru · 0 terselesaikan · 0 regresi',
  diffFooter: 'Deterministik — dua snapshot yang sama, diff yang sama, setiap saat',
  capabilityHeaders: ['Kemampuan', 'Fungsinya', 'Bukti'],
  capabilities: [
    {
      cap: 'Tren & verdict',
      tone: 'amber',
      what: 'Di seluruh sesi snapshot: tren latensi per metode, progresi blok dengan temuan stall dan regresi, dan verdict deterministik yang aturannya dicetak bersama buktinya.',
      proof: 'Butuh ≥2 health check · aturan ditampilkan, tanpa skor',
    },
    {
      cap: 'Penemuan kemampuan',
      tone: 'sky',
      what: 'Menguji 38 metode JSON-RPC; jawaban tidak didukung dilaporkan sebagai data, tidak pernah disulap menjadi sukses.',
      proof: '7 didukung pada Portaldot V3 EVM',
    },
    {
      cap: 'Konsol RPC',
      tone: 'slate',
      what: 'Jalankan metode apa pun secara manual, preset, parameter kustom, dan badge bukti dari riwayat run-mu sendiri.',
      proof: 'Hanya atas pemicu pengguna · tanpa polling',
    },
    {
      cap: 'Laporan diagnostik',
      tone: 'sky',
      what: 'Setiap run menyatu menjadi satu laporan JSON yang bisa dibagikan dengan temuan terkategori dan rekomendasi.',
      proof: 'Skema nodescope.diagnostic-report.v1',
    },
    {
      cap: 'Verdict gabungan',
      tone: 'emerald',
      what: 'Snapshot kesehatan EVM terbaru dan probe WebSocket Substrate, dibaca bersama dalam satu panel, masing-masing angka ditampilkan dengan timestamp-nya sendiri, dan kedua counter tidak pernah dikurangkan satu sama lain.',
      proof: 'Panel 07 di Overview · kedua transport, tanpa skor',
    },
    {
      cap: 'Verifikasi laporan',
      tone: 'emerald',
      what: 'Ekspor distempel dengan SHA-256 atas bentuk kanonis laporan. Siapa pun bisa memasukkan kembali file ke NodeScope dan memeriksa stempelnya, mengubah nilai apa pun di file akan merusaknya.',
      proof: 'Verifikasi di History, atau di /verify · tanpa server, tanpa akun, tanpa wallet',
    },
    {
      cap: 'Palet perintah',
      tone: 'slate',
      what: '⌘K mengendalikan navigasi, koneksi, health check, diagnostik, dan penyalinan bukti, keyboard dulu.',
      proof: 'Tekan ⌘K di dalam app',
    },
  ],
  evidenceTitle: 'Bukti Live',
  evidenceRight: 'Diamati di testnet nyata',
  evidenceGridCaption:
    "BLOK 147,592 → 147,639 · SATU SEL PER BLOK · WARNA = POSISI DALAM RENTANG · RENTANG DIAMATI PENUH DALAM SATU SESI — CHAIN TIDAK BERHENTI UNTUK KAMI",
  evidenceGridAria: '48 blok berurutan yang diamati dalam satu sesi, dari 147,592 sampai 147,639',
  evidenceHeaders: ['Tinggi blok', 'Observasi', 'Kapan'],
  evidenceRows: [
    { block: '133,242', label: 'Observasi pertama yang direkam', when: 'Okt 2026' },
    { block: '143,764', label: 'Demo Snapshot A', when: '22 Okt 2026 · 15:48 WIB' },
    { block: '143,776', label: 'Demo Snapshot B', delta: '+12', when: '22 Okt 2026 · 15:49 WIB' },
    { block: '147,639', label: 'Sesi QA', delta: '+1 in 7s', when: '22 Okt 2026 · 22:16 WIB' },
  ],
  evidenceFootnote:
    'Endpoint: test-evm-rpc-v3.portaldot.dev · Chain ID 420420777 · Bukti diamati, bukan dibuat-buat — anchor on-chain opsional hanya menyimpan hash laporan, bukan laporannya sendiri.',
  onchainTitle: 'Bukti on-chain',
  onchainRight: 'Satu laporan ter-anchor · Bisa diverifikasi sekarang',
  onchainIntro:
    'Anchoring itu opsional dan hanya menyimpan hash laporan, bukan laporannya sendiri. Satu laporan nyata sudah di-anchor di testnet Portaldot V3. Kontrak registry, transaksi anchor, dan bloknya ada di bawah, dan pemeriksaan yang sama berjalan live di /verify.',
  onchainCheckTitle: 'Cara memeriksanya sendiri',
  onchainCheckSteps: [
    'Buka tautan verifikasi di bawah. Hash laporan, alamat kontrak, dan transaksi anchor sudah terisi otomatis.',
    'Tekan Verify anchor on chain. Panel meminta receipt transaksi ke RPC testnet (eth_getTransactionReceipt), tanpa dompet, tanpa tanda tangan.',
    'Hasil anchored berarti receipt berhasil, dikirim ke kontrak registry, dan membawa log yang topiknya cocok dengan hash laporan, pada blok yang ditampilkan.',
  ],
  onchainVerifyNote:
    'Tidak ada explorer EVM publik untuk chain ini: kedua explorer resmi Portaldot adalah explorer Substrate dan tidak menampilkan receipt EVM. Verifikasi di sini dilakukan lewat RPC itu sendiri, sumber yang sama dengan yang dibaca panel.',
  whoTitle: 'Siapa yang memakai NodeScope',
  whoRight: 'Dibuat untuk operator, berguna bagi siapa pun yang memeriksa node',
  whoItems: [
    {
      title: 'Operator & validator node Portaldot',
      body: 'Buktikan sebuah endpoint tetap sehat sepanjang sesi, dengan snapshot sebagai buktinya, bukan sekadar lampu hijau sesaat.',
    },
    {
      title: 'Penyedia RPC yang membuktikan SLA',
      body: 'Ekspor sesi bertimestamp sebagai bukti klaim uptime dan latensi, dalam file yang bisa diverifikasi pihak lain.',
    },
    {
      title: 'Tim ekosistem & foundation',
      body: 'Audit endpoint publik sebelum peluncuran RPC EVM mainnet, dengan catatan deterministik tentang apa yang benar-benar teramati.',
    },
    {
      title: 'Builder dApp yang memilih RPC',
      body: 'Bandingkan endpoint berdasarkan observasi nyata, progres blok, latensi, dukungan metode, sebelum memilih satu untuk dipakai.',
    },
    {
      title: 'Tim respons insiden',
      body: 'Rekam apa yang dilakukan node dan kapan, dalam laporan yang tetap ada setelah kanal insiden berlalu.',
    },
  ],
  galleryLabel: 'NodeScope · screenshot',
  screenshots: [
    { src: '/screenshots/01-endpoint-config.jpg', caption: '01 — Konfigurasi endpoint' },
    { src: '/screenshots/02-health-check-results.jpg', caption: '02 — Hasil health check' },
    { src: '/screenshots/03-snapshot-comparison.jpg', caption: '03 — Perbandingan snapshot' },
    { src: '/screenshots/04-findings-categorized.jpg', caption: '04 — Temuan, terkategori' },
    { src: '/screenshots/05-report-export.jpg', caption: '05 — Ekspor laporan' },
  ],
  v3Title: 'Portaldot V3, sesuai publikasi',
  v3Right: 'Referensi resmi, bukan tebakan',
  v3Intro:
    'Portaldot V3.0 diluncurkan 23 Okt 2026, 23:00 UTC (24 Okt 2026, 06:00 WIB), menurut post resmi @PortaldotL0 dan @Portaldot_Dev. NodeScope menandai setiap snapshot kesehatan Pre-V3 atau Post-V3 terhadap momen itu, sehingga bukti sebelum dan sesudah upgrade tidak pernah tercampur diam-diam. RPC EVM testnet di bawah adalah endpoint yang diperiksa NodeScope; node WebSocket di-probe secara terpisah di app dengan metode Substrate.',
  v3Cards: [
    { label: 'Mainnet · Node Console', href: 'https://node-console.portaldot.dev/', note: 'Titik akses mainnet resmi' },
    { label: 'Mainnet · Block Explorer', href: 'https://scanner-live-v3.portaldot.dev/', note: 'Explorer Substrate, bukan explorer EVM' },
    { label: 'Mainnet · Cross-Chain Bridge', href: 'https://bridge.portaldot.dev/', note: 'Bridge resmi' },
    { label: 'Testnet · EVM RPC', href: 'https://test-evm-rpc-v3.portaldot.dev', note: 'Diperiksa oleh NodeScope · chain 420420777' },
    {
      label: 'Testnet · WebSocket Node',
      href: 'https://x.com/Portaldot_Dev/status/2113571130527318088',
      note: 'Di-probe oleh NodeScope sebagai wss://test-node-v3.portaldot.dev · daftar endpoint oleh @Portaldot_Dev',
    },
    { label: 'Testnet · Block Explorer', href: 'https://scanner-testnet-v3.portaldot.dev/', note: 'Explorer testnet Substrate' },
  ],
  v3Footnote:
    'Tidak ada RPC EVM mainnet publik yang dipublikasikan dalam referensi itu, sehingga NodeScope tidak mengklaim pemeriksaan EVM mainnet. Ketidakadaan itu dinyatakan di sini dengan sengaja.',
  roadmapTitle: 'Roadmap',
  roadmapRight: 'Dilabeli dengan jujur',
  roadmapShipped: 'Terkirim — live di app',
  roadmapItems: [
    {
      title: 'Trends & Verdict',
      body: 'Tren latensi per metode dan progresi blok di seluruh sesi snapshot, berakhir pada verdict deterministik, HEALTHY, DEGRADED, atau UNSTABLE, dengan setiap aturan yang terpicu dicetak di sampingnya. Tanpa skor, tanpa black box.',
    },
    {
      title: 'Multi-Endpoint Comparison',
      body: 'Snapshot kesehatan dari endpoint berbeda, dibandingkan berdampingan, dengan disiplin keterbandingan: chain ID yang cocok mendapat delta blok dengan catatan, chain yang berbeda dinyatakan tidak sebanding alih-alih dikurangkan, dan perbedaan dukungan metode serta client muncul sebagai temuan. (Bukan watchlist, tidak ada yang dimonitor di latar; kamu yang membawa snapshot-nya.)',
    },
    {
      title: 'Portaldot Mainnet Profile',
      body: 'Mainnet V3 live sejak 24 Okt 2026, 06:00 WIB, tetapi belum ada RPC EVM mainnet publik yang dipublikasikan, sehingga NodeScope tidak memalsukan pemeriksaan mainnet. Halaman Mainnet Profile di /mainnet menautkan konsol, explorer, dan bridge resmi serta menyatakan ketidakadaan itu dengan jelas, dan mesin snapshot dan bukti yang sama siap pada hari RPC mainnet dipublikasikan.',
    },
  ],
  roadmapFootnote:
    'Inti NodeScope adalah bukti, sehingga pekerjaan yang direncanakan dilabeli direncanakan. Tidak ada di halaman ini yang mengklaim ada sebelum benar-benar ada.',
  roadmapNewLabel: 'Baru di build ini — live di app',
  roadmapNewItems: [
    {
      title: 'Health Score 0–100, rumus dipublikasikan',
      body: 'Lima komponen berbobot — ketersediaan RPC 30, identitas chain 15, progres head 20, latensi 20, paritas transport 15 — masing-masing tampil dengan poin dan input asalnya. Data yang tidak ada tidak pernah diberi skor; coverage dicetak di samping angka, dan di bawah 50% tidak ada angka sama sekali. Ekspor baru membawa skor di dalam stempel SHA-256.',
    },
    {
      title: 'Mode pantau + peringatan Discord / Slack',
      body: 'Opt-in dan hanya selama tab terbuka: tekan Start watch dan tiap siklus menjalankan health check dan probe Substrate sekali (minimal 30 dtk). Pesan ke webhook hanya saat transisi turun atau pulih, atau saat kamu menekan Send test. URL webhook tetap di browser kamu. CLI punya aturan yang sama lewat --webhook dan --watch.',
    },
    {
      title: 'Gerbang biaya pra-deploy (GitHub Action)',
      body: 'Composite Action yang menghitung biaya deploy kontrak dengan rumus Fee Lab dan menggagalkan job di atas max-tpot — atau saat deploy sama sekali tidak bisa dihitung. Blok run: miliknya dijalankan oleh test suite, jadi Action-nya diuji, bukan cuma didokumentasikan.',
    },
  ],
  scoreTitle: 'Health Score',
  scoreRight: 'Satu angka · rumus dipublikasikan · nodescope.health-score.v1',
  scoreIntro:
    'Verdict menjelaskan; skor merangkum. Setiap poin berasal dari pengukuran yang memang sudah dilakukan NodeScope, dan setiap komponen mencetak input asalnya. Komponen tanpa data tidak dihitung di sisi mana pun dari pecahan.',
  scoreHeaders: ['Komponen', 'Bobot', 'Aturan'],
  scoreRows: [
    { label: 'Ketersediaan RPC', weight: 30, rule: '30 × cek yang dijawab ÷ cek yang layak (snapshot terbaru). -32601 “method not found” bukan kegagalan dan tidak dihitung.' },
    { label: 'Identitas chain', weight: 15, rule: '15 jika eth_chainId = 420420777, selain itu 0.' },
    { label: 'Progres head', weight: 20, rule: 'Dua snapshot terbaru, endpoint sama: naik 20 · tinggi sama dengan jarak < 30 dtk 10 · macet ≥ 30 dtk atau mundur 0.' },
    { label: 'Latensi', weight: 20, rule: 'Median cek yang sukses: 20 pada ≤ 300 ms, 0 pada ≥ 2000 ms, linier di antaranya.' },
    { label: 'Paritas transport (WSS)', weight: 15, rule: 'Probe Substrate menjawab 10, +5 jika tidak syncing dan peers > 0.' },
  ],
  scoreFormula: 'skor = round(100 × Σ poin ÷ Σ bobot terukur) · hanya tampil jika bobot terukur ≥ 50',
  scoreFootnote: 'Rentang: 90–100 sehat · 70–89 menurun · 0–69 kritis. Skor ini baru dan berdiri di samping verdict deterministik, bukan menggantikannya.',
  scoreCta: 'Baca metodologi lengkap',
  marqueeLive: 'Blok live',
  marqueeItems: [
    'Chain 420420777',
    'Registry 0xd48d…c99c',
    '3 anchor · blok 216341 · 216343 · 216346',
    'Deploy all-in 1.016× · fee-only ~804×',
    'Transfer native 0.880×',
    'Laporan berstempel SHA-256',
    'Read-only · tidak ada yang ditandatangani',
  ],
  sectionLabels: {
    pillars: 'Dua pilar',
    score: 'Health Score',
    problem: 'Akar masalah',
    how: 'Cara kerja',
    tutorial: 'Pertama kali',
    instrument: 'Instrumen',
    evidence: 'Bukti',
    onchain: 'Bukti on-chain',
    who: 'Untuk siapa',
    v3: 'Referensi',
    roadmap: 'Roadmap',
    judge: 'Untuk juri',
  },
  roadmapNextLabel: 'Rencana — belum dirilis',
  roadmapNextItems: [
    {
      title: 'Mode pantau terjadwal',
      body: 'Pemeriksaan ulang terjadwal yang di-host, tetap berjalan setelah tab ditutup. Mode pantau hari ini terbatas pada tab: hanya berjalan selama app terbuka dan setelah kamu menekan Start.',
    },
    {
      title: 'Peringatan Telegram + riwayat peringatan',
      body: 'Peringatan Discord dan Slack sudah tersedia hari ini. Berikutnya: Telegram, dan peringatan yang membawa diff snapshot lengkap plus riwayat setiap transisi.',
    },
    {
      title: 'Laporan SLA bulanan untuk penyedia RPC',
      body: 'Rangkum ekspor sesi menjadi paket bukti bulanan: uptime, distribusi latensi, dan dukungan metode sepanjang bulan.',
    },
    {
      title: 'Papan peringkat endpoint publik untuk ekosistem',
      body: 'Peringkat endpoint publik hanya berdasarkan bukti observasi, dengan setiap skor bisa dilacak ke snapshot yang dapat diperiksa ulang siapa pun.',
    },
  ],
  judgeTitle: 'Untuk juri: 60 detik untuk memverifikasi',
  judgeRight: 'Tanpa akun · Tanpa wallet · Tanpa setup',
  judgeIntro:
    'Jangan percaya begitu saja pada angka di halaman ini. Setiap klaim di bawah adalah tombol yang bisa kamu tekan sendiri, di app live, terhadap testnet live.',
  judgeSteps: [
    {
      title: 'Buka app',
      body: 'Buka /app. Endpoint Portaldot V3 EVM sudah terisi. Tidak ada yang perlu dikonfigurasi, tidak ada yang perlu ditandatangani.',
    },
    {
      title: 'Hubungkan dan periksa',
      body: 'Tekan Connect & Test, lalu Run Health Check. Empat metode berjalan dan hasilnya disimpan sebagai snapshot bertimestamp.',
    },
    {
      title: 'Probe transport kedua',
      body: 'Di Overview, panel 06, tekan Probe WSS Node. Panel 07 lalu membaca snapshot EVM dan probe Substrate bersama-sama, masing-masing angka membawa timestamp-nya sendiri.',
    },
    {
      title: 'Ekspor dan verifikasi',
      body: 'Di History, ekspor laporan diagnostik, lalu jatuhkan file yang sama di /verify. Stempel SHA-256 mencakup semuanya kecuali stempel itu sendiri, sehingga mengubah nilai apa pun di file akan merusaknya.',
    },
    {
      title: 'Anchor, opsional',
      body: 'Kontrak registry sudah di-deploy di testnet Portaldot V3. Anchor hash laporan on-chain dengan wallet tool-mu sendiri, lalu verifikasi transaksinya di History, panel 04, atau buka tautan verifikasi yang bisa dibagikan dari panel yang sama.',
    },
  ],
  judgeFootnote:
    'Jika ada langkah yang gagal, kegagalan itu sendiri adalah hasilnya: NodeScope melaporkan node yang tidak menjawab, bukan menyulapnya menjadi sukses.',
  heroPillarLine: 'Dua pertanyaan, satu suite: apakah node jujur soal kondisinya, dan apakah biayanya jujur?',
  pillarSectionTitle: 'Satu suite, dua pilar',
  pillarSectionIntro: 'Health bertanya apakah node berkata jujur soal kondisinya. Fees bertanya apakah harganya berkata jujur. Setiap kartu di bawah mengukur satu angka live, sekali, saat bagian ini dibuka atau saat tombol Ukur ditekan. Tidak ada polling, dan pengukuran yang gagal tampil sebagai tidak tersedia, bukan angka karangan.',
  pillarHealth: {
    kicker: 'Pilar 01 · Health',
    title: 'NodeScope Health',
    body: 'Diagnostik live di permukaan EVM dan Substrate, dengan verdict yang bisa diverifikasi on-chain. Tekan Ukur untuk blok terbaru yang dilaporkan RPC EVM saat ini.',
    ctaLabel: 'Buka aplikasi',
    ctaHref: '/app',
    measureLabel: 'Ukur blok live',
    measuringLabel: 'Membaca chain…',
    unavailableLabel: 'Blok tidak tersedia saat ini',
    measuredLabel: 'Diukur pada',
  },
  pillarFees: {
    kicker: 'Pilar 02 · Fees',
    title: 'NodeScope Fees',
    body: 'Operasi yang sama dihargai di EVM dan native, fee-only versus all-in, dengan storage deposit ditampilkan terpisah. Tekan Ukur untuk estimasi deploy baru di kedua permukaan.',
    ctaLabel: 'Buka halaman Fees',
    ctaHref: '/fees',
    measureLabel: 'Ukur deploy live',
    measuringLabel: 'Mengestimasi di kedua permukaan…',
    unavailableLabel: 'Estimasi tidak tersedia saat ini',
    measuredLabel: 'Diukur pada',
  },
  feeBlockTitle: 'Angka yang melahirkan pilar Fees',
  feeBlockBody: 'Satu deploy terukur dari token sampel: EVM 124,098219 tPOT berbanding native 122,191411 tPOT all-in. Dibandingkan fee-only, selisihnya terbaca 804x; dibandingkan all-in, selisihnya 1,016x. Selisih itu adalah storage deposit, yang bisa dikembalikan saat storage dibebaskan.',
  feeBlockEvm: 'Total EVM: 124,098219 tPOT',
  feeBlockNative: 'Native all-in: 122,191411 tPOT (fee 0,154411 + deposit 122,037)',
  feeBlockFootnote: 'Diukur 26 Okt 2026, run yang sama dengan tabel temuan /fees. Ukur ulang secara live di Fee Lab.',
  feeBlockCta: 'Lihat cara fee diukur',
  ctaTitleA: 'Letakkan node-mu ',
  ctaTitleB: 'di bawah scope.',
  ctaBody: 'Buka toolkit live, jalankan health check terhadap testnet Portaldot V3, dan simpan receipt-nya.',
  footerLive: 'Live · Chain 420420777 · Portaldot V3 EVM Testnet',
  footerDescription:
    'Toolkit diagnostik Portaldot. Konsol berinteraksi, NodeScope membuktikan, dengan receipt yang bisa kamu serahkan ke siapa pun.',
  footerDisclaimer: 'Build Hacker House independen · Bukan produk resmi Portaldot · Testnet saja',
  footerColumns: [
    {
      header: 'Produk',
      links: [
        { label: 'Buka App', href: '/app' },
        { label: 'Cara Kerja', href: '#how' },
        { label: 'Instrumen', href: '#instrument' },
        { label: 'Bukti Live', href: '#evidence' },
        { label: 'Verifikasi Laporan', href: '/verify' },
        { label: 'Profil Mainnet', href: '/mainnet' },
        { label: 'Fees', href: '/fees' },
        { label: 'Docs', href: '/docs' },
        { label: 'Untuk Juri', href: '/judges' },
      ],
    },
    {
      header: 'Sumber Daya',
      links: [
        { label: 'DoraHacks BUIDL', href: 'https://dorahacks.io/build/50146' },
        { label: 'Repositori GitHub', href: 'https://github.com/Firzadf/nodescope' },
        { label: 'Konsol Node', href: 'https://node-console.portaldot.dev/' },
        { label: 'Block Explorer', href: 'https://scanner-live-v3.portaldot.dev/' },
        { label: 'Bridge Cross-Chain', href: 'https://bridge.portaldot.dev/' },
      ],
    },
    {
      header: 'Komunitas',
      links: [
        { label: 'Portaldot on X', href: 'https://x.com/PortaldotL0' },
        { label: 'Portaldot Dev on X', href: 'https://x.com/Portaldot_Dev' },
        { label: 'X — @dutzozan', href: 'https://x.com/dutzozan' },
        { label: 'Telegram — @inidutaa', href: 'https://t.me/inidutaa' },
        { label: 'Discord · dutzozan', href: null },
        { label: 'Video demo', href: 'https://youtu.be/TyTudF3MUaI' },
        { label: 'Dibangun solo oleh Firza Duta Fauzan', href: 'https://github.com/Firzadf/nodescope' },
      ],
    },
  ],
  footerCopyright: '© 2026 NodeScope',
  footerSchema: 'Report schema · nodescope.diagnostic-report.v1',
  packetYou: 'Kamu',
  packetReceipt: 'Receipt',
  packetNote: 'Alur dekoratif · tidak membawa data live',
  liveReadoutHeader: '>_ LIVE READOUT · PORTALDOT V3 EVM',
  liveReadoutLatest: 'Blok terbaru — diamati oleh halaman ini',
  liveReadoutProbing: 'MENYELIDIKI ENDPOINT…',
  liveReadoutMatch: '— COCOK DENGAN CHAIN YANG DIDOKUMENTASIKAN',
  liveReadoutMismatch: '— TIDAK COCOK DENGAN 420420777',
  liveReadoutAnsweredIn: 'DIJAWAB DALAM',
  liveReadoutAt: 'PADA',
  liveReadoutFetchedOnce: 'Diambil sekali, saat halaman ini dimuat. Bukan polling — muat ulang untuk mengamati lagi.',
  liveReadoutUnreachable: 'ENDPOINT TIDAK MENJAWAB SAAT HALAMAN INI DIMUAT.',
  liveReadoutUnreachableBody: 'NodeScope juga melaporkan itu — memang itulah intinya. Observasi terakhir yang didokumentasikan: ',
  liveReadoutLastObserved: 'blok 147,639 · 22 Okt 2026',
  lightboxClose: 'Tutup',
  motionCaption: 'Lihat alurnya — lima layar nyata, dianimasikan',
  motionNote: 'Screenshot dari sesi nyata pada 25 Okt 2026, dianimasikan dengan zoom pelan dan crossfade. Ini bukan rekaman live dan tidak membawa data live — gambar diam di bawah adalah layar yang sama.',
  langGroupAria: 'Bahasa',
  menuToggleAria: 'Buka/tutup menu navigasi',
};

export const landingCopy: Record<Lang, LandingCopy> = { en, id };
