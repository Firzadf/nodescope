// EN/ID/ZH copy (ZH lives in feesLang.zh.ts) for the /fees sub-landing and the Fee Lab panel. The language
// itself is the shared session language from landingLang (one toggle, one
// stored value, every page). Method names, endpoint URLs, chain IDs,
// hashes, and the brand name NodeScope are never translated; they appear
// identically in both languages.
import type { Lang } from './landingLang';
import { feeLabZh, feesZh } from './feesLang.zh';

export interface FeesNavLink {
  href: string;
  label: string;
}

export interface FeesStep {
  title: string;
  body: string;
}

export interface FeesOp {
  title: string;
  body: string;
}

export interface FeesFindingRow {
  op: string;
  evm: string;
  nativeFee: string;
  deposit: string;
  allIn: string;
  feeOnly: string;
}

export interface FeesPanelCopy {
  kicker: string;
  title: string;
  intro: string;
  ops: { transfer: string; erc20: string; deploy: string; calldata: string };
  fromError: string;
  fromLabel: string;
  toLabel: string;
  amountLabel: string;
  tokenLabel: string;
  recipientLabel: string;
  tokenAmountLabel: string;
  tipPrefix: string;
  tipSuffix: string;
  codeSample: string;
  codeRegistry: string;
  codeCustom: string;
  codeLabel: string;
  codeError: string;
  constructorLabel: string;
  constructorHint: string;
  constructorError: string;
  uploadLabel: string;
  uploadErrorJson: string;
  uploadErrorBytecode: string;
  uploadErrorDeployed: string;
  uploadErrorHex: string;
  shareLabel: string;
  shareCopied: string;
  shareFailed: string;
  callToLabel: string;
  callDataLabel: string;
  measure: string;
  measureBusy: string;
  methodNote: string;
  triggeredNote: string;
  empty: string;
  evmSurface: string;
  nativeSurface: string;
  cheaper: string;
  unavailable: string;
  recPath: string;
  recEvm: string;
  recNative: string;
  recEither: string;
  recNone: string;
  ratioAllIn: string;
  ratioAllInNote: string;
  ratioFeeOnly: string;
  ratioFeeOnlyNote: string;
  measured: string;
  reasonNeither: string;
  reasonOnlyNative: string;
  reasonOnlyEvm: string;
  reasonTie: string;
  reasonEvmCheaper: string;
  reasonNativeCheaper: string;
  reasonDepositSuffix: string;
  breakTitle: string;
  breakEvm: string;
  breakNativeFee: string;
  breakNativeAllIn: string;
  breakEvmGas: string;
  breakNativeFeePart: string;
  breakDepositPart: string;
  breakDepositPct: string;
  breakNoDeposit: string;
  breakExplain: string;
  depositCodeLine: string;
  depositItemLine: string;
  exportReport: string;
  exporting: string;
  exportNote: string;
  exportError: string;
  langGroupAria: string;
}

export interface FeesCalcCopy {
  title: string;
  intro: string;
  sourceLabel: string;
  sourceSample: string;
  sourceRegistry: string;
  sourceCustom: string;
  codeLabel: string;
  codeHint: string;
  codePlaceholder: string;
  argsLabel: string;
  argsHint: string;
  uploadLabel: string;
  codeErrJson: string;
  codeErrBytecode: string;
  codeErrDeployed: string;
  codeErrHex: string;
  codeErrArgs: string;
  fromNote: string;
  measure: string;
  measureBusy: string;
  methodNote: string;
  triggeredNote: string;
  empty: string;
  depositTitle: string;
  depositBody: string;
  depositBarFee: string;
  depositBarDeposit: string;
  depositNote: string;
}

export interface FeesCopy {
  nav: FeesNavLink[];
  heroKicker: string;
  heroTitle: string;
  heroSub: string;
  heroAnswer: string;
  evmBarLabel: string;
  nativeBarLabel: string;
  nativeFeeSegment: string;
  nativeDepositSegment: string;
  barCaption: string;
  barAria: string;
  howTitle: string;
  howSteps: FeesStep[];
  opsTitle: string;
  ops: FeesOp[];
  findingsTitle: string;
  findingsIntro: string;
  findingsHead: string[];
  findingsRows: FeesFindingRow[];
  findingsNotes: string[];
  limitsTitle: string;
  limits: string[];
  ctaTitle: string;
  ctaBody: string;
  ctaLab: string;
  ctaLanding: string;
  langGroupAria: string;
  menuToggleAria: string;
  calc: FeesCalcCopy;
  panel: FeesPanelCopy;
}

export const feesCopy: Record<Lang, FeesCopy> = {
  en: {
    nav: [
      { href: '/', label: 'Landing' },
      { href: '/app', label: 'App' },
      { href: '/app/fee-lab', label: 'Fee Lab' },
      { href: '/docs', label: 'Docs' },
      { href: '/judges', label: 'Judges' },
    ],
    heroKicker: 'NodeScope Fees · Portaldot V3 testnet',
    heroTitle: 'Is 800x cheaper real?',
    heroSub:
      'One contract deploy, priced on both Portaldot surfaces. The headline says 800x. The receipt says something else.',
    heroAnswer:
      'The 800x is real as a fee-only comparison, and misleading as a cost comparison. Compare all-in with all-in and the same deploy lands at 1.016x. The gap is mostly a storage deposit that comes back when storage is freed, not money burned.',
    evmBarLabel: 'EVM · gas × gasPrice',
    nativeBarLabel: 'Native · fee + storage deposit (all-in)',
    nativeFeeSegment: 'partialFee',
    nativeDepositSegment: 'storage deposit',
    barCaption: 'Bars scaled to the larger all-in total (124.098 tPOT). One measured deploy, 26 Oct 2026.',
    barAria: 'EVM total 124.098 tPOT. Native total 122.191 tPOT, of which partialFee 0.154 tPOT and storage deposit 122.037 tPOT.',
    howTitle: 'How the comparison works',
    howSteps: [
      {
        title: 'Describe the operation once',
        body: 'Native transfer, ERC-20 transfer, contract deploy, or pasted calldata. One operation, defined once, priced twice.',
      },
      {
        title: 'Price it on EVM',
        body: 'eth_estimateGas times eth_gasPrice. The gas figure already folds the storage deposit in.',
      },
      {
        title: 'Price it natively',
        body: 'ReviveApi dry-run plus TransactionPaymentApi.query_info over the Substrate WebSocket. The deposit is reported separately, as a refundable hold.',
      },
      {
        title: 'Compare all-in with all-in',
        body: 'Fee-only ratios are shown too, so you can see exactly how a headline multiple is produced, and why it misleads.',
      },
    ],
    opsTitle: 'Four operations, measured the same way',
    ops: [
      { title: 'Native transfer', body: 'Plain value moved between accounts. No new storage, so no deposit on either surface.' },
      { title: 'ERC-20 transfer', body: 'Token moved between holders. A brand-new recipient creates a storage slot, so a deposit appears.' },
      { title: 'Contract deploy', body: 'Creation bytecode priced as a deploy. Storing the whole code is what makes the deposit dominate.' },
      { title: 'Paste calldata', body: 'Any raw call, priced as a call or a create. The same operation, both surfaces, no shortcuts.' },
    ],
    findingsTitle: 'What one measured run found',
    findingsIntro:
      'Live dry-run, 26 Oct 2026 ~13:13 UTC, runtime spec 3002, EVM gas price 30045–30050 wei. Values in tPOT. Re-measure any of these live in Fee Lab; numbers move with gas price and chain state.',
    findingsHead: ['Operation', 'EVM', 'Native fee', 'Storage deposit', 'All-in', 'Fee only'],
    findingsRows: [
      { op: 'Native tPOT transfer (1 tPOT)', evm: '0.013109', nativeFee: '0.014905', deposit: '0', allIn: '0.880× (EVM cheaper)', feeOnly: '0.9×' },
      { op: 'ERC-20 transfer, existing holder', evm: '0.019512', nativeFee: '0.020909', deposit: '0', allIn: '0.933× (EVM cheaper)', feeOnly: '0.9×' },
      { op: 'ERC-20 transfer, new recipient', evm: '3.921035', nativeFee: '0.021609', deposit: '3.8415', allIn: '1.015× (tie)', feeOnly: '181.5×' },
      { op: 'Deploy SampleToken (1,414 B)', evm: '124.098219', nativeFee: '0.154411', deposit: '122.037', allIn: '1.016× (tie)', feeOnly: '803.7×' },
      { op: 'Deploy FeeRegistry (1,252 B)', evm: '110.416529', nativeFee: '0.137909', deposit: '108.582', allIn: '1.016× (tie)', feeOnly: '800.6×' },
    ],
    findingsNotes: [
      'For plain transfers and calls that add no new storage, the EVM path was about 7–12% cheaper in this run (0.880× and 0.933× all-in).',
      'For deploys, the all-in series lands at 1.016×, a tie within the 2% band. The fee-only series is where the ~800× headlines come from.',
      'A new recipient changes the story: the deposit appears, the all-in ratio becomes a tie, and the fee-only ratio jumps to 181.5×.',
    ],
    limitsTitle: 'Honest limitations',
    limits: [
      'Point-in-time: gas price and chain state move, so every number here is one run. Fee Lab re-measures live on demand.',
      'That the EVM gas figure folds the deposit in is an inference from the numbers (EVM total matching native fee plus deposit within ~1.6%), not something read in docs.',
      'A storage deposit is a hold, refundable when the storage is freed. It is not burned, and it is not a fee.',
      'Some operations have no verified EVM equivalent (for example pallet-assets transfer) and report as unavailable, not as zero.',
      'These are dry-run estimates, not executed transactions. Nothing here signs or sends anything.',
      'Testnet only. No public mainnet EVM RPC is published, so no mainnet fee claim is made.',
    ],
    ctaTitle: 'Measure it yourself.',
    ctaBody: 'Pick an operation and ask both surfaces for a live estimate. No account, no wallet, no signing.',
    ctaLab: 'Open Fee Lab',
    ctaLanding: 'Back to landing',
    langGroupAria: 'Language',
    menuToggleAria: 'Toggle navigation menu',
    calc: {
      title: 'Price your own deploy',
      intro:
        'Paste creation bytecode or upload a solc artifact, and NodeScope asks both surfaces for a live deploy estimate of your contract. No signing, no transaction, just the same read-only dry-run Fee Lab uses.',
      sourceLabel: 'Contract source',
      sourceSample: 'SampleToken · {bytes} B',
      sourceRegistry: 'FeeRegistry · {bytes} B',
      sourceCustom: 'Paste or upload my own',
      codeLabel: 'Creation bytecode (0x…) or solc artifact JSON',
      codeHint:
        'Raw 0x creation bytecode, or the full solc artifact JSON. Runtime (deployed) bytecode alone cannot price a deploy and is rejected.',
      codePlaceholder: '0x6080… or { "bytecode": … }',
      argsLabel: 'Constructor args (0x…, ABI-encoded, optional)',
      argsHint: 'Appended to the creation bytecode. Leave empty for constructors with no arguments.',
      uploadLabel: 'Upload artifact JSON (solc output)',
      codeErrJson: 'Not valid JSON and not raw 0x bytecode. Paste creation bytecode (0x…) or a solc artifact JSON.',
      codeErrBytecode: 'No creation bytecode found. Expected bytecode, bytecode.object, or evm.bytecode.object.',
      codeErrDeployed: 'This contains only deployedBytecode (runtime code). A deploy price needs creation bytecode.',
      codeErrHex: 'Bytecode must be 0x-prefixed hex.',
      codeErrArgs: 'Constructor args must be 0x-prefixed hex (ABI-encoded).',
      fromNote: 'Dry-run origin: {from}. Used only as the estimate origin; nothing signs or sends.',
      measure: 'Estimate this deploy',
      measureBusy: 'Estimating this deploy…',
      methodNote: 'EVM: eth_estimateGas × eth_gasPrice. Native: ReviveApi dry-run + TransactionPaymentApi.query_info.',
      triggeredNote:
        'User-triggered only. No connection opens until you estimate, nothing polls, and the Substrate connection closes when you leave this page.',
      empty: 'No estimate yet. Choose a contract above and press "{measure}".',
      depositTitle: 'What the storage deposit is',
      depositBody:
        'A deploy stores contract code and the items the constructor writes. The native figure comes from a ReviveApi dry-run plus paymentInfo: partialFee is the weight fee, and storageDeposit is a reserved hold, not a burned fee. Code deposit: when the code is no longer referenced by any contract and the removal conditions are met, the original uploader can remove the code and receive that refund. Item storage deposit: after contract termination, storage cleanup is performed and the deposit is refunded to the origin. The EVM gas figure already includes the same hold. This page never signs or submits a transaction.',
      depositBarFee: 'weight fee (partialFee)',
      depositBarDeposit: 'storage deposit',
      depositNote:
        'Dry-run estimate, not an executed deploy. The refund itself happens on termination or code removal, which this page never executes.',
    },
  panel: {
    kicker: 'NodeScope / Fee Lab',
    title: 'Same operation. Two surfaces. One honest fee.',
    intro: 'Pick an operation. NodeScope asks both surfaces for a live estimate of the same thing, in parallel, from your browser. The EVM figure already includes the storage deposit; the native figure reports it separately as a refundable hold. That is why a fee-only comparison can read ~800× while the all-in comparison lands near 1×.',
    ops: { transfer: 'Native transfer', erc20: 'ERC-20 transfer', deploy: 'Contract deploy', calldata: 'Paste calldata' },
    fromError: 'From must be a 0x… EVM address (used only as the dry-run origin; nothing is signed).',
    fromLabel: 'From (dry-run origin, never signs)',
    toLabel: 'To',
    amountLabel: 'Amount (tPOT)',
    tokenLabel: 'Token (default: {symbol}, {decimals} dp)',
    recipientLabel: 'Recipient',
    tokenAmountLabel: 'Amount (tokens)',
    tipPrefix: 'Tip: a recipient that never held the token (e.g. ',
    tipSuffix: ') creates a new storage slot, so a storage deposit appears.',
    codeSample: 'SampleToken.sol · {bytes} B',
    codeRegistry: 'FeeRegistry.sol · {bytes} B',
    codeCustom: 'Custom bytecode',
    codeLabel: 'Creation bytecode (0x…)',
    codeError: 'Custom bytecode must be 0x-prefixed hex.',
    constructorLabel: 'Constructor args (0x…, ABI-encoded, optional)',
    constructorHint: 'Appended to the creation bytecode. Leave empty for constructors with no arguments.',
    constructorError: 'Constructor args must be 0x-prefixed hex (ABI-encoded).',
    uploadLabel: 'Upload artifact JSON (solc output)',
    uploadErrorJson: 'Artifact file is not valid JSON.',
    uploadErrorBytecode: 'No creation bytecode found in this artifact. Expected bytecode, bytecode.object, or evm.bytecode.object.',
    uploadErrorDeployed: 'This artifact contains only deployedBytecode (runtime code). Upload the creation bytecode artifact instead.',
    uploadErrorHex: 'Bytecode in this artifact must be 0x-prefixed hex.',
    shareLabel: 'Copy share link',
    shareCopied: 'Share link copied.',
    shareFailed: 'Could not copy the share link. Copy it from the address bar instead.',
    callToLabel: 'To (leave empty for a create)',
    callDataLabel: 'Calldata',
    measure: 'Estimate on both surfaces',
    measureBusy: 'Estimating on both surfaces…',
    methodNote: 'EVM: eth_estimateGas × eth_gasPrice. Native: ReviveApi dry-run + TransactionPaymentApi.query_info.',
    triggeredNote: 'User-triggered only. No connection opens until you measure, nothing polls in the background, and the Substrate connection closes when you leave this section.',
    empty: 'No measurement yet. Press "{measure}" to ask both surfaces for a live estimate of the operation above.',
    evmSurface: 'EVM surface',
    nativeSurface: 'Native surface',
    cheaper: 'cheaper',
    unavailable: 'unavailable',
    recPath: 'Recommended path',
    recEvm: 'EVM',
    recNative: 'Native',
    recEither: 'Either (tie)',
    recNone: 'No recommendation',
    ratioAllIn: 'EVM ÷ native, all-in',
    ratioAllInNote: 'native fee + storage deposit',
    ratioFeeOnly: 'EVM ÷ native fee only',
    ratioFeeOnlyNote: 'how headline multiples are usually measured',
    measured: 'Measured',
    reasonNeither: 'Neither surface could be estimated.',
    reasonOnlyNative: 'Only native is available',
    reasonOnlyEvm: 'Only EVM is available',
    reasonTie: 'All-in costs are within {pct}% — pick by wallet/UX.',
    reasonEvmCheaper: 'EVM is cheaper all-in by {pct}%.',
    reasonNativeCheaper: 'Native is cheaper all-in by {pct}%.',
    reasonDepositSuffix: 'Native storage deposit is a refundable reserved hold, not burned. Code deposit is refunded when the code is no longer referenced by any contract and the original uploader removes it. Item storage deposit is refunded after contract termination, once storage cleanup runs. The EVM gas figure already includes that hold.',
    breakTitle: 'Fee breakdown',
    breakEvm: 'EVM · gas × gasPrice',
    breakNativeFee: 'Native · partialFee only (the headline denominator)',
    breakNativeAllIn: 'Native · fee + storage deposit (all-in)',
    breakEvmGas: 'EVM gas cost',
    breakNativeFeePart: 'native fee',
    breakDepositPart: 'storage deposit',
    breakDepositPct: 'The storage deposit is {pct}% of the native all-in cost here.',
    breakNoDeposit: 'This op adds no new storage, so the native side has no deposit and the comparison is fee vs fee.',
    breakExplain: 'The native all-in cost is partialFee plus the storage deposit from a ReviveApi dry-run and paymentInfo. That deposit is reserved, not burned. Code deposit: when the code is no longer referenced by any contract and the removal conditions are met, the original uploader can remove the code and receive the refund. Item storage deposit: after contract termination, storage cleanup is performed and the deposit is refunded. The EVM gas figure already includes the same hold. Nothing here is signed or submitted.',
    depositCodeLine: 'Code deposit (estimate): {amount} tPOT. Refunded when the code is no longer referenced by any contract and the original uploader removes it.',
    depositItemLine: 'Item storage deposit: {amount} tPOT. Refunded after contract termination, once storage cleanup runs.',
    exportReport: 'Export fee report',
    exporting: 'Exporting…',
    exportNote: 'Downloads a SHA-256 stamped report (nodescope.diagnostic-report.v1) you can verify on /verify and anchor to the same registry as Health reports.',
    exportError: 'Failed to export the fee report. Please try again.',
    langGroupAria: 'Language',
  },
  },
  id: {
    nav: [
      { href: '/', label: 'Landing' },
      { href: '/app', label: 'App' },
      { href: '/app/fee-lab', label: 'Fee Lab' },
      { href: '/docs', label: 'Docs' },
      { href: '/judges', label: 'Judges' },
    ],
    heroKicker: 'NodeScope Fees · Testnet Portaldot V3',
    heroTitle: 'Apakah 800x lebih murah itu nyata?',
    heroSub:
      'Satu deploy contract, dihargai di kedua permukaan Portaldot. Headline bilang 800x. Receipt bilang lain.',
    heroAnswer:
      'Angka 800x itu nyata sebagai perbandingan fee-only, dan menyesatkan sebagai perbandingan biaya. Bandingkan all-in dengan all-in, deploy yang sama mendarat di 1,016x. Selisihnya sebagian besar deposit storage yang kembali saat storage dibebaskan, bukan uang yang hangus.',
    evmBarLabel: 'EVM · gas × gasPrice',
    nativeBarLabel: 'Native · fee + deposit storage (all-in)',
    nativeFeeSegment: 'partialFee',
    nativeDepositSegment: 'deposit storage',
    barCaption: 'Bar diskalakan ke total all-in terbesar (124,098 tPOT). Satu deploy terukur, 26 Okt 2026.',
    barAria: 'Total EVM 124,098 tPOT. Total native 122,191 tPOT, terdiri dari partialFee 0,154 tPOT dan deposit storage 122,037 tPOT.',
    howTitle: 'Cara kerja perbandingan',
    howSteps: [
      {
        title: 'Jelaskan operasi sekali',
        body: 'Transfer native, transfer ERC-20, deploy contract, atau calldata tempel. Satu operasi, didefinisikan sekali, dihargai dua kali.',
      },
      {
        title: 'Hargai di EVM',
        body: 'eth_estimateGas kali eth_gasPrice. Angka gas sudah memasukkan deposit storage.',
      },
      {
        title: 'Hargai secara native',
        body: 'Dry-run ReviveApi plus TransactionPaymentApi.query_info lewat WebSocket Substrate. Deposit dilaporkan terpisah, sebagai hold yang bisa dikembalikan.',
      },
      {
        title: 'Bandingkan all-in dengan all-in',
        body: 'Rasio fee-only juga ditampilkan, supaya kamu bisa melihat persis bagaimana angka headline dibuat, dan kenapa ia menyesatkan.',
      },
    ],
    opsTitle: 'Empat operasi, diukur dengan cara yang sama',
    ops: [
      { title: 'Transfer native', body: 'Value polos dipindah antar akun. Tidak ada storage baru, jadi tidak ada deposit di kedua permukaan.' },
      { title: 'Transfer ERC-20', body: 'Token dipindah antar holder. Penerima baru membuat slot storage, sehingga deposit muncul.' },
      { title: 'Deploy contract', body: 'Bytecode creation dihargai sebagai deploy. Menyimpan seluruh kode adalah yang membuat deposit mendominasi.' },
      { title: 'Tempel calldata', body: 'Call mentah apa pun, dihargai sebagai call atau create. Operasi yang sama, kedua permukaan, tanpa jalan pintas.' },
    ],
    findingsTitle: 'Temuan satu run terukur',
    findingsIntro:
      'Dry-run live, 26 Okt 2026 ~13:13 UTC, runtime spec 3002, gas price EVM 30045–30050 wei. Nilai dalam tPOT. Ukur ulang semuanya secara live di Fee Lab; angka bergerak mengikuti gas price dan state chain.',
    findingsHead: ['Operasi', 'EVM', 'Fee native', 'Deposit storage', 'All-in', 'Fee only'],
    findingsRows: [
      { op: 'Transfer tPOT native (1 tPOT)', evm: '0,013109', nativeFee: '0,014905', deposit: '0', allIn: '0,880× (EVM lebih murah)', feeOnly: '0,9×' },
      { op: 'Transfer ERC-20, holder lama', evm: '0,019512', nativeFee: '0,020909', deposit: '0', allIn: '0,933× (EVM lebih murah)', feeOnly: '0,9×' },
      { op: 'Transfer ERC-20, penerima baru', evm: '3,921035', nativeFee: '0,021609', deposit: '3,8415', allIn: '1,015× (seri)', feeOnly: '181,5×' },
      { op: 'Deploy SampleToken (1.414 B)', evm: '124,098219', nativeFee: '0,154411', deposit: '122,037', allIn: '1,016× (seri)', feeOnly: '803,7×' },
      { op: 'Deploy FeeRegistry (1.252 B)', evm: '110,416529', nativeFee: '0,137909', deposit: '108,582', allIn: '1,016× (seri)', feeOnly: '800,6×' },
    ],
    findingsNotes: [
      'Untuk transfer polos dan call yang tidak menambah storage baru, jalur EVM sekitar 7–12% lebih murah di run ini (0,880× dan 0,933× all-in).',
      'Untuk deploy, seri all-in mendarat di 1,016×, seri dalam band 2%. Seri fee-only adalah tempat headline ~800× berasal.',
      'Penerima baru mengubah cerita: deposit muncul, rasio all-in menjadi seri, dan rasio fee-only melonjak ke 181,5×.',
    ],
    limitsTitle: 'Keterbatasan yang dinyatakan jujur',
    limits: [
      'Titik waktu: gas price dan state chain bergerak, jadi setiap angka di sini adalah satu run. Fee Lab mengukur ulang secara live atas permintaan.',
      'Bahwa angka gas EVM memasukkan deposit adalah inferensi dari angka (total EVM cocok dengan fee native plus deposit dalam ~1,6%), bukan sesuatu yang dibaca di docs.',
      'Deposit storage adalah hold, bisa dikembalikan saat storage dibebaskan. Ia bukan uang hangus, dan bukan fee.',
      'Sebagian operasi tidak punya padanan EVM terverifikasi (misalnya transfer pallet-assets) dan dilaporkan tidak tersedia, bukan nol.',
      'Ini estimasi dry-run, bukan transaksi yang dieksekusi. Tidak ada yang di-sign atau dikirim di sini.',
      'Testnet saja. Tidak ada RPC EVM mainnet publik, jadi tidak ada klaim fee mainnet.',
    ],
    ctaTitle: 'Ukur sendiri.',
    ctaBody: 'Pilih satu operasi dan minta estimasi live dari kedua permukaan. Tanpa akun, tanpa wallet, tanpa signing.',
    ctaLab: 'Buka Fee Lab',
    ctaLanding: 'Kembali ke landing',
    langGroupAria: 'Bahasa',
    menuToggleAria: 'Buka/tutup menu navigasi',
    calc: {
      title: 'Hitung biaya deploy kontrakmu',
      intro:
        'Tempel creation bytecode atau unggah artifact solc, dan NodeScope meminta estimasi deploy live dari kedua permukaan untuk kontrakmu. Tanpa signing, tanpa transaksi, hanya dry-run read-only yang sama dengan yang dipakai Fee Lab.',
      sourceLabel: 'Sumber kontrak',
      sourceSample: 'SampleToken · {bytes} B',
      sourceRegistry: 'FeeRegistry · {bytes} B',
      sourceCustom: 'Tempel atau unggah punyaku sendiri',
      codeLabel: 'Creation bytecode (0x…) atau artifact JSON solc',
      codeHint:
        'Bytecode creation 0x mentah, atau artifact JSON solc lengkap. Bytecode runtime (deployed) saja tidak bisa dihargai sebagai deploy dan ditolak.',
      codePlaceholder: '0x6080… atau { "bytecode": … }',
      argsLabel: 'Argumen constructor (0x…, ABI-encoded, opsional)',
      argsHint: 'Ditambahkan ke akhir creation bytecode. Kosongkan untuk constructor tanpa argumen.',
      uploadLabel: 'Unggah artifact JSON (output solc)',
      codeErrJson: 'Bukan JSON yang valid dan bukan bytecode 0x mentah. Tempel creation bytecode (0x…) atau artifact JSON solc.',
      codeErrBytecode: 'Tidak ada creation bytecode. Harus ada bytecode, bytecode.object, atau evm.bytecode.object.',
      codeErrDeployed: 'Ini hanya berisi deployedBytecode (runtime code). Harga deploy butuh creation bytecode.',
      codeErrHex: 'Bytecode harus hex berawalan 0x.',
      codeErrArgs: 'Argumen constructor harus hex berawalan 0x (ABI-encoded).',
      fromNote: 'Origin dry-run: {from}. Hanya dipakai sebagai origin estimasi; tidak ada yang di-sign atau dikirim.',
      measure: 'Estimasi deploy ini',
      measureBusy: 'Mengestimasi deploy ini…',
      methodNote: 'EVM: eth_estimateGas × eth_gasPrice. Native: dry-run ReviveApi + TransactionPaymentApi.query_info.',
      triggeredNote:
        'Hanya atas perintah pengguna. Tidak ada koneksi yang dibuka sampai kamu mengestimasi, tidak ada polling, dan koneksi Substrate ditutup saat kamu meninggalkan halaman ini.',
      empty: 'Belum ada estimasi. Pilih kontrak di atas dan tekan "{measure}".',
      depositTitle: 'Apa itu storage deposit',
      depositBody:
        'Deploy menyimpan kode kontrak dan item yang ditulis constructor. Angka native berasal dari dry-run ReviveApi plus paymentInfo: partialFee adalah weight fee, dan storageDeposit adalah hold yang ditahan, bukan fee yang dibakar. Code deposit: ketika kode tidak lagi direferensikan kontrak mana pun dan syarat penghapusan terpenuhi, pengunggah asli dapat menghapus kode itu dan menerima refund. Item storage deposit: setelah kontrak dihentikan, pembersihan storage dijalankan dan deposit dikembalikan ke origin. Angka gas EVM sudah mencakup hold yang sama. Halaman ini tidak pernah menandatangani atau mengirim transaksi.',
      depositBarFee: 'weight fee (partialFee)',
      depositBarDeposit: 'storage deposit',
      depositNote:
        'Estimasi dry-run, bukan deploy yang dieksekusi. Refund sendiri terjadi saat terminasi atau penghapusan code, yang tidak pernah dieksekusi halaman ini.',
    },
  panel: {
    kicker: 'NodeScope / Fee Lab',
    title: 'Operasi yang sama. Dua permukaan. Satu fee yang jujur.',
    intro: 'Pilih satu operasi. NodeScope meminta estimasi live atas hal yang sama ke kedua permukaan, secara paralel, dari browser-mu. Angka EVM sudah mencakup storage deposit; angka native melaporkannya terpisah sebagai hold yang bisa dikembalikan. Karena itu perbandingan fee-only bisa terbaca ~800× sementara perbandingan all-in mendarat di dekat 1×.',
    ops: { transfer: 'Transfer native', erc20: 'Transfer ERC-20', deploy: 'Deploy kontrak', calldata: 'Tempel calldata' },
    fromError: 'From harus alamat EVM 0x… (hanya dipakai sebagai origin dry-run; tidak ada yang ditandatangani).',
    fromLabel: 'From (origin dry-run, tidak pernah sign)',
    toLabel: 'Ke',
    amountLabel: 'Jumlah (tPOT)',
    tokenLabel: 'Token (bawaan: {symbol}, {decimals} dp)',
    recipientLabel: 'Penerima',
    tokenAmountLabel: 'Jumlah (token)',
    tipPrefix: 'Tips: penerima yang belum pernah memegang token (mis. ',
    tipSuffix: ') membuat slot storage baru, sehingga storage deposit muncul.',
    codeSample: 'SampleToken.sol · {bytes} B',
    codeRegistry: 'FeeRegistry.sol · {bytes} B',
    codeCustom: 'Bytecode kustom',
    codeLabel: 'Bytecode creation (0x…)',
    codeError: 'Bytecode kustom harus hex berawalan 0x.',
    constructorLabel: 'Argumen constructor (0x…, ABI-encoded, opsional)',
    constructorHint: 'Ditambahkan ke akhir creation bytecode. Kosongkan untuk constructor tanpa argumen.',
    constructorError: 'Argumen constructor harus hex berawalan 0x (ABI-encoded).',
    uploadLabel: 'Unggah artifact JSON (output solc)',
    uploadErrorJson: 'File artifact bukan JSON yang valid.',
    uploadErrorBytecode: 'Tidak ada creation bytecode di artifact ini. Harus ada bytecode, bytecode.object, atau evm.bytecode.object.',
    uploadErrorDeployed: 'Artifact ini hanya berisi deployedBytecode (runtime code). Unggah artifact creation bytecode.',
    uploadErrorHex: 'Bytecode di artifact ini harus hex berawalan 0x.',
    shareLabel: 'Salin link berbagi',
    shareCopied: 'Link berbagi disalin.',
    shareFailed: 'Link berbagi gagal disalin. Salin dari address bar.',
    callToLabel: 'Ke (kosongkan untuk create)',
    callDataLabel: 'Calldata',
    measure: 'Estimasi di kedua permukaan',
    measureBusy: 'Mengestimasi di kedua permukaan…',
    methodNote: 'EVM: eth_estimateGas × eth_gasPrice. Native: ReviveApi dry-run + TransactionPaymentApi.query_info.',
    triggeredNote: 'Hanya atas perintah pengguna. Tidak ada koneksi yang dibuka sampai kamu mengukur, tidak ada polling di latar, dan koneksi Substrate ditutup saat kamu meninggalkan section ini.',
    empty: 'Belum ada pengukuran. Tekan "{measure}" untuk meminta estimasi live atas operasi di atas ke kedua permukaan.',
    evmSurface: 'Permukaan EVM',
    nativeSurface: 'Permukaan native',
    cheaper: 'lebih murah',
    unavailable: 'tidak tersedia',
    recPath: 'Jalur yang disarankan',
    recEvm: 'EVM',
    recNative: 'Native',
    recEither: 'Keduanya (seri)',
    recNone: 'Tidak ada rekomendasi',
    ratioAllIn: 'EVM ÷ native, all-in',
    ratioAllInNote: 'fee native + storage deposit',
    ratioFeeOnly: 'EVM ÷ native fee-only',
    ratioFeeOnlyNote: 'cara kelipatan headline biasanya diukur',
    measured: 'Diukur',
    reasonNeither: 'Tidak ada permukaan yang bisa diestimasi.',
    reasonOnlyNative: 'Hanya native yang tersedia',
    reasonOnlyEvm: 'Hanya EVM yang tersedia',
    reasonTie: 'Biaya all-in berada dalam {pct}% — pilih berdasarkan wallet/UX.',
    reasonEvmCheaper: 'EVM lebih murah all-in sebesar {pct}%.',
    reasonNativeCheaper: 'Native lebih murah all-in sebesar {pct}%.',
    reasonDepositSuffix: 'Storage deposit native ditahan, bukan dibakar. Code deposit dikembalikan ketika kode tidak lagi direferensikan kontrak mana pun dan pengunggah asli menghapusnya. Item storage deposit dikembalikan setelah kontrak dihentikan, begitu pembersihan storage berjalan. Angka gas EVM sudah mencakup hold yang sama.',
    breakTitle: 'Rincian fee',
    breakEvm: 'EVM · gas × gasPrice',
    breakNativeFee: 'Native · partialFee saja (penyebut headline)',
    breakNativeAllIn: 'Native · fee + storage deposit (all-in)',
    breakEvmGas: 'Biaya gas EVM',
    breakNativeFeePart: 'fee native',
    breakDepositPart: 'storage deposit',
    breakDepositPct: 'Storage deposit adalah {pct}% dari biaya all-in native di sini.',
    breakNoDeposit: 'Operasi ini tidak menambah storage baru, jadi sisi native tidak punya deposit dan perbandingannya adalah fee vs fee.',
    breakExplain: 'Biaya all-in native adalah partialFee ditambah storage deposit dari dry-run ReviveApi dan paymentInfo. Deposit itu ditahan, bukan dibakar. Code deposit: ketika kode tidak lagi direferensikan kontrak mana pun dan syarat penghapusan terpenuhi, pengunggah asli dapat menghapus kode itu dan menerima refund. Item storage deposit: setelah kontrak dihentikan, pembersihan storage dijalankan dan deposit dikembalikan. Angka gas EVM sudah mencakup hold yang sama. Tidak ada yang ditandatangani atau dikirim dari halaman ini.',
    depositCodeLine: 'Code deposit (perkiraan): {amount} tPOT. Dikembalikan ketika kode tidak lagi direferensikan kontrak mana pun dan pengunggah asli menghapusnya.',
    depositItemLine: 'Item storage deposit: {amount} tPOT. Dikembalikan setelah kontrak dihentikan, begitu pembersihan storage berjalan.',
    exportReport: 'Ekspor laporan fee',
    exporting: 'Mengekspor…',
    exportNote: 'Mengunduh laporan berstempel SHA-256 (nodescope.diagnostic-report.v1) yang bisa diverifikasi di /verify dan di-anchor ke registry yang sama dengan laporan Health.',
    exportError: 'Gagal mengekspor laporan fee. Silakan coba lagi.',
    langGroupAria: 'Bahasa',
  },
  },
  zh: feesZh,
};

export interface FeeLabCopy {
  eyebrow: string;
  title: string;
  chainLine: string;
  intro: string;
  opTransfer: string;
  opErc20: string;
  opDeploy: string;
  opCalldata: string;
  fromLabel: string;
  fromError: string;
  toLabel: string;
  amountLabel: string;
  tokenLabelPrefix: string;
  tokenLabelSuffix: string;
  recipientLabel: string;
  tokenAmountLabel: string;
  tipPrefix: string;
  tipSuffix: string;
  codeCustom: string;
  bytecodeLabel: string;
  bytecodePlaceholder: string;
  callToLabel: string;
  calldataLabel: string;
  measureIdle: string;
  measureBusy: string;
  methodNote: string;
  triggeredNote: string;
  emptyStatePrefix: string;
  emptyStateSuffix: string;
  evmSurface: string;
  nativeSurface: string;
  cheaper: string;
  methodLabel: string;
  gasLabel: string;
  gasPriceLabel: string;
  feeLabel: string;
  blockLabel: string;
  partialFeeLabel: string;
  storageDepLabel: string;
  weightLabel: string;
  unavailable: string;
  recPath: string;
  recEvm: string;
  recNative: string;
  recEither: string;
  recNone: string;
  allInLabel: string;
  allInSub: string;
  feeOnlyLabel: string;
  feeOnlySub: string;
  measuredPrefix: string;
  breakdownTitle: string;
  breakdownEvm: string;
  breakdownNativeFee: string;
  breakdownNativeAllIn: string;
  depositPctPre: string;
  depositPctPost: string;
  noStorage: string;
  depositExpl: string;
  loading: string;
}

export const feeLabCopy: Record<Lang, FeeLabCopy> = {
  en: {
    eyebrow: 'NodeScope / Fee Lab',
    title: 'Same operation. Two surfaces. One honest fee.',
    chainLine: 'Portaldot V3 · Chain 420420777',
    intro:
      'Pick an operation. NodeScope asks both surfaces for a live estimate of the same thing, in parallel, from your browser. The EVM figure already includes the storage deposit; the native figure reports it separately as a refundable hold. That is why a fee-only comparison can read ~800× while the all-in comparison lands near 1×.',
    opTransfer: 'Native transfer',
    opErc20: 'ERC-20 transfer',
    opDeploy: 'Contract deploy',
    opCalldata: 'Paste calldata',
    fromLabel: 'From (dry-run origin, never signs)',
    fromError: 'From must be a 0x… EVM address (used only as the dry-run origin; nothing is signed).',
    toLabel: 'To',
    amountLabel: 'Amount (tPOT)',
    tokenLabelPrefix: 'Token (default: ',
    tokenLabelSuffix: ' dp)',
    recipientLabel: 'Recipient',
    tokenAmountLabel: 'Amount (tokens)',
    tipPrefix: 'Tip: a recipient that never held the token (e.g. ',
    tipSuffix: ') creates a new storage slot, so a storage deposit appears.',
    codeCustom: 'Custom bytecode',
    bytecodeLabel: 'Creation bytecode (0x…)',
    bytecodePlaceholder: '0x6080…',
    callToLabel: 'To (leave empty for a create)',
    calldataLabel: 'Calldata',
    measureIdle: 'Estimate on both surfaces',
    measureBusy: 'Estimating on both surfaces…',
    methodNote: 'EVM: eth_estimateGas × eth_gasPrice. Native: ReviveApi dry-run + TransactionPaymentApi.query_info.',
    triggeredNote:
      'User-triggered only. No connection opens until you measure, nothing polls in the background, and the Substrate connection closes when you leave this section.',
    emptyStatePrefix: 'No measurement yet. Press “',
    emptyStateSuffix: '” to ask both surfaces for a live estimate of the operation above.',
    evmSurface: 'EVM surface',
    nativeSurface: 'Native surface',
    cheaper: 'cheaper',
    methodLabel: 'method',
    gasLabel: 'gas',
    gasPriceLabel: 'gasPrice',
    feeLabel: 'fee',
    blockLabel: 'block',
    partialFeeLabel: 'partialFee',
    storageDepLabel: 'storage dep.',
    weightLabel: 'weight',
    unavailable: 'unavailable',
    recPath: 'Recommended path',
    recEvm: 'EVM',
    recNative: 'Native',
    recEither: 'Either (tie)',
    recNone: 'No recommendation',
    allInLabel: 'EVM ÷ native, all-in',
    allInSub: 'native fee + storage deposit',
    feeOnlyLabel: 'EVM ÷ native fee only',
    feeOnlySub: 'how headline multiples are usually measured',
    measuredPrefix: 'Measured ',
    breakdownTitle: 'Fee breakdown',
    breakdownEvm: 'EVM · gas × gasPrice',
    breakdownNativeFee: 'Native · partialFee only (the headline denominator)',
    breakdownNativeAllIn: 'Native · fee + storage deposit (all-in)',
    depositPctPre: 'The storage deposit is ',
    depositPctPost: '% of the native all-in cost here. ',
    noStorage: 'This op adds no new storage, so the native side has no deposit and the comparison is fee vs fee. ',
    depositExpl:
      'pallet-revive charges a deposit for every byte and item a call leaves in state. A deploy stores the whole contract code, so the deposit dwarfs the weight fee. The EVM gas estimate already folds that deposit in; the native path reports it separately as a hold.',
    loading: 'Loading Fee Lab…',
  },
  id: {
    eyebrow: 'NodeScope / Fee Lab',
    title: 'Operasi yang sama. Dua permukaan. Satu fee yang jujur.',
    chainLine: 'Portaldot V3 · Chain 420420777',
    intro:
      'Pilih satu operasi. NodeScope meminta estimasi live dari kedua permukaan untuk hal yang sama, secara paralel, dari browser kamu. Angka EVM sudah memasukkan deposit storage; angka native melaporkannya terpisah sebagai hold yang bisa dikembalikan. Itu sebabnya perbandingan fee-only bisa terbaca ~800× sementara perbandingan all-in mendarat di dekat 1×.',
    opTransfer: 'Transfer native',
    opErc20: 'Transfer ERC-20',
    opDeploy: 'Deploy contract',
    opCalldata: 'Tempel calldata',
    fromLabel: 'From (origin dry-run, tidak pernah signing)',
    fromError: 'From harus alamat EVM 0x… (hanya dipakai sebagai origin dry-run; tidak ada yang di-sign).',
    toLabel: 'Ke',
    amountLabel: 'Jumlah (tPOT)',
    tokenLabelPrefix: 'Token (bawaan: ',
    tokenLabelSuffix: ' dp)',
    recipientLabel: 'Penerima',
    tokenAmountLabel: 'Jumlah (token)',
    tipPrefix: 'Tips: penerima yang belum pernah memegang token (mis. ',
    tipSuffix: ') membuat slot storage baru, sehingga deposit storage muncul.',
    codeCustom: 'Bytecode custom',
    bytecodeLabel: 'Bytecode creation (0x…)',
    bytecodePlaceholder: '0x6080…',
    callToLabel: 'To (kosongkan untuk create)',
    calldataLabel: 'Calldata',
    measureIdle: 'Estimasi di kedua permukaan',
    measureBusy: 'Mengestimasi di kedua permukaan…',
    methodNote: 'EVM: eth_estimateGas × eth_gasPrice. Native: dry-run ReviveApi + TransactionPaymentApi.query_info.',
    triggeredNote:
      'Hanya dipicu pengguna. Tidak ada koneksi yang dibuka sebelum kamu mengukur, tidak ada polling di latar, dan koneksi Substrate ditutup saat kamu meninggalkan section ini.',
    emptyStatePrefix: 'Belum ada pengukuran. Tekan “',
    emptyStateSuffix: '” untuk meminta estimasi live dari kedua permukaan untuk operasi di atas.',
    evmSurface: 'Permukaan EVM',
    nativeSurface: 'Permukaan native',
    cheaper: 'lebih murah',
    methodLabel: 'metode',
    gasLabel: 'gas',
    gasPriceLabel: 'gasPrice',
    feeLabel: 'fee',
    blockLabel: 'blok',
    partialFeeLabel: 'partialFee',
    storageDepLabel: 'dep. storage',
    weightLabel: 'weight',
    unavailable: 'tidak tersedia',
    recPath: 'Jalur yang disarankan',
    recEvm: 'EVM',
    recNative: 'Native',
    recEither: 'Keduanya (seri)',
    recNone: 'Tidak ada rekomendasi',
    allInLabel: 'EVM ÷ native, all-in',
    allInSub: 'fee native + deposit storage',
    feeOnlyLabel: 'EVM ÷ native fee only',
    feeOnlySub: 'cara angka headline biasanya diukur',
    measuredPrefix: 'Diukur ',
    breakdownTitle: 'Rincian fee',
    breakdownEvm: 'EVM · gas × gasPrice',
    breakdownNativeFee: 'Native · hanya partialFee (penyebut headline)',
    breakdownNativeAllIn: 'Native · fee + deposit storage (all-in)',
    depositPctPre: 'Deposit storage adalah ',
    depositPctPost: '% dari total all-in native di sini. ',
    noStorage: 'Operasi ini tidak menambah storage baru, jadi sisi native tidak punya deposit dan perbandingannya fee vs fee. ',
    depositExpl:
      'pallet-revive membebankan deposit untuk setiap byte dan item yang ditinggalkan sebuah call di state. Deploy menyimpan seluruh kode contract, sehingga depositnya jauh lebih besar dari weight fee. Estimasi gas EVM sudah memasukkan deposit itu; jalur native melaporkannya terpisah sebagai hold.',
    loading: 'Memuat Fee Lab…',
  },
  zh: feeLabZh,
};

// Comparison reasons are generated in English by compareLegs. Translate the
// known templates; anything unrecognized (including embedded RPC error
// text) passes through in English rather than being guessed.
export function translateReason(reason: string, lang: Lang): string {
  if (lang === 'en') return reason;
  if (lang === 'zh') return translateReasonZh(reason);
  let out = reason;
  out = out.replace(
    'Neither surface could be estimated.',
    'Tidak ada permukaan yang bisa diestimasi.',
  );
  out = out.replace(
    /^Only native is available \(EVM: (.*)\)\.$/,
    'Hanya native yang tersedia (EVM: $1).',
  );
  out = out.replace(
    /^Only EVM is available \(native: (.*)\)\.$/,
    'Hanya EVM yang tersedia (native: $1).',
  );
  out = out.replace(
    /^All-in costs are within (\d+)% — pick by wallet\/UX\.$/,
    'Biaya all-in bedanya dalam $1% — pilih sesuai wallet/UX.',
  );
  out = out.replace(
    /^EVM is cheaper all-in by ([\d.]+)%\.$/,
    'EVM lebih murah all-in sebesar $1%.',
  );
  out = out.replace(
    /^Native is cheaper all-in by ([\d.]+)%\.$/,
    'Native lebih murah all-in sebesar $1%.',
  );
  out = out.replace(
    ' Native storage deposit is a refundable reserved hold, not burned. Code deposit is refunded when the code is no longer referenced by any contract and the original uploader removes it. Item storage deposit is refunded after contract termination, once storage cleanup runs. The EVM gas figure already includes that hold.',
    ' Storage deposit native adalah hold yang ditahan dan bisa dikembalikan, bukan dibakar. Code deposit dikembalikan ketika kode tidak lagi direferensikan kontrak mana pun dan pengunggah asli menghapusnya. Item storage deposit dikembalikan setelah kontrak dihentikan, begitu pembersihan storage berjalan. Angka gas EVM sudah mencakup hold yang sama.',
  );
  return out;
}

function translateReasonZh(reason: string): string {
  let out = reason;
  out = out.replace('Neither surface could be estimated.', '两个层面都无法估算。');
  out = out.replace(/^Only native is available \(EVM: (.*)\)\.$/, '只有原生层面可用（EVM：$1）。');
  out = out.replace(/^Only EVM is available \(native: (.*)\)\.$/, '只有 EVM 可用（原生：$1）。');
  out = out.replace(
    /^All-in costs are within (\d+)% — pick by wallet\/UX\.$/,
    'All-in 成本相差在 $1% 以内——按钱包/用户体验选择即可。',
  );
  out = out.replace(/^EVM is cheaper all-in by ([\d.]+)%\.$/, 'EVM 的 all-in 成本便宜 $1%。');
  out = out.replace(/^Native is cheaper all-in by ([\d.]+)%\.$/, '原生的 all-in 成本便宜 $1%。');
  out = out.replace(
    ' Native storage deposit is a refundable reserved hold, not burned. Code deposit is refunded when the code is no longer referenced by any contract and the original uploader removes it. Item storage deposit is refunded after contract termination, once storage cleanup runs. The EVM gas figure already includes that hold.',
    ' 原生存储押金是可退还的冻结而非销毁。代码押金：当代码不再被任何合约引用且满足移除条件时，原始上传者可以移除代码并取回该押金。条目存储押金：合约终止后执行存储清理，押金随之退还。EVM gas 数值已包含同一笔冻结。',
  );
  return out;
}
