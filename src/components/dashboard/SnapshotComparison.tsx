import { useMemo, useState } from 'react';
import { GitCompare, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import { Card } from '../common/Card';
import { PanelLabel } from '../common/PanelLabel';
import { SnapshotStrip } from './SnapshotStrip';
import type { HealthCheckSnapshot } from '../../types/healthCheck';
import {
  compareSnapshots,
  type ComparedCheck,
  type ComparedFinding,
  type CheckComparisonStatus,
  type FindingComparisonStatus,
  type BlockHeightDeltaStatus,
} from '../../utils/snapshotComparer';
import { analyzeCrossEndpoint } from '../../utils/crossEndpointAnalysis';

interface SnapshotComparisonProps {
  snapshots: HealthCheckSnapshot[];
}

function formatValue(value: string | number | boolean | null): string {
  if (value === null) return 'null (unavailable)';
  if (value === '') return '"" (empty string)';
  return String(value);
}

function CheckStatusBadge({ status }: { status: CheckComparisonStatus }) {
  switch (status) {
    case 'unchanged':
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-line">
          Unchanged
        </span>
      );
    case 'changed':
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
          Changed
        </span>
      );
    case 'added':
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          + Added in B
        </span>
      );
    case 'removed':
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
          - Removed in B
        </span>
      );
  }
}

function FindingStatusBadge({ status }: { status: FindingComparisonStatus }) {
  switch (status) {
    case 'unchanged_finding':
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-line">
          Unchanged
        </span>
      );
    case 'new_finding':
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/30">
          New in B
        </span>
      );
    case 'resolved_finding':
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          Resolved in B
        </span>
      );
  }
}

function describeBlockHeightStatus(status: BlockHeightDeltaStatus): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'unavailable_incompatible_snapshots':
      return 'Unavailable (Incompatible endpoints or profiles)';
    case 'unavailable_missing_check':
      return 'Unavailable (Missing block height check in snapshot)';
    case 'unavailable_unsupported_representation':
      return 'Unavailable (Unsupported block number representation or failed check)';
  }
}

export function SnapshotComparison({ snapshots }: SnapshotComparisonProps) {
  // Sort snapshots descending by timestamp: [0] = newest (most recent), [1] = second most recent
  const sortedByTimestampDesc = useMemo(() => {
    return [...snapshots].sort((a, b) => b.timestamp - a.timestamp);
  }, [snapshots]);

  // Track explicit manual user selections; manual selections are never overridden
  const [userSelectedIdA, setUserSelectedIdA] = useState<string | null>(null);
  const [userSelectedIdB, setUserSelectedIdB] = useState<string | null>(null);

  // Derive active IDs: manual user selection takes precedence if still present in snapshots;
  // otherwise default to A = second most recent, B = most recent based on timestamps.
  const activeIdA =
    userSelectedIdA && snapshots.some((s) => s.id === userSelectedIdA)
      ? userSelectedIdA
      : sortedByTimestampDesc.length >= 2
      ? sortedByTimestampDesc[1].id
      : sortedByTimestampDesc[0]?.id || '';

  const activeIdB =
    userSelectedIdB && snapshots.some((s) => s.id === userSelectedIdB)
      ? userSelectedIdB
      : sortedByTimestampDesc[0]?.id || '';

  const snapshotA = snapshots.find((s) => s.id === activeIdA) || null;
  const snapshotB = snapshots.find((s) => s.id === activeIdB) || null;

  const comparison = useMemo(() => {
    if (!snapshotA || !snapshotB) return null;
    return compareSnapshots(snapshotA, snapshotB);
  }, [snapshotA, snapshotB]);

  // Cross-endpoint discipline (chain identity, delta comparability, findings).
  // Null for like-for-like pairs, which render exactly as before.
  const crossAnalysis = useMemo(() => {
    if (!snapshotA || !snapshotB) return null;
    return analyzeCrossEndpoint(snapshotA, snapshotB);
  }, [snapshotA, snapshotB]);

  if (snapshots.length < 2) {
    return (
      <Card ticks>
        <div className="space-y-4">
          <div className="border-b border-line pb-3">
            <PanelLabel index="04" label="COMPARISON" />
            <div className="flex items-center gap-2 mt-2">
              <GitCompare className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-semibold text-white">Snapshot Comparison</h3>
            </div>
          </div>
          <SnapshotStrip snapshots={snapshots} />
          <div className="empty-shell px-5 py-6 flex items-start gap-4">
            <GitCompare className="w-5 h-5 text-slate-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-data text-[10px] uppercase tracking-[0.22em] text-slate-500">Insufficient data</p>
              <p className="text-sm font-medium text-slate-300 mt-1.5">At least 2 health snapshots required to compare</p>
              <p className="text-xs text-slate-500 mt-1">
                {`Currently ${snapshots.length} available. Trigger "Run Health Check" to produce new snapshots for state comparison.`}
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card ticks>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 border-b border-line pb-4">
          <div>
            <PanelLabel index="04" label="COMPARISON" />
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mt-2">
              <GitCompare className="w-5 h-5 text-slate-400" />
              Snapshot Comparison
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic, read-only diff between two stored health checks.
            </p>
          </div>
          {comparison && (
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                comparison.comparable
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              Mode: {comparison.mode === 'like_for_like' ? 'Like-for-Like' : 'Cross-Endpoint'}
            </span>
          )}
        </div>

        <SnapshotStrip snapshots={snapshots} />

        {/* Snapshot Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Snapshot A (Baseline) */}
          <div className="bg-slate-900 border border-line rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="snapshot-a-select" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Snapshot A (Baseline)
              </label>
              {snapshotA && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(snapshotA.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
            <select
              id="snapshot-a-select"
              aria-label="Snapshot A (Baseline)"
              value={snapshotA?.id ?? ''}
              onChange={(e) => setUserSelectedIdA(e.target.value)}
              className="w-full bg-slate-950 border border-line rounded p-2 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
            >
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} — {new Date(s.timestamp).toLocaleTimeString()} ({s.endpointProfile})
                </option>
              ))}
            </select>
            {snapshotA && (
              <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-line">
                <div>Origin: <code className="text-slate-300 font-mono">{snapshotA.endpointOrigin}</code></div>
                <div>Profile: <span className="text-slate-300 font-mono">{snapshotA.endpointProfile}</span></div>
                <div>Checks: {snapshotA.checks.length} | Findings: {snapshotA.findings.length}</div>
              </div>
            )}
          </div>

          {/* Snapshot B (Current) */}
          <div className="bg-slate-900 border border-line rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="snapshot-b-select" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Snapshot B (Current)
              </label>
              {snapshotB && (
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(snapshotB.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
            <select
              id="snapshot-b-select"
              aria-label="Snapshot B (Current)"
              value={snapshotB?.id ?? ''}
              onChange={(e) => setUserSelectedIdB(e.target.value)}
              className="w-full bg-slate-950 border border-line rounded p-2 text-xs text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
            >
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} — {new Date(s.timestamp).toLocaleTimeString()} ({s.endpointProfile})
                </option>
              ))}
            </select>
            {snapshotB && (
              <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-line">
                <div>Origin: <code className="text-slate-300 font-mono">{snapshotB.endpointOrigin}</code></div>
                <div>Profile: <span className="text-slate-300 font-mono">{snapshotB.endpointProfile}</span></div>
                <div>Checks: {snapshotB.checks.length} | Findings: {snapshotB.findings.length}</div>
              </div>
            )}
          </div>
        </div>

        {/* Result blocks: keyed by the selected pair so a new selection replays the reveal. */}
        <div key={`${activeIdA}:${activeIdB}`} className="diff-reveal space-y-6">
        {/* Compatibility Warning */}
        {comparison && !comparison.comparable && (
          <div
            className={`rounded-lg p-3 text-xs flex items-start gap-2 border ${
              crossAnalysis?.chainRelation === 'different_chain'
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <AlertTriangle
              className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                crossAnalysis?.chainRelation === 'different_chain' ? 'text-red-400' : 'text-amber-400'
              }`}
            />
            <div>
              <p
                className={`font-semibold ${
                  crossAnalysis?.chainRelation === 'different_chain' ? 'text-red-200' : 'text-amber-200'
                }`}
              >
                Cross-Endpoint / Profile Comparison
              </p>
              <p className="mt-0.5">{comparison.incompatibilityReason}</p>
              {crossAnalysis && (
                <div className="mt-1.5 font-mono text-[11px] space-y-0.5">
                  <div>
                    A — <span className="font-medium">{crossAnalysis.originA}</span> ({crossAnalysis.profileA})
                  </div>
                  <div>
                    B — <span className="font-medium">{crossAnalysis.originB}</span> ({crossAnalysis.profileB})
                  </div>
                </div>
              )}
              {crossAnalysis?.chainRelation === 'different_chain' ? (
                <p className="text-[11px] text-red-400/90 mt-1">
                  Different chains: endpoint A reported chain ID {crossAnalysis.chainIdA}, endpoint B reported chain ID{' '}
                  {crossAnalysis.chainIdB}. The block-height delta is not comparable and is withheld below.
                </p>
              ) : crossAnalysis?.chainRelation === 'same_chain' ? (
                <p className="text-[11px] text-amber-400/80 mt-1">
                  Both endpoints reported chain ID {crossAnalysis.chainIdA}. The block-height delta below compares the
                  two endpoints at their respective check times — endpoints may be at different sync points. Do not
                  interpret as a direct time-series progression.
                </p>
              ) : (
                <p className="text-[11px] text-amber-400/80 mt-1">
                  Showing individual result diffs for reference only. Do not interpret as a direct time-series progression.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Cross-Endpoint Findings */}
        {crossAnalysis && crossAnalysis.findings.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="text-sm font-semibold text-slate-300">Cross-Endpoint Findings</h4>
              <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">[ Fig. 02 — Endpoint findings ]</span>
            </div>
            <div className="space-y-2">
              {crossAnalysis.findings.map((f) => (
                <div
                  key={`${f.ruleId}-${f.title}`}
                  className="bg-slate-900 border border-line rounded p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-mono text-[11px]">{f.ruleId}</span>
                      <span className="text-white font-medium">{f.title}</span>
                    </div>
                    <span
                      className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                        f.severity === 'error'
                          ? 'bg-red-500/20 text-red-400 border-red-500/30'
                          : f.severity === 'warning'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-[#0181FB]/15 text-[#7DB4FF] border-[#0181FB]/30'
                      }`}
                    >
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-slate-400">{f.evidence}</p>
                  <p className="text-slate-500">{f.explanation}</p>
                  <p className="text-slate-500">
                    <span className="text-slate-400 font-medium">Recommendation: </span>
                    {f.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Block Height Delta — cross-endpoint discipline takes over when the
            analysis reaches a determinate verdict (available-with-caveat or
            not-comparable); otherwise today's rendering applies unchanged. */}
        {comparison && crossAnalysis && crossAnalysis.blockDelta.status !== 'unavailable' ? (
          <div className="bg-black/25 border border-line rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Block Height Delta
              </span>
              <span className="text-xs text-slate-400">
                Method:{' '}
                <code className="text-slate-200 font-data">
                  {crossAnalysis.blockDelta.methodA === crossAnalysis.blockDelta.methodB
                    ? crossAnalysis.blockDelta.methodA
                    : `A: ${crossAnalysis.blockDelta.methodA} · B: ${crossAnalysis.blockDelta.methodB}`}
                </code>
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-line">
              <div className="text-xs">
                <span className="text-slate-400">Status: </span>
                {crossAnalysis.blockDelta.status === 'not_comparable' ? (
                  <span className="text-red-400 font-medium">
                    Not Comparable (Different Chains: {crossAnalysis.chainIdA} vs {crossAnalysis.chainIdB})
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium">Available (Cross-Endpoint)</span>
                )}
              </div>
              <div className="text-xs">
                <span className="text-slate-400">Delta (B - A): </span>
                {crossAnalysis.blockDelta.status === 'available' && crossAnalysis.blockDelta.delta !== null ? (
                  <span className="text-gradient font-data font-bold text-base">
                    {crossAnalysis.blockDelta.delta.startsWith('-') ? '' : '+'}
                    {crossAnalysis.blockDelta.delta} blocks
                  </span>
                ) : (
                  <span className="text-red-400 font-medium">Not comparable</span>
                )}
              </div>
            </div>
            {(crossAnalysis.blockDelta.a !== null || crossAnalysis.blockDelta.b !== null) && (
              <div className="text-[11px] text-slate-500 flex gap-4 pt-1">
                {crossAnalysis.blockDelta.a !== null && (
                  <span>Snapshot A: <code className="text-slate-400">{crossAnalysis.blockDelta.a}</code></span>
                )}
                {crossAnalysis.blockDelta.b !== null && (
                  <span>Snapshot B: <code className="text-slate-400">{crossAnalysis.blockDelta.b}</code></span>
                )}
              </div>
            )}
            {crossAnalysis.blockDelta.status === 'available' && snapshotA && snapshotB && (
              <p className="text-[11px] text-amber-400/80">
                Cross-endpoint delta: the endpoints may be at different sync points. Snapshot A was taken at{' '}
                {new Date(snapshotA.timestamp).toLocaleTimeString()}, snapshot B at{' '}
                {new Date(snapshotB.timestamp).toLocaleTimeString()}.
              </p>
            )}
          </div>
        ) : comparison && (
          <div className="bg-black/25 border border-line rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Block Height Delta
              </span>
              <span className="text-xs text-slate-400">
                Method: <code className="text-slate-200 font-data">{comparison.blockHeightDelta.method || '—'}</code>
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-line">
              <div className="text-xs">
                <span className="text-slate-400">Status: </span>
                <span
                  className={
                    comparison.blockHeightDelta.status === 'available'
                      ? 'text-emerald-400 font-medium'
                      : 'text-amber-400 font-medium'
                  }
                >
                  {describeBlockHeightStatus(comparison.blockHeightDelta.status)}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-slate-400">Delta (B - A): </span>
                {comparison.blockHeightDelta.status === 'available' && comparison.blockHeightDelta.delta !== null ? (
                  <span className="text-gradient font-data font-bold text-base">
                    {comparison.blockHeightDelta.delta.startsWith('-') ? '' : '+'}
                    {comparison.blockHeightDelta.delta} blocks
                  </span>
                ) : (
                  <span className="text-slate-500 font-mono">Unavailable</span>
                )}
              </div>
            </div>
            {comparison.blockHeightDelta.status === 'available' && (
              <div className="text-[11px] text-slate-500 flex gap-4 pt-1">
                <span>Snapshot A: <code className="text-slate-400">{comparison.blockHeightDelta.a}</code></span>
                <span>Snapshot B: <code className="text-slate-400">{comparison.blockHeightDelta.b}</code></span>
              </div>
            )}
          </div>
        )}

        {/* Checks Diff Table */}
        {comparison && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="text-sm font-semibold text-slate-300">Method Checks Diff</h4>
              <span className="font-data text-[10px] uppercase tracking-[0.18em] text-slate-600">[ Fig. 01 — Method diff ]</span>
            </div>
            <div className="overflow-x-auto border border-line rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 border-b border-line text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Method</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Outcome A → B</th>
                    <th className="p-2.5">Observed Value A → B</th>
                    <th className="p-2.5">Latency Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40 font-mono">
                  {comparison.checks.map((check: ComparedCheck) => {
                    const outcomeChanged = check.a?.outcome !== check.b?.outcome;
                    const valChanged = check.a?.observedValue !== check.b?.observedValue;

                    return (
                      <tr key={check.method} className="hover:bg-slate-900/50">
                        <td className="p-2.5 text-slate-200 font-data font-medium">{check.method}</td>
                        <td className="p-2.5">
                          <CheckStatusBadge status={check.status} />
                        </td>
                        <td className="p-2.5">
                          {check.a && check.b ? (
                            <span className={`inline-flex items-center gap-1.5 ${outcomeChanged ? 'text-amber-400' : 'text-slate-300'}`}>
                              <span>{check.a.outcome}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" aria-label="to" />
                              <span>{check.b.outcome}</span>
                            </span>
                          ) : check.a ? (
                            <span className="text-rose-400">{check.a.outcome} (A only)</span>
                          ) : check.b ? (
                            <span className="text-emerald-400">{check.b.outcome} (B only)</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-2.5">
                          {check.a && check.b ? (
                            <span className={`inline-flex items-center gap-1.5 ${valChanged ? 'text-amber-400' : 'text-slate-300'}`}>
                              <span>{formatValue(check.a.observedValue)}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" aria-label="to" />
                              <span>{formatValue(check.b.observedValue)}</span>
                            </span>
                          ) : check.a ? (
                            <span>{formatValue(check.a.observedValue)}</span>
                          ) : check.b ? (
                            <span>{formatValue(check.b.observedValue)}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-2.5">
                          {check.latencyDelta.status === 'available' && check.latencyDelta.value !== null ? (
                            <span
                              className={
                                check.latencyDelta.value <= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }
                            >
                              {check.latencyDelta.value > 0 ? `+${check.latencyDelta.value}` : check.latencyDelta.value} ms
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[11px]">
                              {check.latencyDelta.status === 'missing_in_a'
                                ? 'Unavailable (missing in A)'
                                : check.latencyDelta.status === 'missing_in_b'
                                ? 'Unavailable (missing in B)'
                                : check.latencyDelta.status === 'missing_in_both'
                                ? 'Unavailable (no latency recorded)'
                                : 'Unavailable'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Diagnostic Findings Diff */}
        {comparison && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-300">Diagnostic Findings Diff</h4>
            {comparison.findings.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No diagnostic findings recorded in either snapshot.</p>
            ) : (
              <div className="space-y-2">
                {comparison.findings.map((f: ComparedFinding) => {
                  const currentFinding = f.b || f.a;
                  return (
                    <div
                      key={f.key}
                      className="bg-slate-900 border border-line rounded p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FindingStatusBadge status={f.status} />
                          <span className="text-slate-400 font-mono text-[11px]">{f.ruleId}</span>
                          <span className="text-white font-medium">{currentFinding?.title}</span>
                        </div>
                        {currentFinding && (
                          <span
                            className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                              currentFinding.severity === 'error'
                                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                : currentFinding.severity === 'warning'
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                : 'bg-[#0181FB]/15 text-[#7DB4FF] border-[#0181FB]/30'
                            }`}
                          >
                            {currentFinding.severity}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400">{currentFinding?.evidence}</p>
                      {f.fieldChanges.length > 0 && (
                        <div className="text-[11px] text-amber-400/90 bg-amber-500/5 p-1.5 rounded mt-1 border border-amber-500/20">
                          <span className="font-semibold">Modified details: </span>
                          {f.fieldChanges.map((fc) => `${fc.field} (${fc.a} → ${fc.b})`).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </Card>
  );
}
