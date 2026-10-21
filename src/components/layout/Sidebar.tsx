import { Activity, Terminal, Clock } from 'lucide-react';

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
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-700 min-h-screen">
      <nav className="p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
