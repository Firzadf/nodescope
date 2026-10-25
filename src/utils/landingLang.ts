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
  judgeTitle: string;
  judgeRight: string;
  judgeIntro: string;
  judgeSteps: StepItem[];
  judgeFootnote: string;
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
}

const en: LandingCopy = {
  nav: [
    { href: '#problem', label: 'The Problem' },
    { href: '#how', label: 'How It Works' },
    { href: '#instrument', label: 'The Instrument' },
    { href: '#evidence', label: 'Evidence' },
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
    { value: '328', label: 'Tests passing', sub: '39 files · Vitest · suite verified 26 Oct 2026' },
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
  galleryLabel: 'NodeScope · screenshot',
  screenshots: [
    { src: '/screenshots/01-endpoint-config.png', caption: '01 — Endpoint configuration' },
    { src: '/screenshots/02-health-check-results.png', caption: '02 — Health check results' },
    { src: '/screenshots/03-snapshot-comparison.png', caption: '03 — Snapshot comparison' },
    { src: '/screenshots/04-findings-categorized.png', caption: '04 — Findings, categorized' },
    { src: '/screenshots/05-report-export.png', caption: '05 — Report export' },
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
  ctaTitleA: 'Put your node ',
  ctaTitleB: 'under the scope.',
  ctaBody: 'Open the live toolkit, run a health check against the Portaldot V3 testnet, and keep the receipt.',
  footerLive: 'Live · Chain 420420777 · Portaldot V3 EVM Testnet · Status: Check-in submitted',
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
        { label: 'Demo video', href: 'https://www.youtube.com/watch?v=qne3_eZdcKA' },
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
};

const id: LandingCopy = {
  nav: [
    { href: '#problem', label: 'Masalah' },
    { href: '#how', label: 'Cara Kerja' },
    { href: '#instrument', label: 'Instrumen' },
    { href: '#evidence', label: 'Bukti' },
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
    { value: '328', label: 'Test lolos', sub: '39 file · Vitest · suite terverifikasi 26 Okt 2026' },
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
  galleryLabel: 'NodeScope · screenshot',
  screenshots: [
    { src: '/screenshots/01-endpoint-config.png', caption: '01 — Konfigurasi endpoint' },
    { src: '/screenshots/02-health-check-results.png', caption: '02 — Hasil health check' },
    { src: '/screenshots/03-snapshot-comparison.png', caption: '03 — Perbandingan snapshot' },
    { src: '/screenshots/04-findings-categorized.png', caption: '04 — Temuan, terkategori' },
    { src: '/screenshots/05-report-export.png', caption: '05 — Ekspor laporan' },
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
  ctaTitleA: 'Letakkan node-mu ',
  ctaTitleB: 'di bawah scope.',
  ctaBody: 'Buka toolkit live, jalankan health check terhadap testnet Portaldot V3, dan simpan receipt-nya.',
  footerLive: 'Live · Chain 420420777 · Portaldot V3 EVM Testnet · Status: Check-in dikirim',
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
        { label: 'Video demo', href: 'https://www.youtube.com/watch?v=qne3_eZdcKA' },
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
};

export const landingCopy: Record<Lang, LandingCopy> = { en, id };
