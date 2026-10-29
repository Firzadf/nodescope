# Changelog

## Unreleased

### Added

- `/status` shows the live Portaldot V3 testnet verdict, Health Score v2, heads, finality lag, peers, and latency. One check on open, plus Refresh. The badge embed is on the same page.
- Score history chart on Overview, from the session's health checks. Stalls and degrade/recover/stall/resume marks are drawn on the line. New exports can include `scoreHistory`. Older reports still verify.
- Multi-node view at `/app/nodes`: the published EVM RPC and WebSocket plus endpoints you add, sortable, with the lowest head marked behind. Check all, or Watch at the same 30 second floor.

## 2026-10-28

### Added

- Health Score `nodescope.health-score.v2`. Weights: RPC availability 20, chain identity 10, head progression 15, finality lag 15, latency 10, WSS transport 10, peers and sync 10, RPC reliability 10. New reports, the diagnostic UI, Watch, the CLI, and the status badge use v2.
- `nodescope.health-score.v1` is unchanged (30 / 15 / 20 / 20 / 15). `computeHealthScore` still reproduces it, so older reports verify and recompute.
- STALLED verdict: the RPC answered and the best head and/or the finalized head has not advanced (best-block timestamp ≥ 90s, finalized timestamp ≥ 180s, or two samples ≥ 30s apart at the same height). DOWN stays "nothing answered". Watch and the CLI send stall and resume webhooks.
- Substrate probe now reads `chain_getFinalizedHead`, the finalized header, and `system_syncState`. Finality lag is best minus finalized on that socket. Zero peers and a large sync gap become findings.
- Reliability probe: repeated `eth_blockNumber` (error ratio, HTTP 5xx, p50/p95), one old block for historical-versus-pruned state, and `rpc_methods` flags for unsafe operator methods. Those methods are never called. Names are withheld for the published Portaldot testnet hosts pending disclosure. Other endpoints show the full list.
- Units and address panel: native decimals from `system_properties` against the EVM default of 18, and an H160 ↔ AccountId32 helper matching pallet-revive `AccountId32Mapper` (H160 followed by twelve `0xEE` bytes; other accounts use `keccak256`). Optional `ReviveApi` confirmation via `state_call`.
- CLI `--format prometheus`, `--metrics-file`, `--wss`, and `--reliability`. Grafana can read the textfile collector output.
- Shareable status badge at `/api/badge?target=portaldot-v3-testnet` and `/badge.svg`. Read-only, short cache, published testnet hosts only, no secrets.

### Changed

- The pre-deploy Action treats `stalled` as not healthy, same as `degraded` and `down`.
