import type { ConnectionStatus } from '../../types/node';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
  /** Decimal block of the latest health snapshot, or null when none exists. */
  liveBlock: string | null;
}

export function Header({ connectionStatus, liveBlock }: HeaderProps) {
  const isConnected = connectionStatus === 'connected';
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
  const statusColor =
    connectionStatus === 'connected'
      ? '#34d399'
      : connectionStatus === 'connecting'
        ? '#fbbf24'
        : connectionStatus === 'error'
          ? '#f87171'
          : '#475569';
  const statusTextClass =
    connectionStatus === 'connected'
      ? 'text-emerald-300'
      : connectionStatus === 'connecting'
        ? 'text-amber-300'
        : connectionStatus === 'error'
          ? 'text-red-400'
          : 'text-slate-400';

  return (
    <header className="relative bg-deep/85 border-b border-line backdrop-blur shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a
            href="/"
            title="Back to landing page"
            className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-80"
          >
            <img
              src="/logo.png"
              alt="NodeScope"
              className="h-9 w-9 rounded-lg shadow-[0_0_24px_rgba(1,129,251,0.35)] ring-1 ring-[#0181FB]/40"
            />
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Node<span className="text-[#0181FB]">Scope</span>
                </h1>
                <span className="hidden font-data text-[11px] uppercase tracking-[0.18em] text-slate-400 sm:inline">
                  Proves node health over time
                </span>
              </div>
            </div>
          </a>

          {/* Centre: a quiet ECG trace that fills the old void. Decoration
              only, it carries no live data; the real state stays in the one
              status pill on the right. */}
          <div aria-hidden="true" className="pointer-events-none relative mx-8 hidden flex-1 lg:block">
            <div className="h-px bg-gradient-to-r from-transparent via-[#0181FB]/40 to-transparent" />
            <svg
              className="absolute -top-[7px] left-0 h-[15px] w-full overflow-visible"
              viewBox="0 0 600 15"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d="M 0,7 L 240,7 L 260,1 L 280,13 L 300,3 L 320,7 L 600,7"
                stroke="#0181FB"
                strokeOpacity="0.5"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle r="2.5" fill="#0181FB">
                <animateMotion
                  dur="9s"
                  repeatCount="indefinite"
                  path="M 0,7 L 240,7 L 260,1 L 280,13 L 300,3 L 320,7 L 600,7"
                />
              </circle>
            </svg>
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-deep px-2 font-data text-[9px] uppercase tracking-[0.24em] text-slate-600">
              Session ledger · user-triggered only
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* The one status indicator: the pulse pill carries the
                connection state and, once a snapshot exists, its block. */}
            <div className="flex items-center gap-2 px-3 py-1 bg-black/30 rounded-full border border-line">
              <svg className="w-8 h-4 overflow-visible" viewBox="0 0 32 16" fill="none">
                <path
                  d="M 0,8 L 8,8 L 11,2 L 15,14 L 19,4 L 22,8 L 32,8"
                  stroke={statusColor}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={isConnected ? "pulse-anim" : ""}
                />
              </svg>
              <span key={statusText} className={`state-swap text-xs font-data ${statusTextClass}`}>
                {statusText}
              </span>
            </div>

            <span className="hidden rounded-full border border-[#0181FB]/40 bg-[#0181FB]/10 px-3 py-1.5 font-data text-[11px] uppercase tracking-[0.18em] text-sky-200 shadow-[0_0_20px_rgba(1,129,251,0.15)] md:block">
              V3 Testnet · 420420777
            </span>
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[#0181FB]/60 to-transparent"
      />
    </header>
  );
}
