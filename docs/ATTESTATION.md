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

Record the deployed address in `deployments/portaldot-v3.json`. The app's
attestation panel reads its default registry from that file. Do not
invent an address or a transaction hash to fill that state.

## Deployed (27 Oct 2026, Portaldot V3 testnet)

- Registry contract (ownerless): `0xd48da7eff3264bdd51a86b873da9ff6997aae99c`
- Deploy transaction: `0x1c2a055523a4cf8b73d771df4d3c54d21392a85f86a14a4d68213bf6db5f4904`
  (block 216268 / 0x34ccc, receipt status 0x1, deployer
  `0xaD62d0aA606240e2C5156e04C82e61C81044959f`)
- Deployment record: `deployments/portaldot-v3.json`
- Anchors on this registry, all receipt status 0x1, all `isAnchored` true:
  - Diagnostic report, 6 records, exported 2026-10-27T10:18:05Z: hash
    `0x08ac72ad0f7a818bc18a8624232811fc4f994cf065bbd2cad1eea4b0bb002df4`,
    tx `0xba35df8e2f182d75885b75b75f0dd97340f4ce64333840d1cf06a252441e9476`,
    block 216341
  - Fee Lab fee report (deploy), exported 2026-10-27T10:18:57Z: hash
    `0x246d6d43b308b8801109910bb52d8ad8d264376e7c8557255b3704176ada0464`,
    tx `0x0c08335507cfb2a0df4b0236543607aed04527ec26361e6e0022c9100c88f2c9`,
    block 216343
  - Diagnostic report, 12 records with session trends, exported
    2026-10-27T10:20:20Z: hash
    `0x528f38d58920b2c7fef730c27e95200e429a126874746e8cead5c1146c768a5b`,
    tx `0xc74a08f3835b0c5b7d813ab15597488affa1987bce79a88d843dfdc31a9ec913`,
    block 216346
- Earlier anchor (25 Oct 2026, supplement, previous registry
  `0x74c88d3090aD6915BFDc373eD6F037e2da4557Ce`): tx
  `0xa7cd3cbd060335d851494c1f48e15124ec8d32ccfa3fe03413c85cf895625448`
  (block 179228), hash
  `0x0bc787de4c634a55699e92d90b7280fffebdbcd557c4312044134e4df9dfa286`
- Every claim above is re-verifiable from `docs/EVIDENCE.md`. Run
  `npm run verify:evidence` for the automated version of the same checks.

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
