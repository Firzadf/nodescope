import { X } from 'lucide-react';

export interface Toast {
  id: number;
  message: string;
}

/**
 * Short confirmations after user-triggered actions ("Snapshot saved",
 * "Report exported"). Presentational only: the parent owns the list and
 * the auto-dismiss timer. Rendered fixed, bottom-right, above the content.
 */
export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-line bg-panel px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
        >
          <p className="text-sm text-slate-200">{t.message}</p>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(t.id)}
            className="shrink-0 text-slate-500 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
