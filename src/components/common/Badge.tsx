import type { ConnectionStatus } from '../../types/node';

interface BadgeProps {
  status: ConnectionStatus;
}

const statusStyles: Record<ConnectionStatus, string> = {
  connected: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  disconnected: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  connecting: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const statusLabels: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  connecting: 'Connecting',
  error: 'Error',
};

export function Badge({ status }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[status]}`}
    >
      <span className="w-2 h-2 mr-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  );
}
