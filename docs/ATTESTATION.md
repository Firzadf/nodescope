# On-chain attestation (optional)

NodeScope is read-only by default. Anchoring is an optional extra step that
adds one on-chain fact: a report with a given SHA-256 hash existed at a given
block. It does not prove the node data inside the report was true, and it is
never required to verify a report off chain at /verify.

## What is anchored

Exactly one value: the report's SHA-256 integrity hash, already present in
every exported report under `integrity.hash`. Nothing else from the report is
put on chain. The registry contract also records, as call arguments, the
endpoint origin, the chain ID, and the block number at anchor time, and emits
them in an `Attested` event.

## The contract

`contracts/NodeScopeAttestation.sol` is minimal and ownerless: no owner, no
upgrade, no fees, no token. `anchor` stores a hash once and emits `Attested`;
a second anchor of the same hash reverts. `isAnchored` is a read-only check.

## Deploy (manual, testnet only)

NodeScope never deploys the contract itself, because deployment needs a
wallet and testnet funds, and NodeScope never holds either. Deploy with your
own throwaway testnet wallet, on the Portaldot V3 EVM testnet only
(chain 420420777, RPC `https://test-evm-rpc-v3.portaldot.dev`), using Foundry,
Remix, or any tool you trust:

```bash
# Foundry example. Use a testnet-only account. Never use a mainnet key here.
forge create contracts/NodeScopeAttestation.sol:NodeScopeAttestation \
  --rpc-url https://test-evm-rpc-v3.portaldot.dev \
  --account <your-testnet-account>
```

Record the deployed address. Until a contract is deployed, the attestation
panel in History honestly reports that there is nothing to verify. Do not
invent an address or a transaction hash to fill that state.

## Anchor a report (manual)

1. Export a report from History. Note its `integrity.hash`.
2. Anchor it with your own wallet tool. With cast:

```bash
cast send <deployed-contract-address> \
  "anchor(bytes32,string,uint256,uint256)" \
  <report-hash> "<endpoint-origin>" 420420777 <block-number-at-anchor> \
  --rpc-url https://test-evm-rpc-v3.portaldot.dev \
  --account <your-testnet-account>
```

The app's attestation panel builds this exact command for you from the hash
and contract address you enter. It never runs the command and never sees a
key.

## Verify an anchor (in the app, read-only)

In History, panel 04, enter the registry contract address, the report hash,
and the anchoring transaction hash, then press Verify anchor on chain. The
panel fetches the transaction receipt and checks, in order:

1. A receipt exists for the transaction hash.
2. The receipt status is `0x1` (succeeded).
3. The receipt's `to` is the registry contract address.
4. At least one log from that contract carries the report hash as its first
   indexed topic (topics[1]).

Only if all four hold does it report ANCHORED, with the receipt's block
number. Any other outcome reports the exact reason it failed. The check is
read-only and needs no wallet.

## What this does not do

- It does not move the report on chain. Only its hash is anchored.
- It does not prove the node answered anything. The report's records do that.
- It does not make a report unalterable off chain. Altering the file still
  breaks its SHA-256 stamp at /verify, whether or not the original hash was
  anchored.
- It is not a score, a grade, or a reputation system. One hash, one anchor,
  one block.
