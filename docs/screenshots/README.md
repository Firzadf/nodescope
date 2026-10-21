# NodeScope Screenshots

This directory will contain representative screenshots for the check-in and final submission materials.

## TODO: Screenshots to Capture

1. **Endpoint Configuration & Connection Status** (`docs/screenshots/01-endpoint-config.png`)
   - Show: endpoint input field (`https://test-evm-rpc-v3.portaldot.dev`), profile selector (`portaldot_v3_evm`), connection status badge
   - Purpose: demonstrate Portaldot V3.0 integration setup

2. **Health Check Results** (`docs/screenshots/02-health-check-results.png`)
   - Show: HealthCheckPanel with "Run Health Check" button, individual check results (eth_chainId, eth_blockNumber, web3_clientVersion, net_version), observed values and latency, findings list
   - Purpose: demonstrate Phase 1 — health check snapshots in action

3. **Snapshot Comparison UI** (`docs/screenshots/03-snapshot-comparison.png`)
   - Show: snapshot A/B selector showing two recent snapshots, compatibility info, check differences table (method, status, outcome change), block height delta display
   - Purpose: demonstrate Phase 2 — before/after comparison

4. **Findings Categorization** (`docs/screenshots/04-findings-categorized.png`)
   - Show: snapshot comparison findings section with new_finding, resolved_finding, unchanged_finding groups, severity badges (error/warning/info), ruleId, title, evidence
   - Purpose: highlight diagnostic insights from comparison

5. **Diagnostic Report Export** (`docs/screenshots/05-report-export.png`)
   - Show: DiagnosticReport component with "Export to JSON" button, export dialog or file download confirmation
   - Purpose: demonstrate data export capability

## Capture Instructions

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:5173`
3. Set endpoint: `https://test-evm-rpc-v3.portaldot.dev`
4. Select profile: `portaldot_v3_evm`
5. Click "Connect & Test"
6. Run health check 2–3 times to create snapshots
7. Navigate to Snapshot Comparison and select two snapshots
8. Take screenshots for each scenario above

## File Naming Convention

- `01-endpoint-config.png` — 1024×768 or higher
- `02-health-check-results.png`
- `03-snapshot-comparison.png`
- `04-findings-categorized.png`
- `05-report-export.png`

All screenshots should be in PNG or WebP format, max 2MB each.

## Usage in Documentation

Link screenshots from README.md as:

```markdown
![Endpoint Configuration](docs/screenshots/01-endpoint-config.png)
![Health Check Results](docs/screenshots/02-health-check-results.png)
```

Or include in GitHub PR and submission materials.

---

**Status:** Placeholder directory for check-in and final submission  
**Target Deadline:** Before Nov 6 final submission
