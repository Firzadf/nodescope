import { Activity, Terminal, Clock, Search, ShieldCheck, Globe } from 'lucide-react';

type NavItem = {
  id: string;
  label: string;
  icon: typeof Activity;
};

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'diagnostics', label: 'RPC Diagnostics', icon: Terminal },
  { id: 'history', label: 'History', icon: Clock },
];

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onOpenPalette: () => void;
}

export function Sidebar({ activeSection, onSectionChange, onOpenPalette }: SidebarProps) {
  return (
    <aside className="w-64 bg-deep border-r border-line min-h-screen flex flex-col shrink-0">
      <div className="px-5 pt-6 pb-2">
        <p className="font-data text-[10px] uppercase tracking-[0.24em] text-slate-600">Workspace</p>
      </div>
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onOpenPalette}
          className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-white/[0.02] px-3.5 py-2.5 text-sm text-slate-400 transition-colors hover:border-slate-500/50 hover:text-slate-200"
        >
          <Search className="w-4 h-4 shrink-0" />
          Jump to…
          <kbd className="ml-auto shrink-0 rounded border border-line px-1.5 py-0.5 font-data text-[10px] text-slate-500">⌘K</kbd>
        </button>
      </div>
      <nav className="px-3 space-y-1.5">
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-white/[0.06] text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-gradient-to-b from-[#8C1DEF] to-[#0181FB]" />
              )}
              <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-white' : 'text-slate-500'}`} />
              {item.label}
              <span className={`ml-auto font-data text-[10px] ${isActive ? 'text-slate-400' : 'text-slate-600'}`}>
                0{i + 1}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="px-5 pt-6 pb-2">
        <p className="font-data text-[10px] uppercase tracking-[0.24em] text-slate-600">Public pages</p>
      </div>
      <nav className="px-3 space-y-1.5">
        <a
          href="/verify"
          className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-slate-400 transition-colors hover:text-slate-200 hover:bg-white/[0.03]"
        >
          <ShieldCheck className="w-[18px] h-[18px] text-slate-500" />
          Verify a Report
        </a>
        <a
          href="/mainnet"
          className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-slate-400 transition-colors hover:text-slate-200 hover:bg-white/[0.03]"
        >
          <Globe className="w-[18px] h-[18px] text-slate-500" />
          Mainnet Profile
        </a>
      </nav>

      <div className="mt-auto p-4">
        <div className="rounded-xl border border-line bg-panel p-3.5">
          <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-600">Target Network</p>
          <p className="text-sm font-medium text-white mt-1.5">Portaldot V3 EVM</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span className="font-data text-[11px] text-slate-400">CHAIN 420420777</span>
          </div>
          <p className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600 mt-2.5">Testnet · Read-only RPC</p>
        </div>
      </div>
    </aside>
  );
}
