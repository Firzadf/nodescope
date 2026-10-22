import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number | null;
  icon: LucideIcon;
  subtitle?: string;
  unavailable?: boolean;
}

export function MetricCard({ title, value, icon: Icon, subtitle, unavailable }: MetricCardProps) {
  return (
    <div className="bg-panel px-5 py-4">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${unavailable ? 'bg-slate-600' : 'bg-emerald-400'}`} />
        <p className="font-data text-[11px] uppercase tracking-[0.16em] text-slate-500">{title}</p>
        <Icon className="w-3.5 h-3.5 text-slate-600 ml-auto shrink-0" />
      </div>
      <p className="mt-2.5 text-[26px] leading-none font-semibold text-white font-data truncate">
        {unavailable || value === null ? <span className="text-slate-600">—</span> : value}
      </p>
      {subtitle && <p className="mt-2 text-[11px] text-slate-500 font-data truncate">{subtitle}</p>}
    </div>
  );
}
