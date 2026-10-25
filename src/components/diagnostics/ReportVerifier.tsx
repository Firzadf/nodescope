import { useRef, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  FileWarning,
  Upload,
  XCircle,
} from 'lucide-react';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import {
  verifyReportText,
  type ReportVerification,
  type ReportVerificationStatus,
} from '../../utils/reportIntegrity';
import type { DiagnosticReportExport } from '../../utils/reportBuilder';

const STATUS_META: Record<
  ReportVerificationStatus,
  { label: string; banner: string; text: string }
> = {
  verified: {
    label: 'VERIFIED — INTACT',
    banner: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-400',
  },
  mismatch: {
    label: 'MISMATCH — ALTERED AFTER EXPORT',
    banner: 'bg-red-500/10 border-red-500/30',
    text: 'text-red-400',
  },
  no_integrity: {
    label: 'NO INTEGRITY STAMP',
    banner: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-400',
  },
  not_nodescope: {
    label: 'NOT A NODESCOPE REPORT',
    banner: 'bg-white/[0.03] border-line',
    text: 'text-slate-300',
  },
  malformed: {
    label: 'MALFORMED — NOT JSON',
    banner: 'bg-red-500/10 border-red-500/30',
    text: 'text-red-400',
  },
};

function StatusIcon({ status }: { status: ReportVerificationStatus }) {
  const cls = 'w-5 h-5 shrink-0';
  switch (status) {
    case 'verified':
      return <ShieldCheck className={cls} />;
    case 'mismatch':
      return <ShieldAlert className={cls} />;
    case 'no_integrity':
      return <ShieldQuestion className={cls} />;
    case 'not_nodescope':
      return <XCircle className={cls} />;
    case 'malformed':
      return <FileWarning className={cls} />;
  }
}

function truncateHash(hash: string): string {
  return `${hash.slice(0, 20)}…${hash.slice(-12)}`;
}

function verdictColor(level: string): string {
  if (level === 'healthy') return 'text-emerald-400';
  if (level === 'degraded') return 'text-amber-400';
  return 'text-red-400';
}

/** Read-only rendering of what a report file contains — attested or merely claimed. */
function ReportContents({ report, attested }: { report: DiagnosticReportExport; attested: boolean }) {
  const origins = [...new Set(report.records.map((r) => r.endpointOrigin))];
  const timestamps = report.records.map((r) => r.timestamp).sort();
  const outcomeCounts = new Map<string, number>();
  for (const record of report.records) {
    outcomeCounts.set(record.outcome, (outcomeCounts.get(record.outcome) ?? 0) + 1);
  }
  const trends = report.sessionTrends;
  const findings = report.findings ?? [];

  return (
    <div className="bg-black/25 border border-line rounded-lg p-4 space-y-4">
      <h4 className="text-sm font-medium text-slate-300">
        {attested ? 'Attested contents' : 'Contents claimed by this file'}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-xs text-slate-500">Exported at</div>
          <div className="text-xs font-semibold text-white font-data mt-0.5">{report.exportedAt}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Records</div>
          <div className="text-lg font-semibold text-white font-data">{report.recordCount}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Outcomes</div>
          <div className="text-xs text-slate-300 font-data mt-1 space-y-0.5">
            {[...outcomeCounts.entries()].map(([outcome, count]) => (
              <div key={outcome}>
                {outcome}: {count}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Record window</div>
          <div className="text-xs text-slate-300 font-data mt-1 space-y-0.5">
            <div>{timestamps[0] ?? '—'}</div>
            <div>{timestamps[timestamps.length - 1] ?? '—'}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-500 mb-1">Endpoint{origins.length > 1 ? 's' : ''}</div>
        <div className="space-y-0.5">
          {origins.map((origin) => (
            <div key={origin} className="text-xs text-slate-300 font-data">
              {origin}
            </div>
          ))}
        </div>
      </div>

      {report.substrateWsProbe && (
        <div className="pt-3 border-t border-line text-xs space-y-1">
          <p className="text-slate-400">
            Substrate probe included: {report.substrateWsProbe.chain ?? '—'} · header{' '}
            {report.substrateWsProbe.headerNumberDecimal ?? '—'} · peers {report.substrateWsProbe.peers ?? '—'} ·{' '}
            {report.substrateWsProbe.status === 'ok' ? 'answered' : `failed: ${report.substrateWsProbe.error ?? 'unknown'}`}
          </p>
          <p className="text-slate-500">
            This header is a Substrate counter, not an EVM block height, and is not compared against one.
          </p>
        </div>
      )}

      {trends && (
        <div className="pt-3 border-t border-line text-xs space-y-1">
          <p className="text-slate-400">
            Session verdict:{' '}
            <span className={`font-data font-semibold ${verdictColor(trends.verdict.level)}`}>
              {trends.verdict.level.toUpperCase()}
            </span>{' '}
            — {trends.verdict.rules.filter((r) => r.fired).length} of {trends.verdict.rules.length} rules
            fired · {trends.snapshotCount} snapshots · {trends.endpointOrigin ?? 'unknown endpoint'}
            {trends.endpointProfile === 'portaldot_v3_evm' ? ' · Portaldot V3 EVM' : ''}
            {trends.blockProgression.totalDelta !== null
              ? ` · block delta ${trends.blockProgression.totalDelta}`
              : ''}
          </p>
          <p className="text-slate-500">
            Pass rate {trends.passRate.passed}/{trends.passRate.total} checks across the session.
          </p>
        </div>
      )}

      <div className="pt-3 border-t border-line">
        <div className="text-xs text-slate-500 mb-2">Findings ({findings.length})</div>
        {findings.length === 0 ? (
          <p className="text-xs text-slate-500">No report-level findings recorded.</p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
            {findings.map((finding, index) => (
              <div key={index} className="bg-black/25 border border-line rounded-lg p-3 text-xs">
                <div className="flex items-start gap-2">
                  <span className="font-data text-slate-600">[{String(index + 1).padStart(3, '0')}]</span>
                  <span
                    className={`font-medium ${
                      finding.severity === 'error'
                        ? 'text-red-400'
                        : finding.severity === 'warning'
                          ? 'text-amber-400'
                          : 'text-[#7DB4FF]'
                    }`}
                  >
                    {finding.severity.toUpperCase()}
                  </span>
                  <span className="text-slate-400 font-data">{finding.ruleId}</span>
                  <span className="text-white font-medium">{finding.title}</span>
                </div>
                <div className="text-slate-300 mt-1">{finding.evidence}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReportVerifier() {
  const [result, setResult] = useState<ReportVerification | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [isSample, setIsSample] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const run = async (text: string) => {
    setBusy(true);
    setReadError(null);
    try {
      setResult(await verifyReportText(text));
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setIsSample(false);
    try {
      await run(await file.text());
    } catch {
      setReadError('Could not read that file in this browser.');
    }
  };

  const loadSample = async () => {
    setFileName('sample-report.json (bundled sample)');
    setIsSample(true);
    setBusy(true);
    setReadError(null);
    try {
      const res = await fetch('/sample-report.json');
      if (!res.ok) throw new Error('Sample fetch failed');
      await run(await res.text());
    } catch {
      setReadError('Could not load the bundled sample report.');
    } finally {
      setBusy(false);
    }
  };

  const meta = result ? STATUS_META[result.status] : null;

  return (
    <Card ticks>
      <div className="space-y-4">
        <div>
          <PanelLabel index="03" label="VERIFY" />
          <h3 className="text-lg font-semibold text-white mt-2">Verify a Report</h3>
          <p className="text-xs text-slate-400 mt-1">
            Check a NodeScope report file against the SHA-256 integrity stamp it was exported
            with. Everything is computed locally in your browser — the file is never uploaded.
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label="Drop a report JSON file or click to browse"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`empty-shell px-5 py-6 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-[#7DB4FF]/60 bg-white/[0.03]' : ''
          }`}
        >
          <Upload className="w-5 h-5 text-slate-500 mx-auto" />
          <p className="text-sm text-slate-300 mt-2">
            {busy ? 'Verifying…' : 'Drop a report JSON file here, or click to browse'}
          </p>
          <p className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-500 mt-1.5">
            {fileName ?? 'nodescope-diagnostic-report-*.json'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void loadSample()}
            disabled={busy}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white disabled:opacity-50"
          >
            Load sample report
          </button>
          <p className="text-xs text-slate-500">
            A real export from 22 Oct 2026: 12 records from the Portaldot V3 testnet RPC. Its
            SHA-256 stamp verifies locally in one click. It was not anchored on-chain, so the
            attestation check below stays empty for it.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setPasteOpen((open) => !open)}
            className="text-xs text-slate-400 hover:text-white transition-colors font-data uppercase tracking-[0.14em]"
          >
            {pasteOpen ? 'Hide paste input' : 'Or paste report JSON'}
          </button>
          {pasteOpen && (
            <div className="mt-2 space-y-2">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder='{"schemaVersion": "nodescope.diagnostic-report.v1", …}'
                rows={6}
                className="w-full bg-black/25 border border-line rounded-lg p-3 text-xs font-data text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#7DB4FF]/60"
              />
              <button
                type="button"
                disabled={busy || pasteText.trim().length === 0}
                onClick={() => {
                  setIsSample(false);
                  void run(pasteText);
                }}
                className="btn-primary px-4 py-2 font-medium rounded-lg text-sm"
              >
                Verify pasted report
              </button>
            </div>
          )}
        </div>

        {readError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
            {readError}
          </div>
        )}

        {result && meta && (
          <div key={`${result.status}-${result.computedHash ?? ''}`} className="state-swap space-y-4">
            {isSample && (
              <p>
                <span className="inline-flex items-center rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-data text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                  Sample
                </span>{' '}
                <span className="text-xs text-slate-500">
                  Bundled sample, captured 22 Oct 2026 — not your live result and not anchored on chain.
                </span>
              </p>
            )}
            <div className={`border rounded-lg p-4 ${meta.banner}`}>
              <div className={`flex items-center gap-2 font-data text-sm font-semibold tracking-wide ${meta.text}`}>
                <StatusIcon status={result.status} />
                {meta.label}
              </div>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">{result.detail}</p>
              {result.statedHash && (
                <div className="mt-3 space-y-1 font-data text-[11px]">
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-20 shrink-0">Stamped</span>
                    <span className="text-slate-300" title={result.statedHash}>
                      {truncateHash(result.statedHash)}
                    </span>
                  </div>
                  {result.computedHash && (
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-20 shrink-0">Computed</span>
                      <span className="text-slate-300" title={result.computedHash}>
                        {truncateHash(result.computedHash)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {result.report && (
              <ReportContents report={result.report} attested={result.status === 'verified'} />
            )}
          </div>
        )}

        <p className="text-[11px] text-slate-500 leading-relaxed border-t border-line pt-3">
          Verification proves this file matches the stamp computed when it was exported. It does
          not prove the node data inside the report was true.
        </p>
      </div>
    </Card>
  );
}
