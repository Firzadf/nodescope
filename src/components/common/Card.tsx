import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-panel border border-line rounded-xl p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_16px_40px_-24px_rgba(0,0,0,0.7)] ${className}`}>
      {children}
    </div>
  );
}
