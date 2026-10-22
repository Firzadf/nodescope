import { Badge } from '../common/Badge';
import type { ConnectionStatus } from '../../types/node';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
}

export function Header({ connectionStatus }: HeaderProps) {
  const isConnected = connectionStatus === 'connected';

  return (
    <header className="relative bg-deep/95 border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="NodeScope" className="w-8 h-8 rounded-lg" />
            <div>
              <div className="flex items-baseline gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">NodeScope</h1>
                <span className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500">Proves node health over time</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Signature Detail: ECG / Pulse line */}
            <div className="flex items-center gap-2 px-3 py-1 bg-black/30 rounded-full border border-line">
              <svg className="w-8 h-4 overflow-visible" viewBox="0 0 32 16" fill="none">
                <path
                  d="M 0,8 L 8,8 L 11,2 L 15,14 L 19,4 L 22,8 L 32,8"
                  stroke={isConnected ? "#0181FB" : "#475569"}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={isConnected ? "pulse-anim" : ""}
                />
              </svg>
              <span className="text-xs font-data text-slate-400">
                {isConnected ? 'LIVE PULSE' : 'IDLE'}
              </span>
            </div>

            <Badge status={connectionStatus} />
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#0181FB]/50 to-transparent" />
    </header>
  );
}
