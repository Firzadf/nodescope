interface PanelLabelProps {
  index: string;
  label: string;
}

/**
 * Editorial panel index label — e.g. "01 / ENDPOINT".
 * Presentation only: renders the supplied index and label, no behavior.
 */
export function PanelLabel({ index, label }: PanelLabelProps) {
  return (
    <span className="font-data text-[11px] uppercase tracking-[0.18em] text-slate-500 select-none">
      <span className="text-slate-600">{index}</span>
      <span className="mx-1.5 text-slate-700">/</span>
      {label}
    </span>
  );
}
