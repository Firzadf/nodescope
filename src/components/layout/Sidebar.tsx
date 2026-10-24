import { Activity, Terminal, Clock, Search, ShieldCheck, Globe, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

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
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ activeSection, onSectionChange, onOpenPalette, collapsed = false, onToggleCollapse }: SidebarProps) {
  const width = collapsed ? 'w-16' : 'w-64';
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside className={`${width} bg-deep border-r border-line min-h-screen flex flex-col shrink-0 transition-[width] duration-200`}>
      <div className="flex items-center justify-between px-3 pt-5 pb-2">
        {!collapsed && <p className="px-2 font-data text-[10px] uppercase tracking-[0.24em] text-slate-600">Workspace</p>}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="btn-ghost flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          >
            <ToggleIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onOpenPalette}
          title="Jump to… (⌘K)"
          className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-white/[0.02] px-3.5 py-2.5 text-sm text-slate-400 transition-colors hover:border-slate-500/50 hover:text-slate-200"
        >
          <Search className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              Jump to…
              <kbd className="ml-auto shrink-0 rounded border border-line px-1.5 py-0.5 font-data text-[10px] text-slate-500">⌘K</kbd>
            </>
          )}
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
              title={item.label}
              className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-white/[0.06] text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[#0181FB]" />
              )}
              <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-white' : 'text-slate-500'}`} />
              {!collapsed && (
                <>
                  {item.label}
                  <span className={`ml-auto font-data text-[10px] ${isActive ? 'text-slate-400' : 'text-slate-600'}`}>
                    0{i + 1}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-5 pt-6 pb-2">
          <p className="font-data text-[10px] uppercase tracking-[0.24em] text-slate-600">Public pages</p>
        </div>
      )}
      <nav className="px-3 space-y-1.5">
        <a
          href="/verify"
          title="Verify a Report"
          className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-slate-400 transition-colors hover:text-slate-200 hover:bg-white/[0.03]"
        >
          <ShieldCheck className="h-[18px] w-[18px] text-slate-500" />
          {!collapsed && 'Verify a Report'}
        </a>
        <a
          href="/mainnet"
          title="Mainnet Profile"
          className="flex w-full items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-slate-400 transition-colors hover:text-slate-200 hover:bg-white/[0.03]"
        >
          <Globe className="h-[18px] w-[18px] text-slate-500" />
          {!collapsed && 'Mainnet Profile'}
        </a>
      </nav>

      {!collapsed && (
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
      )}
    </aside>
  );
}
