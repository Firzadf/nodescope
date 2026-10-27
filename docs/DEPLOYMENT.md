# Deployment: registry and anchors (Portaldot V3 testnet)

How the attestation registry was deployed and how reports were anchored,
so anyone can repeat it or audit it. The app itself never deploys and
never signs: every on-chain step below runs in the operator's own wallet
tool, and the app only reads receipts afterwards.

- Chain: Portaldot V3 testnet, chain ID 420420777
- RPC: `https://test-evm-rpc-v3.portaldot.dev`
- Contract: `contracts/NodeScopeAttestation.sol` (ownerless, Foundry,
  solc 0.8.24 pinned, optimizer runs 200, evm_version cancun)
- Deployment record: `deployments/portaldot-v3.json`, written by the
  scripts below. The app reads its default registry from this file.
- tPOT is a testnet token with no market value (about $0).

## 1. Estimate first (read-only, no key needed)

```bash
./scripts/estimate-attestation.sh
```

Prints the EVM deploy estimate and the native equivalent (fee-only
versus all-in, storage deposit shown separately). Measured 27 Oct 2026:
EVM deploy 77.260740 tPOT, native all-in 76.074209 tPOT. Nothing is sent.

## 2. Deploy

Needs a Foundry keystore account holding tPOT (testnet only, never a
mainnet key). The script prints a pre-flight summary (chain, contract,
deployer, estimated gas and cost) and asks for confirmation before
sending anything.

```bash
CAST_ACCOUNT=<your-testnet-account> ./scripts/deploy-attestation.sh
```

Recorded result, 27 Oct 2026:

- Registry: `0xd48da7eff3264bdd51a86b873da9ff6997aae99c`
- Deploy tx: `0x1c2a055523a4cf8b73d771df4d3c54d21392a85f86a14a4d68213bf6db5f4904`
- Deploy block: 216268 (0x34ccc), receipt status 0x1
- Deployer: `0xaD62d0aA606240e2C5156e04C82e61C81044959f`

## 3. Anchor a report

Export a report from the app first (Health diagnostic or Fee Lab fee
report). The script reads the report's `integrity.hash`, prints a
pre-flight summary, asks for confirmation, anchors, then runs three
post-checks in-script (registry code non-empty, receipt status 0x1,
Attested log topics[1] equals the report hash).

```bash
CAST_ACCOUNT=<your-testnet-account> ./scripts/anchor-report.sh --report <report.json>
```

Recorded anchors, 27 Oct 2026 (all receipt status 0x1, all `isAnchored`
true; full commands in `docs/EVIDENCE.md`):

- Diagnostic report, 6 records: hash
  `0x08ac72ad0f7a818bc18a8624232811fc4f994cf065bbd2cad1eea4b0bb002df4`,
  tx `0xba35df8e2f182d75885b75b75f0dd97340f4ce64333840d1cf06a252441e9476`,
  block 216341
- Fee Lab fee report (deploy): hash
  `0x246d6d43b308b8801109910bb52d8ad8d264376e7c8557255b3704176ada0464`,
  tx `0x0c08335507cfb2a0df4b0236543607aed04527ec26361e6e0022c9100c88f2c9`,
  block 216343
- Diagnostic report, 12 records with session trends: hash
  `0x528f38d58920b2c7fef730c27e95200e429a126874746e8cead5c1146c768a5b`,
  tx `0xc74a08f3835b0c5b7d813ab15597488affa1987bce79a88d843dfdc31a9ec913`,
  block 216346

The deployments file records only the latest anchor by design; the
other two live in `docs/EVIDENCE.md` and verify with the same cast
commands. Never run the anchor script without `--report`: the default
anchors the bundled sample report, which is not evidence of anything
real.

## 4. Verify

```bash
npm run verify:evidence
# expected: 5 PASS, OVERALL: PASS
```

Also run by hand from `docs/EVIDENCE.md` if you do not trust the script.

## 5. Two script bugs found live and fixed

Both were found on 27 Oct 2026 during the real deployment, both failed
before any transaction was sent, and both are fixed in the committed
scripts.

1. `scripts/deploy-attestation.sh`: in cast 1.8.6, `--create` is a
   subcommand of `cast send`, so every option (`--rpc-url`, `--account`,
   `--json`) must come before it. The script had them after it, and cast
   rejected the call with `unexpected argument '--rpc-url' found`.
   Fixed order: `cast send --rpc-url … --account … --json --create …`.
2. `scripts/anchor-report.sh`: the script demanded `integrity.hash` in
   `0x` + 64 hex form, but the app stamps reports with bare 64 hex
   (no `0x` prefix). Genuine reports were rejected before sending.
   The script now accepts bare 64 hex and adds the `0x` prefix itself
   for the on-chain call. Report files are never edited to fit the
   script: editing `integrity.hash` in a file would break its /verify
   stamp comparison.

## 6. Rotating to a new registry

Re-run sections 1-3. The scripts overwrite
`deployments/portaldot-v3.json`; the app, the consistency script, and
`npm run verify:evidence` follow the file, so no second copy of the
address needs updating by hand. Update `src/utils/siteConstants.ts`
(`ANCHOR_*` to the new latest anchor, previous anchor to `SUPPLEMENT_*`),
`README.md`, the DoraHacks draft, and `docs/EVIDENCE.md` in the same
commit, and keep the old anchor visible with its date label instead of
deleting it.
