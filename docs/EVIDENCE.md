# Evidence: deployment and anchors (Portaldot V3 testnet)

Every claim on this page is re-verifiable with the command next to it.
No claim here needs trust in this document: run the command, compare the
output with the expected value.

- Chain: Portaldot V3 testnet, chain ID 420420777
- RPC for all commands: `https://test-evm-rpc-v3.portaldot.dev`
- Registry (current): `0xd48da7eff3264bdd51a86b873da9ff6997aae99c`
- Deployment record: `deployments/portaldot-v3.json`
- tPOT is a testnet token with no market value (about $0). No USD price
  is claimed for any tPOT figure on this page.

## 1. Registry deployed

Claim: `NodeScopeAttestation` (ownerless, `contracts/NodeScopeAttestation.sol`)
is deployed at `0xd48da7eff3264bdd51a86b873da9ff6997aae99c`, deployed 27 Oct
2026 by `0xaD62d0aA606240e2C5156e04C82e61C81044959f`.

```bash
cast code 0xd48da7eff3264bdd51a86b873da9ff6997aae99c --rpc-url https://test-evm-rpc-v3.portaldot.dev
# expected: non-empty 0x6080... runtime bytecode (not 0x)

cast receipt 0x1c2a055523a4cf8b73d771df4d3c54d21392a85f86a14a4d68213bf6db5f4904 --rpc-url https://test-evm-rpc-v3.portaldot.dev --json
# expected: status 0x1, blockNumber 0x34ccc (216268),
#   contractAddress 0xd48da7eff3264bdd51a86b873da9ff6997aae99c,
#   from 0xad62d0aa606240e2c5156e04c82e61c81044959f
```

## 2. Anchor 1: diagnostic report, 6 records

Claim: the diagnostic report exported 2026-10-27T10:18:05Z (6 EVM method
records, all success, chain ID 420420777 verified, blocks 216293-216294,
plus a Substrate WSS probe with status ok) has its SHA-256 anchored at
block 216341.

- Report hash: `0x08ac72ad0f7a818bc18a8624232811fc4f994cf065bbd2cad1eea4b0bb002df4`
- Anchor tx: `0xba35df8e2f182d75885b75b75f0dd97340f4ce64333840d1cf06a252441e9476`
- Report file (committed, byte-identical): `evidence/reports/diagnostic-2026-10-27-1.json`, also served at `/evidence/reports/diagnostic-2026-10-27-1.json`

```bash
cast call 0xd48da7eff3264bdd51a86b873da9ff6997aae99c "isAnchored(bytes32)(bool)" 0x08ac72ad0f7a818bc18a8624232811fc4f994cf065bbd2cad1eea4b0bb002df4 --rpc-url https://test-evm-rpc-v3.portaldot.dev
# expected: true

cast receipt 0xba35df8e2f182d75885b75b75f0dd97340f4ce64333840d1cf06a252441e9476 --rpc-url https://test-evm-rpc-v3.portaldot.dev --json
# expected: status 0x1, blockNumber 0x34d15 (216341), to 0xd48da7eff3264bdd51a86b873da9ff6997aae99c,
#   one log with address 0xd48da7eff3264bdd51a86b873da9ff6997aae99c and
#   topics[1] 0x08ac72ad0f7a818bc18a8624232811fc4f994cf065bbd2cad1eea4b0bb002df4
```

Verify link: https://nodescope.vercel.app/verify?hash=0x08ac72ad0f7a818bc18a8624232811fc4f994cf065bbd2cad1eea4b0bb002df4&contract=0xd48da7eff3264bdd51a86b873da9ff6997aae99c&tx=0xba35df8e2f182d75885b75b75f0dd97340f4ce64333840d1cf06a252441e9476

## 3. Anchor 2: Fee Lab fee report (deploy)

Claim: the Fee Lab fee report exported 2026-10-27T10:18:57Z (deploy
operation, EVM 124.098219 tPOT, native all-in 122.191411 tPOT, ratio
all-in 1.0156, ratio fee-only 803.68, blocks 216303-216304) has its
SHA-256 anchored at block 216343. This is the first fee report anchored
on chain, not just a schema-level claim.

- Report hash: `0x246d6d43b308b8801109910bb52d8ad8d264376e7c8557255b3704176ada0464`
- Anchor tx: `0x0c08335507cfb2a0df4b0236543607aed04527ec26361e6e0022c9100c88f2c9`
- Report file (committed, byte-identical): `evidence/reports/fee-2026-10-27.json`, also served at `/evidence/reports/fee-2026-10-27.json`

```bash
cast call 0xd48da7eff3264bdd51a86b873da9ff6997aae99c "isAnchored(bytes32)(bool)" 0x246d6d43b308b8801109910bb52d8ad8d264376e7c8557255b3704176ada0464 --rpc-url https://test-evm-rpc-v3.portaldot.dev
# expected: true

cast receipt 0x0c08335507cfb2a0df4b0236543607aed04527ec26361e6e0022c9100c88f2c9 --rpc-url https://test-evm-rpc-v3.portaldot.dev --json
# expected: status 0x1, blockNumber 0x34d17 (216343), to 0xd48da7eff3264bdd51a86b873da9ff6997aae99c,
#   one log with address 0xd48da7eff3264bdd51a86b873da9ff6997aae99c and
#   topics[1] 0x246d6d43b308b8801109910bb52d8ad8d264376e7c8557255b3704176ada0464
```

Verify link: https://nodescope.vercel.app/verify?hash=0x246d6d43b308b8801109910bb52d8ad8d264376e7c8557255b3704176ada0464&contract=0xd48da7eff3264bdd51a86b873da9ff6997aae99c&tx=0x0c08335507cfb2a0df4b0236543607aed04527ec26361e6e0022c9100c88f2c9

## 4. Anchor 3: diagnostic report, 12 records with session trends

Claim: the diagnostic report exported 2026-10-27T10:20:20Z (12 records
across 2 snapshots, blocks 216294 to 216317, verdict healthy, Substrate
WSS probe status ok at header 216317) has its SHA-256 anchored at block
216346. This is the latest anchor; all three anchors are recorded in
the anchors array of `deployments/portaldot-v3.json`.

- Report hash: `0x528f38d58920b2c7fef730c27e95200e429a126874746e8cead5c1146c768a5b`
- Anchor tx: `0xc74a08f3835b0c5b7d813ab15597488affa1987bce79a88d843dfdc31a9ec913`
- Report file (committed, byte-identical): `evidence/reports/diagnostic-2026-10-27-2.json`, also served at `/evidence/reports/diagnostic-2026-10-27-2.json`

```bash
cast call 0xd48da7eff3264bdd51a86b873da9ff6997aae99c "isAnchored(bytes32)(bool)" 0x528f38d58920b2c7fef730c27e95200e429a126874746e8cead5c1146c768a5b --rpc-url https://test-evm-rpc-v3.portaldot.dev
# expected: true

cast receipt 0xc74a08f3835b0c5b7d813ab15597488affa1987bce79a88d843dfdc31a9ec913 --rpc-url https://test-evm-rpc-v3.portaldot.dev --json
# expected: status 0x1, blockNumber 0x34d1a (216346), to 0xd48da7eff3264bdd51a86b873da9ff6997aae99c,
#   one log with address 0xd48da7eff3264bdd51a86b873da9ff6997aae99c and
#   topics[1] 0x528f38d58920b2c7fef730c27e95200e429a126874746e8cead5c1146c768a5b
```

Verify link: https://nodescope.vercel.app/verify?hash=0x528f38d58920b2c7fef730c27e95200e429a126874746e8cead5c1146c768a5b&contract=0xd48da7eff3264bdd51a86b873da9ff6997aae99c&tx=0xc74a08f3835b0c5b7d813ab15597488affa1987bce79a88d843dfdc31a9ec913

## 5. Earlier anchor (25 Oct 2026, supplement)

Claim: on the first registry
`0x74c88d3090aD6915BFDc373eD6F037e2da4557Ce`, the report exported
2026-10-24T20:12:08Z (14 records) was anchored at block 179228. This
anchor is history, not the current evidence, and it still verifies.

- Report hash: `0x0bc787de4c634a55699e92d90b7280fffebdbcd557c4312044134e4df9dfa286`
- Anchor tx: `0xa7cd3cbd060335d851494c1f48e15124ec8d32ccfa3fe03413c85cf895625448`

```bash
cast call 0x74c88d3090aD6915BFDc373eD6F037e2da4557Ce "isAnchored(bytes32)(bool)" 0x0bc787de4c634a55699e92d90b7280fffebdbcd557c4312044134e4df9dfa286 --rpc-url https://test-evm-rpc-v3.portaldot.dev
# expected: true

cast receipt 0xa7cd3cbd060335d851494c1f48e15124ec8d32ccfa3fe03413c85cf895625448 --rpc-url https://test-evm-rpc-v3.portaldot.dev --json
# expected: status 0x1, blockNumber 0x2bc1c (179228), to 0x74c88d3090aD6915BFDc373eD6F037e2da4557Ce,
#   one log with address 0x74c88d3090aD6915BFDc373eD6F037e2da4557Ce and
#   topics[1] 0x0bc787de4c634a55699e92d90b7280fffebdbcd557c4312044134e4df9dfa286
```

Honest gap: the deploy transaction for the 25 Oct registry was not
recorded. Only the anchor transaction above is claimed for it.

Verify link: https://nodescope.vercel.app/verify?hash=0x0bc787de4c634a55699e92d90b7280fffebdbcd557c4312044134e4df9dfa286&contract=0x74c88d3090aD6915BFDc373eD6F037e2da4557Ce&tx=0xa7cd3cbd060335d851494c1f48e15124ec8d32ccfa3fe03413c85cf895625448

## 6. Automated check

```bash
npm run verify:evidence
# expected: [PASS] registry-code, [PASS] deploy-receipt, then five PASS
#   lines per anchor (anchor-1-receipt, anchor-1-log-topic,
#   anchor-1-report-hash, anchor-1-is-anchored, anchor-1-public-copy,
#   same for anchors 2 and 3), [PASS] recompile, OVERALL: PASS
```

The script reads `deployments/portaldot-v3.json` and checks the registry
code, the deploy receipt, and every anchor in the anchors array on
chain: receipt status, log topic, the SHA-256 recomputed from the
committed report file in `evidence/reports/`, the registry's
`isAnchored` view, and a byte-identical public copy under
`public/evidence/reports/` for `/verify` to load. Then it recompiles
the contract and compares creation plus deployed bytecode against the
committed artifact.

## 7. What anchoring does not prove

An anchor proves that a report with a given hash existed at a given
block. It does not prove the node data inside the report was true, it
does not move the report on chain, and it does not make a report
unalterable off chain: altering the file still breaks its SHA-256 stamp
at /verify. See `docs/ATTESTATION.md`.
