import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

export interface PaletteCommand {
  id: string;
  label: string;
  group: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  commands: PaletteCommand[];
  onClose: () => void;
}

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || (c.keywords || '').toLowerCase().includes(q),
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => {
        document.body.style.overflow = prevOverflow;
        clearTimeout(t);
      };
    }
  }, [open ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const runCommand = (cmd: PaletteCommand) => {
    onClose();
    cmd.run();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[activeIndex];
      if (cmd) runCommand(cmd);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[13vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <Search className="w-4.5 h-4.5 shrink-0 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search…"
            aria-label="Command search"
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 font-data text-[10px] uppercase text-slate-500">esc</kbd>
        </div>

        <div className="max-h-[46vh] overflow-y-auto py-2" role="listbox" aria-label="Commands">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center font-data text-xs text-slate-500">No commands match &ldquo;{query}&rdquo;</p>
          )}
          {filtered.map((cmd, i) => {
            const header = cmd.group !== lastGroup ? cmd.group : null;
            lastGroup = cmd.group;
            const isActive = i === activeIndex;
            return (
              <div key={cmd.id}>
                {header && (
                  <p className="px-4 pb-1 pt-3 font-data text-[10px] uppercase tracking-[0.22em] text-slate-600">{header}</p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => runCommand(cmd)}
                  className={`relative flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    isActive ? 'bg-white/[0.06] text-white' : 'text-slate-300'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-[#8C1DEF] to-[#0181FB]" />
                  )}
                  <span className="truncate">{cmd.label}</span>
                  {cmd.hint && <span className="ml-auto shrink-0 font-data text-[11px] text-slate-500">{cmd.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-5 border-t border-line px-4 py-2.5 font-data text-[10px] uppercase tracking-[0.14em] text-slate-600">
          <span>↑↓ Navigate</span>
          <span>↵ Run</span>
          <span>esc Close</span>
          <span className="ml-auto normal-case tracking-normal text-slate-600">NodeScope Command Palette</span>
        </div>
      </div>
    </div>
  );
}
