# Findings for the Portaldot team

Neutral, reproducible technical findings from building NodeScope's Fee Lab
against the Portaldot V3 testnet. Every number below comes from one dated,
measured run; nothing here is a permanent property of the chain, and
nothing here claims mainnet behavior (no public mainnet EVM RPC is
published, so no mainnet fee claim is made).

This document is prepared for the Portaldot team. The user submits it (as
a docs issue or PR, see `FINDINGS-FOR-PORTALDOT-ISSUE-DRAFT.md`); nothing
in this repo sends it anywhere on its own.

## How to reproduce every number

- **Fee Lab (browser, no wallet, no signing):** open the live app at
  `/app/fee-lab`, pick an operation, press "Estimate on both surfaces".
  The EVM leg runs `eth_estimateGas` × `eth_gasPrice`; the native leg runs
  a `ReviveApi` dry-run plus `TransactionPaymentApi.query_info` over
  `wss://test-node-v3.portaldot.dev`.
- **CLI (no wallet, no signing):** `node cli/nodescope.mjs fees --artifact
  <solc artifact JSON>` from a repo checkout prices the same deploy on
  both surfaces. See `cli/README.md`.
- **Raw EVM check:** `eth_estimateGas` for the deploy calldata and
  `eth_gasPrice` against `https://test-evm-rpc-v3.portaldot.dev`, chain id
  420420777. The gas figure already includes the storage deposit (see
  finding 1: that inclusion is an inference from the numbers, labeled as
  such, not a statement read in pallet-revive documentation).

## The measured run

26 Oct 2026, ~13:13 UTC, runtime `portaldot-v3` spec 3002, EVM gas price
30045–30050 wei. Values in tPOT (native 14 decimals, EVM 18 decimals).

| Operation | EVM | Native fee (partialFee) | Storage deposit | All-in | Fee-only |
| --- | --- | --- | --- | --- | --- |
| Native tPOT transfer (1 tPOT) | 0.013109 | 0.014905 | 0 | 0.880x (EVM cheaper) | 0.9x |
| ERC-20 transfer, existing holder | 0.019512 | 0.020909 | 0 | 0.933x (EVM cheaper) | 0.9x |
| ERC-20 transfer, new recipient | 3.921035 | 0.021609 | 3.8415 | 1.015x (tie) | 181.5x |
| Deploy SampleToken (1,414 B) | 124.098219 | 0.154411 | 122.037 | 1.016x (tie) | 803.7x |
| Deploy FeeRegistry (1,252 B) | 110.416529 | 0.137909 | 108.582 | 1.016x (tie) | 800.6x |

Re-measured live after the run (27 Oct 2026, 00:26 WIB): deploy
SampleToken again landed at EVM 124.098219 tPOT against native all-in
122.191411 tPOT (fee 0.15441193 + deposit 122.037), 1.016x all-in, 804x
fee-only; native transfer landed at 0.880x all-in. The ratios reproduce;
the absolute values move with gas price and chain state.

## Finding 1 — The EVM gas figure already folds the storage deposit in

For both deploys, the EVM total matches the native fee + deposit within
~1.6% (SampleToken: 124.098 vs 122.191; FeeRegistry: 110.417 vs 108.720
all-in). The natural reading is that `eth_estimateGas` × `eth_gasPrice`
on this runtime already charges for the storage the deploy creates,
while the native path reports the same cost as two numbers: a small
weight fee plus a large deposit.

Status: **inference from the numbers, not documentation.** If the
Portaldot docs stated this explicitly — "on pallet-revive, the EVM gas
estimate includes the storage deposit; the native path reports it
separately" — builders would stop comparing EVM gas against native
partialFee and producing ~800x headlines. Suggested doc line (for the
team to confirm or correct):

> On Portaldot V3, an EVM deploy estimate already includes the storage
> deposit. The native equivalent reports the same cost as partialFee +
> storageDeposit. Compare all-in with all-in.

## Finding 2 — Fee-only vs all-in is where the headline multiple comes from

For the SampleToken deploy, the storage deposit is 122.037 of the
122.191 native all-in total — about 99.9%. Any comparison that divides
EVM gas by native partialFee alone therefore reports ~804x, while the
like-with-like comparison reports 1.016x (a tie within a 2% band). The
same effect, smaller, appears on the new-recipient ERC-20 transfer
(181.5x fee-only vs 1.015x all-in), and disappears entirely on plain
transfers, where there is no new storage and the EVM path is 7–12%
cheaper all-in (0.880x, 0.933x).

Implication for docs and dashboards: any published "EVM vs native"
multiple should name its denominator. A multiple without "fee-only" or
"all-in" attached is not a measurement, it is a headline.

## Finding 3 — A storage deposit is a hold, not a burned fee

The deposit is reserved against the storage a call leaves behind and is
refundable when that storage is freed. It is not burned, and it is not a
fee. Builders comparing surfaces should therefore report three numbers,
not one: native fee, native deposit, and native all-in — which is what
Fee Lab does. A single "native cost" figure hides exactly the component
that dominates deploy pricing.

## Finding 4 — Revive dry-runs need a storage deposit limit above zero

A `ReviveApi.instantiate` (or `call`) dry-run with a zero / None deposit
limit fails. Fee Lab passes an explicit limit (10^22 planck) and reports
the resulting `storageDeposit` separately. If the docs show a dry-run
example, the limit parameter deserves one sentence: it must be greater
than zero, and the deposit it returns is the hold described in finding 3.

## Finding 5 — A silent WSS endpoint needs an explicit connect

With `@polkadot/api`, a `WsProvider` created with autoConnect disabled
never connects on its own: `ApiPromise.create` waits on it forever, so a
healthy-looking endpoint can hang a tool indefinitely. The fix is one
line — call `provider.connect()` explicitly inside a timeout — but it is
easy to miss, because the raw socket opens fine and answers
`chain_getHeader` and `system_health`. Fee Lab hit exactly this (every
native leg timed out live while the raw endpoint was healthy) and fixed
it with an explicit connect inside a 10s timeout, keeping autoConnect
off so there is no reconnect loop. Worth one note in any builder guide
that shows `WsProvider` with autoConnect disabled.

## Finding 6 — Operations without a verified EVM equivalent report as unavailable

Pallet-assets transfer has no verified ERC-20 precompile address on
Portaldot V3, so Fee Lab reports that op's EVM leg as unavailable rather
than zero. If a precompile address is published, that leg becomes
measurable the same way the others are. Until then, "unavailable, not
zero" is the honest display, and any tool that shows zero for it is
inventing a price.

## What is deliberately not claimed here

- No mainnet numbers: no public mainnet EVM RPC is published.
- No permanent ratios: gas price and chain state move; every number
  above is one run, re-measurable live in Fee Lab or via the CLI.
- No second attestation or deployment claim: the on-chain attestation
  story (registry, anchor) is documented separately in `docs/ATTESTATION.md`
  and is not part of these fee findings.
