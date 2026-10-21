import { Activity } from 'lucide-react';
import { Badge } from '../common/Badge';
import type { ConnectionStatus } from '../../types/node';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
}

export function Header({ connectionStatus }: HeaderProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-cyan-400" />
            <div>
              <h1 className="text-xl font-semibold text-white">NodeScope</h1>
              <p className="text-xs text-slate-400">Blockchain Node Diagnostics</p>
            </div>
          </div>
          <Badge status={connectionStatus} />
        </div>
      </div>
    </header>
  );
}
