import { useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import type { DiagnosticHistoryItem } from '../../types/rpc';
import type { Finding } from '../../types/diagnostic';
import type { HealthCheckSnapshot } from '../../types/healthCheck';
import {
  attachHealthScore,
  attachOperatorActions,
  attachOperatorSignals,
  attachScoreHistory,
  attachSessionTrends,
  attachSubstrateWsProbe,
  buildDiagnosticReport,
  sanitizeEndpointOrigin,
} from '../../utils/reportBuilder';
import type { SubstrateWsProbeResult } from '../../services/substrateWsProbe';
import { stampReportIntegrity } from '../../utils/reportIntegrity';
import type { ChainMotion, StallAssessment } from '../../utils/stall';
import type { ReliabilityReport } from '../../services/reliabilityProbe';
import type { UnitsSanity } from '../../utils/unitsSanity';
import { computeSessionTrends } from '../../utils/sessionTrends';
import { computeHealthScoreV2 } from '../../utils/healthScore';
import { assessEndpointParity } from '../../../shared/endpointParity.mjs';
import { planOperatorActions } from '../../../shared/operatorActions.mjs';
import { evaluateHistoryFindings } from '../../services/diagnosticRules';

interface DiagnosticReportProps {
  history: DiagnosticHistoryItem[];
  latencyThresholdMs?: number;
  healthSnapshots?: HealthCheckSnapshot[];
  wsProbeResult?: SubstrateWsProbeResult | null;
  motion?: ChainMotion | null;
  stall?: StallAssessment | null;
  reliability?: ReliabilityReport | null;
  units?: UnitsSanity | null;
  onExported?: () => void;
}

export function DiagnosticReport({ history, latencyThresholdMs, healthSnapshots = [], wsProbeResult = null, motion = null, stall = null, reliability = null, units = null, onExported }: DiagnosticReportProps) {
  const sessionTrends = useMemo(() => computeSessionTrends(healthSnapshots), [healthSnapshots]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportAsJson = async () => {
    try {
      setExporting(true);
      setExportError(null);

      const exportRuleConfig = latencyThresholdMs !== undefined ? { latencyThresholdMs } : {};
      const exportFindings: Finding[] = evaluateHistoryFindings(history, exportRuleConfig);
      const report = await stampReportIntegrity(
        attachScoreHistory(
        attachOperatorActions(
        attachOperatorSignals(
          attachHealthScore(
            attachSubstrateWsProbe(
              attachSessionTrends(buildDiagnosticReport(history, exportFindings), healthSnapshots),
              wsProbeResult,
            ),
            healthSnapshots,
            wsProbeResult,
            { motion, reliability },
          ),
          { stall, wsProbe: wsProbeResult, reliability, units },
        ),
          { snapshots: healthSnapshots, wsProbe: wsProbeResult, stall },
        ),
          healthSnapshots,
          wsProbeResult,
          motion,
        ),
      );
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const localDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      link.download = `nodescope-diagnostic-report-${localDate}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onExported?.();
    } catch (error) {
      console.error('Failed to generate report:', error);
      setExportError('Failed to generate report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const recordCount = history.length;
  const successCount = history.filter((r) => r.success).length;
  const unsupportedCount = history.filter(
    (r) => !r.success && r.response?.error?.code === -32601
  ).length;
  const networkErrorCount = history.filter(
    (r) => !r.success && (r.error?.toLowerCase().includes('network') || r.error?.toLowerCase().includes('cors') || r.error?.includes('HTTP Error') || r.error?.includes('timeout'))
  ).length;
  const ruleConfig = latencyThresholdMs !== undefined ? { latencyThresholdMs } : {};
  // Findings are derived solely from history. The EVM connection check results are already
  // persisted into history by the connection flow, so evaluating them again here would
  // reintroduce a second block-height finding for the same endpoint.
  const findings = evaluateHistoryFindings(history, ruleConfig);
  const exportPlan = useMemo(() => {
    if (healthSnapshots.length === 0 && !wsProbeResult && stall?.state !== 'stalled') return null;
    const scored = computeHealthScoreV2({
      snapshots: healthSnapshots,
      wsProbe: wsProbeResult,
      motion,
      reliability: reliability
        ? { samples: reliability.samples, errors: reliability.errors, http5xx: reliability.http5xx, p50Ms: reliability.p50Ms, p95Ms: reliability.p95Ms }
        : null,
    });
    if (scored.coverage === 0 && stall?.state !== 'stalled') return null;
    return planOperatorActions({
      scope: 'self',
      score: scored,
      stall,
      wsProbe: wsProbeResult,
      parity: assessEndpointParity({ snapshots: healthSnapshots, wsProbe: wsProbeResult }),
    });
  }, [healthSnapshots, wsProbeResult, motion, reliability, stall]);
  const totalFindings = findings.length;
  const errorFindings = findings.filter((f) => f.severity === 'error').length;
  const warningFindings = findings.filter((f) => f.severity === 'warning').length;
  const infoFindings = findings.filter((f) => f.severity === 'info').length;

  return (
    <Card ticks>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 border-b border-line pb-4">
          <div>
            <PanelLabel index="01" label="REPORT" />
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mt-2">
              <FileText className="w-5 h-5 text-slate-400" />
              Diagnostic Report
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Summarize user-triggered diagnostics for export. No background requests or fabricated data.
              Every export is stamped with a SHA-256 integrity hash — anyone can check the file in the
              Verify panel below, or at the public /verify page, with no account and no wallet.
              On-chain anchoring is a separate, optional step in panel 04; verification there is
              read-only and NodeScope never signs anything.
              {wsProbeResult
                ? ' The latest Substrate probe result is included in this export, as its own block.'
                : ' Run the Substrate WS probe in Overview first if you want that transport in the export too.'}
            </p>
          </div>
          <button
            type="button"
            onClick={exportAsJson}
            disabled={exporting || recordCount === 0}
            className="btn-primary px-5 py-2.5 font-medium rounded-lg text-sm flex shrink-0 items-center gap-2 whitespace-nowrap"
          >
            {exporting ? <span className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Generating...' : 'Export as JSON'}
          </button>
        </div>

        {exportError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
            {exportError}
          </div>
        )}

        {recordCount > 0 && (
          <div className="space-y-4">
            <div className="bg-black/25 border border-line rounded-lg p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Total Records</div>
                  <div className="text-lg font-semibold text-white font-data">{recordCount}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Success</div>
                  <div className="text-lg font-semibold text-emerald-400 font-data">{successCount}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Unsupported Methods</div>
                  <div className="text-lg font-semibold text-amber-400 font-data">{unsupportedCount}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Network/HTTP Errors</div>
                  <div className="text-lg font-semibold text-red-400 font-data">{networkErrorCount}</div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-line text-xs">
                {sessionTrends.status === 'available' ? (
                  <p className="text-slate-400">
                    Session verdict:{' '}
                    <span
                      className={`font-data font-semibold ${
                        sessionTrends.verdict.level === 'healthy'
                          ? 'text-emerald-400'
                          : sessionTrends.verdict.level === 'degraded'
                            ? 'text-amber-400'
                            : 'text-red-400'
                      }`}
                    >
                      {sessionTrends.verdict.level.toUpperCase()}
                    </span>{' '}
                    — {sessionTrends.verdict.rules.filter((r) => r.fired).length} rule(s) fired · the export
                    includes the session trends &amp; verdict block with its evidence.
                  </p>
                ) : (
                  <p className="text-slate-500">
                    Session trends are not in this export yet — they need at least 2 health checks for one
                    endpoint (currently {sessionTrends.snapshotCount}).
                  </p>
                )}
                {exportPlan && (
                  <p className="mt-3 text-slate-300">
                    Next step: {exportPlan.overall.nextStep}
                    {exportPlan.degradation ? ` ${exportPlan.degradation}` : ''} The export includes this under operatorActions. The canonical score stays {exportPlan.schema === 'nodescope.operator-actions.v1' ? 'nodescope.health-score.v2' : ''}.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-black/25 border border-line rounded-lg p-4">
              <h4 className="text-sm font-medium text-slate-300 mb-2">Record Details Preview</h4>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                {history.slice(0, 3).map((item) => (
                  <div key={item.id} className="bg-slate-900 border border-line rounded p-2.5 text-xs">
                    <div className="flex justify-between mb-1">
                      <code className="text-slate-200 font-data">{item.request.method}</code>
                      <span className="text-slate-500">{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 truncate max-w-[150px]">{sanitizeEndpointOrigin(item.endpoint)}</span>
                      <span className={`font-medium ${getOutcomeColor(item)}`}>
                        {getOutcomeLabel(item)}
                      </span>
                    </div>
                  </div>
                ))}
                {history.length > 3 && (
                  <div className="text-xs text-slate-500 text-center py-1">
                    ... and {history.length - 3} more records (export includes all)
                  </div>
                )}
              </div>
            </div>

            {totalFindings > 0 && (
              <div className="bg-black/25 border border-line rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-300 mb-2">Diagnostic Findings</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-slate-500">Total Findings</div>
                    <div className="text-lg font-semibold text-white font-data">{totalFindings}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Errors</div>
                    <div className="text-lg font-semibold text-red-400 font-data">{errorFindings}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Warnings</div>
                    <div className="text-lg font-semibold text-amber-400 font-data">{warningFindings}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Info</div>
                    <div className="text-lg font-semibold text-signal-ink font-data">{infoFindings}</div>
                  </div>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {findings.map((finding, index) => (
                    <div key={index} className="bg-black/25 border border-line rounded-lg p-3 text-xs">
                      <div className="flex items-start gap-2 mb-1">
                        <span className="font-data text-slate-600">[{String(index + 1).padStart(3, '0')}]</span>
                        <span className={`font-medium text-xs ${getSeverityColor(finding.severity)}`}>
                          {finding.severity.toUpperCase()}
                        </span>
                        <span className="text-slate-400 font-data">{finding.ruleId}</span>
                        <span className="text-white font-medium">{finding.title}</span>
                      </div>
                      <div className="text-slate-300 mb-1">{finding.evidence}</div>
                      <div className="text-slate-500 mb-1">{finding.explanation}</div>
                      <div className="text-signal-ink font-medium">{finding.recommendation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {recordCount === 0 && (
          <div className="empty-shell px-5 py-6 flex items-start gap-4">
            <FileText className="w-5 h-5 text-slate-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">No records</p>
              <p className="text-sm text-slate-400 mt-1.5">No diagnostic history in this session yet.</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function getSeverityColor(severity: Finding['severity']): string {
  if (severity === 'error') return 'text-red-400';
  if (severity === 'warning') return 'text-amber-400';
  return 'text-signal-ink';
}

function getOutcomeLabel(item: DiagnosticHistoryItem): string {
  if (item.success) return 'Success';
  if (item.response?.error) return 'Unsupported Method';
  const err = item.error || '';
  if (
    err.includes('HTTP Error') ||
    err.includes('Network') ||
    err.includes('CORS') ||
    err.includes('Failed to fetch') ||
    err.includes('timeout')
  )
    return 'Network Error';
  return 'Invalid Response';
}

function getOutcomeColor(item: DiagnosticHistoryItem): string {
  if (item.success) return 'text-emerald-400';
  if (item.response?.error) return 'text-amber-400';
  const err = item.error || '';
  if (
    err.includes('HTTP Error') ||
    err.includes('Network') ||
    err.includes('CORS') ||
    err.includes('Failed to fetch') ||
    err.includes('timeout')
  )
    return 'text-red-400';
  return 'text-rose-400';
}
