import { useMemo, useState } from 'react';
import { renderBadgeSvg } from '../../../shared/liveStatus.mjs';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import type { OverallVerdict } from '../../utils/overallVerdict';

interface StatusBadgePanelProps {
  verdict: OverallVerdict;
  score: number | null;
  detail?: string | null;
}

/**
 * The embeddable badge is computed on request by /api/badge (read-only,
 * cached, no secrets, published testnet hosts only). This panel also draws
 * the same SVG from the session you just ran, so the preview does not wait
 * on the deployment.
 */
export function StatusBadgePanel({ verdict, score, detail }: StatusBadgePanelProps) {
  const [copied, setCopied] = useState(false);
  const svg = useMemo(
    () => renderBadgeSvg({ verdict: verdict === 'not_checked' ? 'not_checked' : verdict, score, detail: detail ?? '' }),
    [verdict, score, detail],
  );
  const pageOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://nodescope.vercel.app';
  const badgeUrl = `${pageOrigin}/api/badge?target=portaldot-v3-testnet`;
  const markdown = `[![NodeScope](${badgeUrl})](https://nodescope.vercel.app)`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card ticks>
      <div className="space-y-4">
        <PanelLabel index="11" label="STATUS BADGE" />
        <h3 className="text-lg font-semibold text-white">Shareable live status</h3>
        <p className="text-xs leading-relaxed text-slate-400">
          The image URL runs a read-only check of the published Portaldot V3 testnet when it is fetched.
          It caches for a short time, takes no secrets, and refuses any other host. The preview below is
          this session; the README image is the live one.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <img alt={`NodeScope status ${verdict}`} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} className="h-5" />
          <a href={badgeUrl} className="font-data text-[11px] text-slate-400 underline decoration-slate-600 underline-offset-4 hover:text-slate-200">Open live badge</a>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line bg-black/30 px-3 py-2 font-data text-[11px] text-slate-300">{markdown}</code>
          <button type="button" onClick={() => void copy()} className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-graphite">
            {copied ? 'Copied' : 'Copy markdown'}
          </button>
        </div>
      </div>
    </Card>
  );
}
