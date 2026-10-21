# NodeScope P3 — Node Health Monitoring and Failure Diagnosis

## 1. Current Architecture Summary

### Data flow
- **App.tsx** maintains `history: DiagnosticHistoryItem[]` state from sessionStorage via `getDiagnosticHistory()` / `saveDiagnosticHistory()`.
- User triggers RPC calls via **RpcConsole** → `handleRunDiagnostic` in App → `sendJsonRpcRequest()` in `src/services/rpcClient.ts`.
- Each result is saved to history as a `DiagnosticHistoryItem` (extends `RpcDiagnosticResult` + `endpoint`).
- **DiagnosticReport** component renders a summary of findings from history using:
  - `evaluateHistoryFindings()` — endpoint-aware deduplication (key: `${ruleId}:${endpoint}`), preserving latest observation by timestamp.
  - `deduplicateFindings()` — safety-net removal of exact duplicates (same ruleId + evidence).
  - `buildDiagnosticReport()` — exports `DiagnosticReportExport` schema (`nodescope.diagnostic-report.v1`) with `recordCount: history.length` (raw records preserved) and optional `findings[]` (deduplicated).
- **CapabilityDiscoveryPanel** shows method evidence status based on `getMethodEvidenceStatus()` from `src/utils/capabilityEvidence.ts`.
- **NodeMetricsInspector** displays block height, latency, peer count with profile-specific method defaults.

### Key seams (reusable entry points)
- `sendJsonRpcRequest(url, method, params?, timeoutMs?)` — generic JSON-RPC client, returns `RpcDiagnosticResult`.
- `saveDiagnosticHistory(endpoint, result)` — appends item to history, keeps last 50 items in sessionStorage.
- `evaluateHistoryFindings(history, config)` — evaluates all history items, endpoint-aware dedup by `${ruleId}:${endpoint}`.
- `buildDiagnosticReport(history, findings?)` — report export, schema `nodescope.diagnostic-report.v1`.
- `evaluateDiagnosticResult(result, config)` — classifies a single result: network failure → JSON-RPC error → malformed response → block-height → latency.
- `evaluateBlockHeight(result, method)` — produces `block-height-retrieved` finding with embedded block height string.

### Existing diagnostics rules (already wired)
- `network-failure`, `http-error`, `method-unsupported-on-endpoint`, `rpc-error`, `malformed-response`, `invalid-response`, `chain-id-mismatch`, `chain-id-verified`, `block-height-retrieved`, `latency-exceeds-threshold`.

### Report schema (`nodescope.diagnostic-report.v1`)
- `schemaVersion`: fixed string.
- `exportedAt`: ISO timestamp.
- `recordCount`: number of raw `DiagnosticHistoryItem` records (preserved entirely).
- `records`: array of `DiagnosticReportEntry` — one per history item, with outcome, latency, metric status, evidence label, error.
- `findings?`: optional deduplicated `Finding[]`.

## 2. Most Valuable P3 Feature Recommendation

### Explicit, user-triggered health-check snapshots with timestamped comparison

**Why this is the highest-value addition:**
- Leverages all existing infrastructure (RPC client, history, diagnostic rules, report export). No new dependencies.
- Solves the operator's core problem: "Has anything changed since the last time I checked?" — block height moved? Did a method become unsupported? Did latency spike?
- Provides a concrete workflow the user can actually use today: run a health check, snapshot the results, compare later.
- Supports the hackathon constraint of "verification before each milestone commit" — each snapshot is a verifiable data point.
- Backward-compatible: raw history and report schema unchanged; findings are an optional addition to the existing export.

**What it adds:**
1. **Health-check run workflow** — UI button to trigger a full suite of user-triggered checks (chain ID, block height, latency, method support).
2. **Timestamped snapshot** — each run appends a snapshot entry to history (or local state), marked with a run ID and timestamp. Raw records remain unchanged.
3. **Change detection** — compare two snapshots: block height delta, new/vanishing findings, latency trend.
4. **Clear status categories** — reachability, method support, chain identity, synchronization (one-measurement disclaimer preserved).

## 3. Phased Implementation Plan

### Phase 1 — Snapshot workflow (4–6 days)
**User story:** "I can trigger a health-check snapshot and see a summary of all observations."

- Add `healthSnapshot` state to `App.tsx` (array of `{id, timestamp, findings, ruleConfig}`).
- Add "Run Health Check" button to **Overview** or **RpcConsole** that:
  1. Iterates a predefined set of methods: `eth_chainId`, `eth_blockNumber`, `system_health` (generic_http profile), plus the profile-default method.
  2. Calls `sendJsonRpcRequest` for each, collects results.
  3. Runs `evaluateHistoryFindings(history_with_new_results)` to produce deduplicated findings.
  4. Saves a snapshot: `{id: run-${Date.now()}, timestamp: now(), findings, ruleConfig}` into App state (or sessionStorage alongside history).
  5. Re-renders a "Health Snapshots" section showing latest snapshot summary.
- **Acceptance criteria:**
  - Button appears in UI (Overview or RPC Console).
  - Clicking it triggers RPC calls for the expected methods per profile.
  - Findings are deduplicated by endpoint (no duplicate `block-height-retrieved`).
  - Snapshot is stored and displayed as a summary card.
  - Raw history count unchanged (recordCount still reflects all records).

### Phase 2 — Snapshot comparison (2–3 days)
**User story:** "I can compare two snapshots to see what changed."

- Add comparison UI: dropdown/select of stored snapshots, side-by-side diff.
- Display changes:
  - New findings (appeared since last snapshot).
  - Vanished findings (disappeared since last snapshot).
  - Block height delta (if both have `block-height-retrieved`).
  - Latency trend (if both have latency findings).
- **Acceptance criteria:**
  - User can select two snapshots from a list.
  - Diff shows new/vanishing findings with ruleId + evidence.
  - Block height delta displayed when applicable.
  - Latency values shown for trend.

### Phase 3 — Health summary report export enhancements (2 days)
**User story:** "I can export a health snapshot with findings embedded."

- Extend `buildDiagnosticReport` to optionally include a `snapshotId` / `runTimestamp` in the export payload without changing the existing schema version.
- Add a "Export Health Snapshot" button in the snapshots UI that exports just the findings + metadata.
- **Acceptance criteria:**
  - Export includes findings with proper `Finding` schema.
  - Raw record count still reflects full history.
  - Backward-compatible: existing exports unchanged.

## 4. Files Likely to Change

| File | Purpose of change |
|---|---|
| `src/App.tsx` | Add `healthSnapshots` state, "Run Health Check" handler, snapshot storage alongside existing history. |
| `src/components/diagnostics/DiagnosticReport.tsx` | May add a snapshot-export path; currently already correct after P2 fix. |
| `src/services/diagnosticRules.ts` | No changes needed — `evaluateHistoryFindings` already provides endpoint-aware dedup. |
| `src/utils/reportBuilder.ts` | Optional: enhance `buildDiagnosticReport` to include snapshot metadata without breaking schema. |
| `src/components/dashboard/Overview.tsx` | Place for "Run Health Check" button in the metric grid or sidebar. |
| `src/components/diagnostics/RpcConsole.tsx` | Alternative placement for health-check trigger alongside method presets. |
| `src/components/diagnostics/CapabilityDiscoveryPanel.tsx` | May surface evidence status per method as part of snapshot context. |

**No changes to:** `src/services/rpcClient.ts`, `src/services/historyStorage.ts`, `src/types/rpc.ts`, `src/utils/reportBuilder.ts` export schema, `src/utils/urlValidator.ts`, existing test files.

## 5. Risks, Assumptions, and Test Coverage

### Risks
1. **CORS / network failures** — if the endpoint blocks browser requests, the health check may produce many network/error findings. Mitigation: graceful handling, clear labeling.
2. **Stale snapshot comparisons** — if the endpoint changes between snapshots, diffs may reflect intended changes vs. transient errors. Mitigation: label each finding with timestamp and rule.
3. **History bloat** — snapshots stored in App state (not sessionStorage) survive page reload only within the session. Mitigation: optionally persist to sessionStorage with a prefix.
4. **False confidence** — one-block-height measurement does not prove sync. Disclaimer must remain visible in UI and export.

### Assumptions
- The known Portaldot V3 EVM endpoint `https://test-evm-rpc-v3.portaldot.dev` is reachable from the test environment (tests mock `fetch`).
- User has configured a working endpoint before running health checks.
- No automatic polling or background timers — all checks are explicitly user-triggered.

### Test coverage (must preserve / extend)
- Existing: 132 tests pass, including `diagnosticRules.test.ts` (deduplication, history findings), `reportBuilder.test.ts`, `connectionTester.test.ts`.
- New tests needed for P3:
  - Health-check run: verify snapshot is created with correct findings count, deduplication works.
  - Snapshot comparison: verify diff shows new/vanishing findings.
  - Export: verify `buildDiagnosticReport` with snapshot findings includes `findings[]` but recordCount unchanged.
- Run `npm test -- --run`, `npm run lint`, `npm run build` to confirm zero regressions.

## 6. Pre-implementation Confirmation Items

Before coding begins, confirm:

1. **Feature priority** — Does the user want Phase 1 (snapshot workflow) first, or Phase 2 (comparison)?
2. **UI placement** — "Run Health Check" button: Overview grid, RPC Console, or both?
3. **Snapshot persistence** — Store snapshots in App state (lost on page reload) or sessionStorage (survives reload, limited capacity)? Aware of 50-item history limit in `historyStorage.ts`.
4. **Profile scope** — Should health checks run on the currently selected endpoint profile (EVM vs generic_http), or always against the configured endpoint regardless of profile?
5. **Comparison scope** — Compare only the two most recent snapshots, or any pair from stored history?
6. **Export expectations** — Does the user want the diagnostic report export to include findings by default, or only on explicit "Export Health Snapshot" action?

Once these are confirmed, Phase 1 can begin. All existing behavior (history tracking, report export, deduplication) is preserved; only additive UI and state changes are introduced.