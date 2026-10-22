import type { LucideIcon } from 'lucide-react';
import { Card } from '../common/Card';

interface MetricCardProps {
  title: string;
  value: string | number | null;
  icon: LucideIcon;
  subtitle?: string;
  unavailable?: boolean;
}

export function MetricCard({ title, value, icon: Icon, subtitle, unavailable }: MetricCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-white font-data">
            {unavailable || value === null ? (
              <span className="text-slate-500 text-xl">—</span>
            ) : (
              value
            )}
          </p>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <Icon className="w-8 h-8 text-cyan-500/50" />
      </div>
    </Card>
  );
}
