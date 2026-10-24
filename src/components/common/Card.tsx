import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Technical-drawing corner ticks — reserved for evidence panels (reports, results, comparisons). */
  ticks?: boolean;
}

const TICK_POSITIONS = [
  '-top-[5px] -left-[5px] border-t border-l',
  '-top-[5px] -right-[5px] border-t border-r',
  '-bottom-[5px] -left-[5px] border-b border-l',
  '-bottom-[5px] -right-[5px] border-b border-r',
];

export function Card({ children, className = '', ticks = false }: CardProps) {
  return (
    <div
      className={`${ticks ? 'relative ' : ''}bg-panel border border-line rounded-xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${className}`}
    >
      {ticks &&
        TICK_POSITIONS.map((pos) => (
          <span key={pos} aria-hidden="true" className={`pointer-events-none absolute z-10 h-2 w-2 border-slate-500/60 ${pos}`} />
        ))}
      {children}
    </div>
  );
}
