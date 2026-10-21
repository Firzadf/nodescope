# Portaldot V3.0 Integration Discovery

# Portaldot V3.0 Integration Discovery

## Milestone 5.2: EVM Connection & Method Compatibility Alignment (2026-10-19)

### Method Compatibility Matrix — EVM Endpoint (`https://test-evm-rpc-v3.portaldot.dev`)

Verification date: **2026-10-19**. Scope: HTTP JSON-RPC POST only (no WebSocket). Transport: Cloudflare edge, `Access-Control-Allow-Origin: *`.

| Method | Endpoint Scope | Status (EVM endpoint) | Evidence |
|---|---|---|---|
| `eth_chainId` | EVM (HTTP) | `live_verified` | Returned `0x190f1ca9` (420420777). Confirmed by project owner and curl probe. |
| `eth_blockNumber` | EVM (HTTP) | `live_verified` | Confirmed working by project owner audit (2026-10-19). |
| `net_version` | EVM (HTTP) | `live_verified` | Confirmed working by project owner audit (2026-10-19). |
| `web3_clientVersion` | EVM (HTTP) | `live_verified` | Confirmed working by project owner audit (2026-10-19). |
| `system_health` | Substrate | `returns_-32601_on_evm_endpoint` | Confirmed returns JSON-RPC error -32601 on EVM endpoint (2026-10-19). Substrate HTTP endpoint only. |
| `system_version` | Substrate | `returns_-32601_on_evm_endpoint` | Confirmed returns JSON-RPC error -32601 on EVM endpoint (2026-10-19). Substrate HTTP endpoint only. |
| `chain_getHeader` | Substrate | `returns_-32601_on_evm_endpoint` | Confirmed returns JSON-RPC error -32601 on EVM endpoint (2026-10-19). Substrate HTTP endpoint only. |
| `chain_getBlock` | Substrate | `unverified_on_evm_endpoint` | Not tested on EVM endpoint. Expected to return -32601 (inferred, not observed). |
| `eth_getBlockByNumber` | EVM (HTTP) | `unverified` | Standard EVM method; not yet tested against this endpoint. |

**Evidence classes:**
- `live_verified` — observed directly via curl or application request, confirmed by project owner.
- `returns_-32601_on_evm_endpoint` — observed JSON-RPC error code -32601 ("Method not found") on the EVM endpoint. These methods are Substrate-only and cannot be used in the `portaldot_v3_evm` connection profile.
- `unverified` / `unverified_on_evm_endpoint` — not tested against this endpoint; do not assume support.

### Application Changes (Milestone 5.2)

1. **Endpoint Profile selector**: Added explicit `portaldot_v3_evm` / `generic_http` radio control in `EndpointConfig`.
   - `portaldot_v3_evm`: tests `eth_chainId` (validates against 420420777) + `eth_blockNumber`. Does **not** call `system_health` (returns -32601 on EVM endpoint).
   - `generic_http`: preserves previous `system_health` behavior for generic Substrate HTTP endpoints.
2. **Chain ID validation wired to UI**: `validatePortaldotV3ChainId()` result shown in endpoint check panel with pass/fail/wrong-chain / RPC error / network error distinction.
3. **Individual check display**: `eth_chainId` and `eth_blockNumber` results shown separately with exact outcome codes.
4. **RPC Console method descriptions updated**: EVM methods labeled `live_verified`; Substrate methods noted as returning -32601 on EVM endpoint; scope boundaries explicit.
5. **Conservative evidence hierarchy preserved**: A matching Chain ID alone does not promote a report entry to `portaldot_v3_testnet_verified`. `reportBuilder.ts` always sets `generic_endpoint_tested` for history items.
6. **`connectionTester.ts` service extracted**: EVM and generic connection logic extracted to `src/services/connectionTester.ts` for testability.

### Limitations (as of 2026-10-19)

- NodeScope implements **HTTP/HTTPS JSON-RPC POST only**. No WebSocket support. No transactions, wallet signing, or contract deployment.
- Substrate WebSocket endpoint (`wss://test-node-v3.portaldot.dev`) is not reachable by this client.
- `portaldot_v3_testnet_verified` evidence label is **not** emitted by `reportBuilder.ts` for individual history items — it remains conservative (`generic_endpoint_tested`). Only connection-level UI state reflects the validated chain ID match.
- A successful `eth_chainId` match proves the endpoint serves that chain identifier; it does not independently verify the full node identity without additional chain-specific proofs.

### Manual Testing Instructions (Milestone 5.2)

1. Navigate to **Overview** section.
2. Enter endpoint: `https://test-evm-rpc-v3.portaldot.dev`
3. Select profile: **Portaldot V3 EVM (HTTP JSON-RPC)** (default).
4. Click **Connect & Test**.
5. The EVM endpoint check panel shows:
   - `eth_chainId`: Pass → `0x190f1ca9` (420420777) or fail with exact error.
   - `eth_blockNumber`: Pass → current block hex or fail with RPC error code.
6. Navigate to **RPC Diagnostics** → select method preset → **Run Diagnostic**.
7. Presets labeled `live_verified` work on the EVM endpoint; presets labeled `returns_-32601_on_evm_endpoint` will fail — expected behavior.

### Regression Tests

See `src/utils/chainIdValidator.test.ts` for:
- Correct Portaldot V3 Chain ID → `isPortaldotV3Testnet: true`
- Wrong Chain ID → mismatch error with observed vs expected values
- Malformed hex response → `Chain ID response is not a valid hex string`
- JSON-RPC error response → RPC error code preserved
- Network failure → transport error message preserved
- Wrong RPC method → `Chain ID verification requires an eth_chainId response`

`App.tsx` connection test on `portaldot_v3_evm` profile calls `eth_chainId` and `eth_blockNumber` — never `system_health`. Generic profile calls `system_health` unchanged.

## Milestone 5.1: Portaldot V3 Endpoint Verification (2026-10-19)

### Team-Provided Endpoint Configuration

Source: Portaldot Hacker House team update.

| Item | Configuration | Status |
|---|---|---|
| Substrate WebSocket RPC | `wss://test-node-v3.portaldot.dev` | `team_provided` / `unverified_in_app` |
| EVM JSON-RPC HTTP | `https://test-evm-rpc-v3.portaldot.dev` | `team_provided` / `live_verified` |
| EVM Chain ID | `420420777` (`0x190f1ca9`) | `team_provided` / `live_verified` |
| Explorer | `https://node-console.portaldot.dev/` | `team_provided` |

### Live Verification Results

**EVM HTTP Endpoint (`https://test-evm-rpc-v3.portaldot.dev`)**:
- **Connection Test**: `live_verified` via curl probe on 2026-10-19.
- **CORS Policy**: `access-control-allow-origin: *` confirmed. Browser `fetch()` requests are permitted.
- **Transport**: HTTP/HTTPS JSON-RPC POST confirmed functional. NodeScope client is compatible.
- **Chain ID Verification**: `eth_chainId` method returned `0x190f1ca9` (decimal `420420777`), exact match with team-provided configuration.
- **Server**: Cloudflare edge, HTTP 200 OK responses.

**Substrate WebSocket Endpoint (`wss://test-node-v3.portaldot.dev`)**:
- **Status**: `unverified_in_app`. NodeScope client does not support WebSocket transport. Implementation deferred.

### Confirmed Supported RPC Methods (EVM Endpoint)

| Method | Status | Evidence |
|---|---|---|
| `eth_chainId` | `live_verified` | Curl probe returned `0x190f1ca9` matching team configuration. |
| `eth_blockNumber` | `pending_verification` | Method available but not yet tested in NodeScope UI. |
| `eth_getBlockByNumber` | `pending_verification` | Standard EVM method, not yet tested. |
| `net_version` | `pending_verification` | Standard EVM method, not yet tested. |
| `web3_clientVersion` | `pending_verification` | Standard EVM method, not yet tested. |
| `system_health` | `pending_verification` | Substrate method, compatibility with EVM endpoint unconfirmed. |
| `system_version` | `pending_verification` | Substrate method, compatibility with EVM endpoint unconfirmed. |
| `chain_getHeader` | `pending_verification` | Substrate method, compatibility with EVM endpoint unconfirmed. |

### Application Changes (Minimal)

1. **RPC Console Preset**: Added "Portaldot V3 EVM Chain ID" (`eth_chainId`) as first preset option.
2. **Endpoint Placeholder**: Updated placeholder to `https://test-evm-rpc-v3.portaldot.dev`.
3. **Default Method**: RPC Console now defaults to `eth_chainId` instead of `system_health`.

No automatic background requests. All diagnostics remain user-triggered.

### Manual Testing Instructions

Users can verify Portaldot V3 EVM endpoint without code changes:

1. Navigate to **Overview** section.
2. Enter endpoint: `https://test-evm-rpc-v3.portaldot.dev`
3. Click **Connect & Test**.
4. Navigate to **RPC Diagnostics** section.
5. Select preset **Portaldot V3 EVM Chain ID** (`eth_chainId`).
6. Click **Run Diagnostic**.
7. Verify response `result` field contains `0x190f1ca9` (Chain ID 420420777).

Alternative: Use **Node Metrics Inspector** with `eth_blockNumber` for block height verification.

### Known Limitations

- **Substrate WebSocket**: Not supported. Requires separate transport implementation.
- **Substrate/EVM Method Compatibility**: The EVM endpoint may not support Substrate-specific methods (`system_health`, `system_version`, `chain_getHeader`). Testing required to confirm which methods return `-32601` (method not found).
- **No Wallet Integration**: NodeScope does not send transactions, request signatures, or handle private keys.
- **Evidence Label**: Successful generic requests to the EVM endpoint are labeled `generic_endpoint_tested`. Elevation to `portaldot_v3_testnet_verified` requires explicit Chain ID match validation (not yet implemented in report logic).

### Recommended Next Actions

1. **Test EVM Methods**: Manually verify `eth_blockNumber`, `net_version`, `web3_clientVersion` via RPC Console.
2. **Test Substrate Methods**: Determine whether EVM endpoint supports Substrate methods or returns `-32601`.
3. **Implement Chain ID Validation**: Add explicit `eth_chainId` verification step that compares response against `420420777` and elevates evidence label to `portaldot_v3_testnet_verified` only on exact match.
4. **WebSocket Transport** (Future): Implement WebSocket client for Substrate endpoint `wss://test-node-v3.portaldot.dev`.

## Evidence labels

- **Documented locally**: present in project files; not independently authenticated against Portaldot's current docs.
- **Documented externally**: verified in an accessible official Portaldot source.
- **Locally tested**: exercised against a running local Portaldot node.
- **Live testnet verified**: exercised against an authenticated Portaldot V3.0 testnet endpoint.
- **Unconfirmed**: no accessible authoritative evidence yet.

No local-node or live-testnet tests have been performed. No Portaldot endpoint has been queried.

## Milestone 3.3 discovery

### Sources inspected

| Source | Evidence/status |
|---|---|
| `D:\Hackathon\rules_ketentuan_hackathon_portaldot.txt` | **Documented locally**. Relevant quotes below. |
| `D:\Hackathon\nodescope\README.md` | **Documented locally**. Says V3.0 endpoint integration is pending official verification. Its feature/status sections are stale relative to the current application; do not use them as evidence of network behavior. |
| `src/services/rpcClient.ts` | Inspected locally for transport behavior. |
| `https://github.com/portaldotVolunteer/Portaldot` | **Unconfirmed**. Web access unavailable in this session; repository contents/releases not inspected. |
| `https://portaldot-dev.readthedocs.io/en/latest/chain-info.html` | **Unconfirmed**. Web access unavailable in this session; page contents not inspected. |
| `https://portaldot-dev.readthedocs.io/en/latest/getting-started/local_test.html` | **Unconfirmed**. Web access unavailable in this session; setup instructions and Windows compatibility not inspected. |
| `https://portaldot-dev.readthedocs.io/en/latest/module-interface/rpc/chain.html` | **Unconfirmed**. Web access unavailable in this session; RPC method documentation not inspected. |

External fetch attempts were blocked by the environment's tool-availability classifier. No terminal network access was attempted. The supplied URLs are recorded as leads, not as verified evidence.

### Transport and local-node compatibility

- **Documented locally (source inspection)**: `src/services/rpcClient.ts:44-52` sends JSON-RPC using browser `fetch()` with HTTP `POST`, JSON content type, and an `AbortController` signal. `src/utils/urlValidator.ts` accepts only `http:` and `https:`. No WebSocket implementation was found under `src/`.
- **Impact**: Current client can communicate only with a local node that exposes an HTTP/HTTPS JSON-RPC endpoint and allows the browser request (including required CORS policy). It cannot communicate with a WebSocket-only endpoint. A local HTTP node is not established by the available evidence.
- **Local-node feasibility**: **Unconfirmed**. The official local-test page could not be read, so required toolchain, build procedure, node flags, ports, transport, and Windows/WSL support cannot be stated. Do not install a toolchain or download a binary based only on this discovery.
- **Safest conditional approach**: First get the Portaldot team to confirm a source repository/tag and documented local build steps, including supported Windows/WSL environment and HTTP JSON-RPC configuration. Prefer building from that verified source using its documented steps over an unverified prebuilt binary. Run isolated local node only after confirming resource/security requirements; configure a loopback HTTP endpoint and verify CORS/transport locally. No such build or connection has occurred.

### RPC methods

- **Documented externally**: None verified in this session. The requested RPC chain documentation was inaccessible.
- **Implemented in NodeScope, not confirmed against Portaldot**: `system_health`, `system_version`, `chain_getHeader`, `chain_getBlock`, and `eth_blockNumber` appear in the app's user-triggered diagnostic options/logic. Their inclusion is not evidence that any Portaldot node supports them.
- **Test status**: Existing unit tests mock JSON-RPC responses. They test client/parser behavior only; they do not test method support or response behavior against a running node.
- **V3.0 status**: No RPC method is **locally tested** or **live testnet verified**.

### Hackathon requirements

Source: `D:\Hackathon\rules_ketentuan_hackathon_portaldot.txt`.

- **Documented locally, lines 15-16**: Track 3 is “Node Operations & Tooling” and includes node monitoring, node data visualization, and network security analysis tools.
- **Documented locally, line 61**: “Projects must effectively leverage Portaldot Network V3.0 core features and complete deployment on the Portaldot testnet.”
- **Documented locally, lines 74-77, 110-117**: Submission materials request Portaldot testnet deployment information and require the demo to show Portaldot integration or usage.
- **Conclusion**: The stored rules do not state that local-node testing substitutes for testnet deployment. Treat local testing as development evidence only; it does not satisfy the written testnet requirement.

## Discovery matrix

| Item | Status | Evidence / practical impact |
|---|---|---|
| Portaldot V3.0 official repository or release | **Unconfirmed** | Supplied GitHub URL was not accessible in this session. Need confirm ownership, active repo, release/tag, and V3.0 commit/tag with Portaldot team. |
| Official testnet RPC endpoint and transport | **Unconfirmed** | No endpoint or transport appears in the inspected rules/README. No endpoint requests sent. |
| Chain ID, genesis hash, authoritative network identifier | **Unconfirmed** | Not in the inspected local rules; docs inaccessible. Need official identifier to distinguish correct network. |
| Supported RPC methods | **Unconfirmed** | Application presets are not confirmation. Obtain official method docs, then verify responses against a node. |
| Browser CORS policy | **Unconfirmed** | Needed for direct browser `fetch()` to work. If unavailable, a separately reviewed local proxy may be needed; none is configured here. |
| Local development node build/run procedure | **Unconfirmed** | Local-test docs inaccessible; Windows and WSL support cannot be established. No software installed or binaries downloaded. |
| Hackathon requires testnet deployment | **Documented locally** | Stored rules explicitly require Portaldot testnet deployment. Local testing alone is not an evidenced substitute. |
| Current NodeScope transport | **Documented locally** | HTTP/HTTPS JSON-RPC POST only; no WebSocket support. |

## Questions for Portaldot team

1. Is `https://github.com/portaldotVolunteer/Portaldot` the authoritative V3.0 source? Which release/tag or commit corresponds to V3.0?
2. What is the official testnet RPC URL and supported transport(s) (HTTP, WebSocket, or both)?
3. What authoritative network identifiers are available (Chain ID, genesis hash, or another identifier)?
4. Which exact RPC methods are enabled on the public testnet endpoint, including parameter and result schemas?
5. Does the endpoint permit browser-origin CORS requests? Which origins/headers/methods are allowed?
6. What is the supported local-node build environment on Windows or WSL, and what verified source/tag and documented command should be used?
7. Does the event accept a local node for any requirement, or is local-node evidence strictly supplementary to testnet deployment?

## Safe verification checklist

- [ ] Obtain endpoint and supported transport from official Portaldot documentation/team before connecting.
- [ ] Verify the endpoint's network identity against an authoritative identifier; do not infer identity from a successful generic JSON-RPC response.
- [ ] Confirm supported RPC methods and schemas from official docs before interpreting metrics.
- [ ] For local testing, use only source/tag and build procedure confirmed by Portaldot; avoid unverified binaries.
- [ ] Confirm browser CORS behavior before testing from NodeScope; current client requires HTTP/HTTPS and does not support WebSocket.
- [ ] Keep testnet and local results labeled separately; retain request/response evidence with secrets and sensitive endpoint credentials redacted.
- [ ] Do not submit local-node results as proof of testnet deployment unless organizers explicitly confirm this is acceptable.
- [ ] Never enter private keys, seed phrases, or credentials in NodeScope.

## Current conclusion and next step

**Live integration feasibility**: Not currently established. There is no verified endpoint or method list, and external docs could not be accessed in this session.

**Local-node feasibility**: Indeterminate until the official local-test instructions can be inspected. Current NodeScope transport would work only if the node exposes browser-accessible HTTP/HTTPS JSON-RPC with suitable CORS; WebSocket-only nodes are unsupported.

**Recommended next step**: Ask Portaldot through its official Discord (`https://discord.gg/portaldot`) to verify the source/tag, local build requirements, endpoint/transport, network identifier, RPC methods, CORS, and the testnet deployment requirement. Then inspect the supplied official docs or provide their contents locally. Do not change app transport or install a toolchain until these facts are confirmed.

## Milestone 5: Portaldot Integration Verification & Findings

### Findings Classification

| Item | Classification | Source / Reference | Details & Impact |
|---|---|---|---|
| Official V3.0 testnet RPC endpoint | `unconfirmed` | Project inspection & docs | No public testnet URL or specification found in project files or accessible docs. |
| Chain ID & network identification | `unconfirmed` | Project inspection & docs | No authoritative Chain ID or genesis hash documented. |
| Supported JSON-RPC methods | `unconfirmed` | `src/types/rpc.ts`, `src/utils/metricParsers.ts` | Preset methods (`system_version`, `system_health`, `chain_getHeader`, etc.) are generic Substrate/EVM standards; unverified against Portaldot V3.0 specs. |
| HTTP vs WebSocket transport | `repository_verified` (Client) / `unconfirmed` (Node) | `src/services/rpcClient.ts` | NodeScope client uses HTTP/HTTPS `POST` via browser `fetch()`. WebSocket transport is unsupported. Node-side support unverified. |
| CORS requirements | `repository_verified` (Client) / `unconfirmed` (Node) | `src/services/rpcClient.ts` | Browser `fetch()` requires the RPC endpoint to permit cross-origin requests (`Access-Control-Allow-Origin`) or use a CORS proxy. Node-side headers unconfirmed. |
| Local node build/run instructions | `unconfirmed` | Project inspection & docs | Official setup documentation inaccessible via web in this environment. |

### Recommended Next Action & Team Outreach Template

Since official testnet endpoint details and method specifications remain `unconfirmed`, live integration is blocked pending direct confirmation from the Portaldot team.

**Outreach Message for Portaldot Team (Discord / Support):**
> Hello Portaldot Team! We are building **NodeScope** (a developer diagnostic and node operations dashboard) for the Portaldot Hacker House 2026 (Track 3). To complete our Portaldot testnet deployment and verify node connectivity, we kindly request the following details:
> 1. What is the official Portaldot V3.0 public testnet JSON-RPC endpoint URL?
> 2. What transport protocols are supported (HTTP, WebSocket, or both)? If HTTP, are browser CORS requests permitted?
> 3. What is the official Chain ID or network identifier?
> 4. Which core JSON-RPC methods are enabled on the testnet node (e.g. Substrate/EVM specs)?
> Thank you!

## Milestone 4: Diagnostic Report & Evidence Export

- **Schema Version**: `nodescope.diagnostic-report.v1` (`src/utils/reportBuilder.ts`)
- **Endpoint Sanitization**: `sanitizeEndpointOrigin()` strips credentials (`user:pass`), query strings (`?token=secret`), and URL fragments (`#frag`), keeping only the protocol and origin (`https://example.com:443`).
- **Evidence Labeling**: Explicit schema labels distinguish real user-triggered requests (`generic_endpoint_tested`, `portaldot_local_node_verified`, `portaldot_v3_testnet_verified`) from simulated mock data (`demo_mock`). No mock records are ever included in real exports.
- **Native Browser Export**: Generates standards-compliant JSON files via `Blob` and temporary object URLs (`URL.createObjectURL`), triggering automated downloads.
- **Unverified Status**: No live Portaldot testnet endpoint or local Portaldot node has been connected or verified. All diagnostic reports generated so far represent local test fixtures or generic endpoint tests only.

## Earlier project notes (not network verification)

NodeScope has generic JSON-RPC request handling, URL validation, manual metric controls, and mock-based unit tests. These demonstrate application behavior under test fixtures; they do not prove Portaldot RPC compatibility. All real-node and testnet results remain unverified.
