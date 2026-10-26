<!--
DRAFT ONLY — do not send from this repo. The user submits this text by
hand as a Portaldot docs issue (or adapts it into a docs PR). The full
findings document lives at docs/FINDINGS-FOR-PORTALDOT.md in the NodeScope
repo; this draft is the short, submittable form of the same content.
-->

## Title

Docs: state that EVM gas estimates already include the storage deposit,
and that native costs split into partialFee + storageDeposit

## Summary

While building a fee-comparison tool (NodeScope Fee Lab) against the
Portaldot V3 testnet, we measured the same operations on both surfaces
and found that the headline "~800x cheaper" multiple comes from comparing
unlike denominators. The EVM gas figure already folds the storage deposit
in; the native path reports the same cost as a small weight fee plus a
large deposit. One doc paragraph stating this explicitly would prevent a
whole class of misleading comparisons.

## Measured evidence (testnet, 26 Oct 2026 ~13:13 UTC, spec 3002)

| Operation | EVM | Native fee | Storage deposit | All-in | Fee-only |
| --- | --- | --- | --- | --- | --- |
| Deploy SampleToken (1,414 B) | 124.098219 tPOT | 0.154411 tPOT | 122.037 tPOT | 1.016x (tie) | 803.7x |
| Deploy FeeRegistry (1,252 B) | 110.416529 tPOT | 0.137909 tPOT | 108.582 tPOT | 1.016x (tie) | 800.6x |
| Native transfer (1 tPOT) | 0.013109 tPOT | 0.014905 tPOT | 0 | 0.880x (EVM cheaper) | 0.9x |

Reproduced live in Fee Lab and via a no-signing CLI (`eth_estimateGas` x
`eth_gasPrice` on the EVM side; `ReviveApi` dry-run + `paymentInfo` on
the native side). Full method, reproduction steps, and six findings are
in the NodeScope repo at `docs/FINDINGS-FOR-PORTALDOT.md`.

## Suggested doc addition (for the team to confirm or correct)

> On Portaldot V3, an EVM deploy estimate already includes the storage
> deposit. The native equivalent reports the same cost as partialFee +
> storageDeposit. Compare all-in with all-in. A storage deposit is a
> refundable hold, not a burned fee.

## Smaller notes (same document, for the team to take or leave)

- Revive dry-runs need a storage deposit limit above zero; a zero / None
  limit fails.
- With `@polkadot/api`, a `WsProvider` created with autoConnect disabled
  never connects on its own — `provider.connect()` must be called
  explicitly (inside a timeout), or tools hang on a healthy endpoint.
- Pallet-assets transfer has no verified ERC-20 precompile address, so
  its EVM leg is honestly "unavailable", not zero.

## What this is not claiming

- No mainnet numbers (no public mainnet EVM RPC is published).
- No permanent ratios: gas price and chain state move; the numbers above
  are one dated run, re-measurable live.
- The EVM-gas-includes-deposit reading is an inference from the numbers
  (EVM total matching native fee + deposit within ~1.6%), not a statement
  read in pallet-revive documentation — which is exactly why it belongs
  in the docs, confirmed or corrected by the team.
