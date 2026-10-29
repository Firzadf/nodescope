import { PaperHeader } from '../components/layout/PaperHeader';

/**
 * Portaldot Mainnet Profile, at /mainnet.
 *
 * Honest scope, stated on the page itself: Portaldot V3 mainnet is live
 * since 24 Oct 2026, 06:00 WIB, and the official mainnet references are
 * linked below. No public mainnet EVM RPC is published in those references,
 * so this page runs no mainnet EVM check and claims none. The moment a
 * mainnet EVM RPC is published and verified, the same snapshot and
 * evidence engine used for the testnet can point at it.
 * The official explorers are Substrate explorers, not EVM explorers, so
 * this page never generates a "view on explorer" link from an EVM observation.
 */
const PAPER_NAV = [
  { href: '/', label: 'Landing' },
  { href: '/app', label: 'Launch App' },
  { href: '/judges', label: 'Judges' },
  { href: '/verify', label: 'Verify' },
  { href: '/status', label: 'Status' },
  { href: '/docs', label: 'Docs' },
  { href: '/mainnet', label: 'Mainnet' },
];

const LINKS = [
  { label: 'Node Console', href: 'https://node-console.portaldot.dev/', note: 'Official mainnet access point' },
  { label: 'Block Explorer', href: 'https://scanner-live-v3.portaldot.dev/', note: 'Substrate explorer, not an EVM explorer' },
  { label: 'Cross-Chain Bridge', href: 'https://bridge.portaldot.dev/', note: 'Official bridge' },
];

export function MainnetProfile() {
  return (
    <div className="paper min-h-screen bg-ink text-slate-200">
      <PaperHeader links={PAPER_NAV} current="/mainnet" />
      <main className="mx-auto max-w-4xl px-4 pb-24 pt-12 md:px-8">
        <p className="font-data text-[11px] uppercase tracking-[0.22em] text-slate-500">NodeScope / Mainnet Profile</p>
        <h1 className="mt-5 font-display text-[52px] leading-[0.95] tracking-[-0.02em] text-white md:text-[80px]">
          Portaldot Mainnet V3, as published.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Mainnet V3 went live 24 Oct 2026, 06:00 WIB (23 Oct 2026, 23:00 UTC), per the official
          Portaldot posts. NodeScope does not fake a mainnet check: no public mainnet EVM RPC
          is published in the official references below, so there is no live mainnet EVM
          readout on this page. What is live today is the testnet toolkit, at /app, against
          chain 420420777.
        </p>
        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
          {LINKS.map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="block bg-panel/70 p-6 transition-colors hover:bg-panel">
              <p className="font-data text-[11px] uppercase tracking-[0.16em] text-sky-300">{link.label}</p>
              <p className="mt-2 font-data text-xs text-slate-300 [overflow-wrap:anywhere]">{link.href}</p>
              <p className="mt-1.5 text-xs text-slate-500">{link.note}</p>
            </a>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-line bg-panel/70 p-6">
          <h2 className="font-display text-lg font-semibold text-white">What happens when a mainnet RPC is published</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            The testnet engine needs no redesign: point it at the published endpoint, run the same
            health check, and the same snapshot, comparison, trends, and SHA-256 report flow
            applies, with snapshots tagged by the era they were taken in. Until then, this page
            stays an information page, not a check, and it is labeled as such on purpose.
          </p>
        </div>
      </main>
    </div>
  );
}
