import { useState } from 'react';

/**
 * Copy-to-clipboard for evidence values (addresses, hashes, tx ids). The
 * button says what it copies to screen readers and confirms for 1.6 s.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.setTimeout(() => setState('idle'), 1600);
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy ${label}`}
      className="shrink-0 border border-line px-2 py-1 font-data text-[10px] uppercase tracking-[0.16em] text-slate-400 transition-colors hover:border-signal hover:text-white"
    >
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}</span>
    </button>
  );
}
