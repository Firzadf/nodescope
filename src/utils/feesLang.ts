// EN/ID copy for the /fees sub-landing and the Fee Lab panel. The language
// itself is the shared session language from landingLang (one toggle, one
// stored value, every page). Method names, endpoint URLs, chain IDs,
// hashes, and the brand name NodeScope are never translated; they appear
// identically in both languages.
import type { Lang } from './landingLang';

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
  exportReport: string;
  exporting: string;
  exportNote: string;
  exportError: string;
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
    reasonDepositSuffix: 'Native storage deposit is reserved (refundable when storage is freed); the EVM gas figure already folds it in.',
    breakTitle: 'Fee breakdown',
    breakEvm: 'EVM · gas × gasPrice',
    breakNativeFee: 'Native · partialFee only (the headline denominator)',
    breakNativeAllIn: 'Native · fee + storage deposit (all-in)',
    breakEvmGas: 'EVM gas cost',
    breakNativeFeePart: 'native fee',
    breakDepositPart: 'storage deposit',
    breakDepositPct: 'The storage deposit is {pct}% of the native all-in cost here.',
    breakNoDeposit: 'This op adds no new storage, so the native side has no deposit and the comparison is fee vs fee.',
    breakExplain: 'pallet-revive charges a deposit for every byte and item a call leaves in state. A deploy stores the whole contract code, so the deposit dwarfs the weight fee. The EVM gas estimate already folds that deposit in; the native path reports it separately as a hold.',
    exportReport: 'Export fee report',
    exporting: 'Exporting…',
    exportNote: 'Downloads a SHA-256 stamped report (nodescope.diagnostic-report.v1) you can verify on /verify and anchor to the same registry as Health reports.',
    exportError: 'Failed to export the fee report. Please try again.',
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
    reasonDepositSuffix: 'Storage deposit native dicadangkan (bisa dikembalikan saat storage dibebaskan); angka gas EVM sudah melipatnya ke dalam.',
    breakTitle: 'Rincian fee',
    breakEvm: 'EVM · gas × gasPrice',
    breakNativeFee: 'Native · partialFee saja (penyebut headline)',
    breakNativeAllIn: 'Native · fee + storage deposit (all-in)',
    breakEvmGas: 'Biaya gas EVM',
    breakNativeFeePart: 'fee native',
    breakDepositPart: 'storage deposit',
    breakDepositPct: 'Storage deposit adalah {pct}% dari biaya all-in native di sini.',
    breakNoDeposit: 'Operasi ini tidak menambah storage baru, jadi sisi native tidak punya deposit dan perbandingannya adalah fee vs fee.',
    breakExplain: 'pallet-revive membebankan deposit untuk setiap byte dan item yang ditinggalkan sebuah call di state. Deploy menyimpan seluruh kode kontrak, sehingga deposit jauh melampaui weight fee. Estimasi gas EVM sudah melipat deposit itu ke dalam; jalur native melaporkannya terpisah sebagai hold.',
    exportReport: 'Ekspor laporan fee',
    exporting: 'Mengekspor…',
    exportNote: 'Mengunduh laporan berstempel SHA-256 (nodescope.diagnostic-report.v1) yang bisa diverifikasi di /verify dan di-anchor ke registry yang sama dengan laporan Health.',
    exportError: 'Gagal mengekspor laporan fee. Silakan coba lagi.',
  },
  },
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
};

// Comparison reasons are generated in English by compareLegs. Translate the
// known templates; anything unrecognized (including embedded RPC error
// text) passes through in English rather than being guessed.
export function translateReason(reason: string, lang: Lang): string {
  if (lang === 'en') return reason;
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
    ' Native storage deposit is reserved (refundable when storage is freed); the EVM gas figure already folds it in.',
    ' Deposit storage native ditahan (bisa dikembalikan saat storage dibebaskan); angka gas EVM sudah memasukkannya.',
  );
  return out;
}
