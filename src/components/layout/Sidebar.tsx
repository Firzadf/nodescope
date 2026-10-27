import { Activity, Terminal, Clock, Scale, Search, ShieldCheck, Globe, Home, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

type NavItem = {
  id: string;
  label: string;
  icon: typeof Activity;
  num: string;
};

// The two pillars of the suite. Health holds the original diagnostic
// panels; Fees holds Fee Lab (Calculator and History are phase 2 and are
// deliberately not listed here yet). Numbering runs continuously across
// groups so Fee Lab keeps its 04 slot.
const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Health',
    items: [
      { id: 'overview', label: 'Overview', icon: Activity, num: '01' },
      { id: 'diagnostics', label: 'RPC Diagnostics', icon: Terminal, num: '02' },
      { id: 'history', label: 'History', icon: Clock, num: '03' },
    ],
  },
  {
    label: 'Fees',
    items: [{ id: 'fee-lab', label: 'Fee Lab', icon: Scale, num: '04' }],
  },
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
  // Collapsed geometry: every row is the same centered 40x40 square, so all
  // icons share one exact centre (32px in a 64px sidebar). The old code kept
  // the expanded px-3 wrapper plus px-3.5 button padding, which pushed the
  // toggle 4px left and the nav icons 3px right of centre, and mixed 16px
  // and 18px icons, which is why the collapsed column looked off-centre.
  const row = collapsed
    ? 'mx-auto flex h-10 w-10 items-center justify-center rounded-lg'
    : 'flex w-full items-center gap-3 px-3.5 py-2.5 rounded-lg';
  const rowWrap = collapsed ? 'px-0 space-y-1.5' : 'px-3 space-y-1.5';
  const smallIcon = collapsed ? 'h-[18px] w-[18px]' : 'h-4 w-4';
  return (
    <aside className={`${width} bg-deep border-r border-line min-h-screen flex flex-col shrink-0 transition-[width] duration-200 ${collapsed ? '' : 'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:overflow-y-auto'}`}>
      <div className={`flex items-center pt-5 pb-2 ${collapsed ? 'justify-center px-0' : 'justify-between px-3'}`}>
        {!collapsed && <p className="px-2 font-data text-[10px] uppercase tracking-[0.24em] text-slate-600">Workspace</p>}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`btn-ghost flex shrink-0 items-center justify-center rounded-lg ${collapsed ? 'h-10 w-10' : 'h-8 w-8'}`}
          >
            <ToggleIcon className={smallIcon} />
          </button>
        )}
      </div>
      <div className={collapsed ? 'flex justify-center px-0 pb-3' : 'px-3 pb-3'}>
        <button
          type="button"
          onClick={onOpenPalette}
          title={`Jump to… (${typeof navigator !== 'undefined' && /Mac|iPhone/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'})`}
          className={`${row} border border-line bg-white/[0.02] text-sm text-slate-400 transition-colors hover:border-slate-500/50 hover:text-slate-200`}
        >
          <Search className={`${smallIcon} shrink-0`} />
          {!collapsed && (
            <>
              Jump to…
              <kbd className="ml-auto shrink-0 rounded border border-line px-1.5 py-0.5 font-data text-[10px] text-slate-500">{typeof navigator !== 'undefined' && /Mac|iPhone/.test(navigator.platform) ? '⌘K' : 'Ctrl+K'}</kbd>
            </>
          )}
        </button>
      </div>
      <nav className={rowWrap}>
        {navGroups.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'pt-1.5' : undefined}>
            {!collapsed && (
              <p className="px-2 pb-1.5 font-data text-[10px] uppercase tracking-[0.24em] text-slate-600">{group.label}</p>
            )}
            {collapsed && gi > 0 && (
              <div aria-hidden="true" className="mx-auto my-1.5 h-px w-6 bg-line" />
            )}
            <div className="space-y-1.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    title={item.label}
                    className={`relative ${row} text-sm transition-colors ${
                      isActive
                        ? 'bg-white/[0.06] text-white font-medium'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-signal" />
                    )}
                    <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-white' : 'text-slate-500'}`} />
                    {!collapsed && (
                      <>
                        {item.label}
                        <span className={`ml-auto font-data text-[10px] ${isActive ? 'text-slate-400' : 'text-slate-600'}`}>
                          {item.num}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-5 pt-6 pb-2">
          <p className="font-data text-[10px] uppercase tracking-[0.24em] text-slate-600">Public pages</p>
        </div>
      )}
      <nav className={rowWrap}>
        <a
          href="/"
          title="Back to landing page"
          className={`${row} text-sm text-slate-400 transition-colors hover:text-slate-200 hover:bg-white/[0.03]`}
        >
          <Home className="h-[18px] w-[18px] text-slate-500" />
          {!collapsed && '← Landing page'}
        </a>
        <a
          href="/verify"
          title="Verify a Report"
          className={`${row} text-sm text-slate-400 transition-colors hover:text-slate-200 hover:bg-white/[0.03]`}
        >
          <ShieldCheck className="h-[18px] w-[18px] text-slate-500" />
          {!collapsed && 'Verify a Report'}
        </a>
        <a
          href="/mainnet"
          title="Mainnet Profile"
          className={`${row} text-sm text-slate-400 transition-colors hover:text-slate-200 hover:bg-white/[0.03]`}
        >
          <Globe className="h-[18px] w-[18px] text-slate-500" />
          {!collapsed && 'Mainnet Profile'}
        </a>
        <a
          href="/fees"
          title="Fees"
          className={`${row} text-sm text-slate-400 transition-colors hover:text-slate-200 hover:bg-white/[0.03]`}
        >
          <Scale className="h-[18px] w-[18px] text-slate-500" />
          {!collapsed && 'Fees'}
        </a>
      </nav>

      {!collapsed && (
        <div className="mt-auto p-4">
          <div className="rounded-xl border border-line bg-panel p-3.5">
            <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-600">Target Network</p>
            <p className="text-sm font-medium text-white mt-1.5">Portaldot V3 EVM</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="live-dot h-1.5 w-1.5 bg-signal" />
              <span className="font-data text-[11px] text-slate-400">CHAIN 420420777</span>
            </div>
            <p className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600 mt-2.5">Testnet · Read-only RPC</p>
          </div>
        </div>
      )}
    </aside>
  );
}
