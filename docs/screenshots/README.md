# NodeScope Screenshots

Representative screenshots captured from the live application for the check-in submission.

## Captured Screenshots

### 1. Endpoint Configuration (`01-endpoint-config.png`)
Shows the RPC Endpoint Configuration panel with the default `https://test-evm-rpc-v3.portaldot.dev` endpoint, `portaldot_v3_evm` profile selected, and the "Connect & Test" button enabled on initial load without typing.

### 2. Health Check Results (`02-health-check-results.png`)
Shows the Health Check Panel after a completed run: checks for `eth_chainId`, `eth_blockNumber`, `web3_clientVersion`, and `net_version` with observed values, latencies, and derived diagnostic findings with severity badges.

### 3. Snapshot Comparison (`03-snapshot-comparison.png`)
Shows the before/after Snapshot Comparison UI with Snapshot A (baseline) and Snapshot B (current) selected, like-for-like compatibility badge, check differences table with latency delta, and the block height delta (+12 blocks) derived from `eth_blockNumber`.

### 4. Findings Categorized (`04-findings-categorized.png`)
Shows snapshot comparison findings categorized into new, resolved, and unchanged groups, with rule IDs, severity indicators, and evidence strings.

### 5. Report Export (`05-report-export.png`)
Shows the Diagnostic Report component with the JSON export payload (`nodescope.diagnostic-report.v1` schema) and the "Export to JSON" action.

---

**Status:** Complete — all 5 screenshots captured on 2026-10-22 and committed to repository.
