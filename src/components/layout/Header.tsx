import type { ConnectionStatus } from '../../types/node';
import { BrandMark } from '../common/BrandMark';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
  /** Decimal block of the latest health snapshot, or null when none exists. */
  liveBlock: string | null;
}

/**
 * Instrument status strip. Left: the mark and where you are. Right: the one
 * connection readout (state + block of the latest snapshot) and the chain
 * the instrument is calibrated against. No decoration that implies data.
 */
export function Header({ connectionStatus, liveBlock }: HeaderProps) {
  const statusText =
    connectionStatus === 'connected'
      ? liveBlock
        ? `LIVE · BLOCK #${liveBlock}`
        : 'CONNECTED'
      : connectionStatus === 'connecting'
        ? 'CONNECTING…'
        : connectionStatus === 'error'
          ? 'ERROR'
          : 'NOT CONNECTED';
  const dot =
    connectionStatus === 'connected'
      ? 'bg-emerald-400'
      : connectionStatus === 'connecting'
        ? 'bg-amber-400'
        : connectionStatus === 'error'
          ? 'bg-red-400'
          : 'bg-slate-600';
  const statusTextClass =
    connectionStatus === 'connected'
      ? 'text-emerald-300'
      : connectionStatus === 'connecting'
        ? 'text-amber-300'
        : connectionStatus === 'error'
          ? 'text-red-400'
          : 'text-slate-400';

  return (
    <header className="relative border-b border-line bg-deep">
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <a href="/" title="Back to landing page" className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-80">
          <BrandMark className="h-7 w-7 shrink-0 text-white" />
          <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-white">NodeScope</h1>
          <span className="hidden font-data text-[11px] uppercase tracking-[0.18em] text-slate-500 sm:inline">/ instrument</span>
        </a>

        <p aria-hidden="true" className="hidden flex-1 justify-center gap-6 font-data text-[10px] uppercase tracking-[0.22em] text-slate-500 xl:flex">
          <span>EVM · HTTP JSON-RPC</span>
          <span>Substrate · WSS</span>
          <span>Read-only · user-triggered</span>
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 border border-line bg-black/20 px-2.5 py-1.5">
            <span aria-hidden="true" className={`h-1.5 w-1.5 ${dot} ${connectionStatus === 'connected' ? 'live-dot' : ''}`} />
            <span key={statusText} className={`state-swap font-data text-[11px] tracking-[0.06em] ${statusTextClass}`}>
              {statusText}
            </span>
          </div>
          <span className="hidden border border-signal/60 px-2.5 py-1.5 font-data text-[11px] uppercase tracking-[0.18em] text-signal-ink md:block">
            V3 Testnet · 420420777
          </span>
        </div>
      </div>
    </header>
  );
}
