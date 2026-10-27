# Pre-deploy cost gate

Fail a pull request when a contract deploy on Portaldot V3 got more
expensive than your budget — measured live, read-only, before anything is
deployed.

## What it does

1. Reads your compiled artifact (solc JSON with creation bytecode, or a raw
   `0x` bytecode file; `deployedBytecode`-only artifacts are rejected,
   runtime code cannot price a deploy).
2. Prices the deploy exactly like the Fee Lab:
   - **EVM** — `eth_estimateGas` (contract creation) × `eth_gasPrice`,
     converted from 18-decimal wei to 14-decimal tPOT. On pallet-revive the
     gas figure already folds the storage deposit in.
   - **Native** (only with `surface: cheapest`) — `ReviveApi` dry-run +
     `paymentInfo` on `revive.instantiateWithCode`: fee + storage deposit
     (a refundable hold), all-in.
3. Compares the gated cost with `max-tpot` and exits **0** (within budget)
   or **1** (over budget, or the deploy could not be priced). Usage and
   artifact errors exit **2**. An unpriceable deploy never passes.

Nothing signs. The `from` address is only a dry-run origin.

## Use it in a workflow

```yaml
- uses: Firzadf/nodescope/.github/actions/cost-gate@main
  id: gate
  with:
    artifact: out/MyContract.sol/MyContract.json
    max-tpot: '150'
    # surface: cheapest
- run: echo "deploy costs ${{ steps.gate.outputs.cost-tpot }} tPOT"
```

Full example: [`docs/examples/cost-gate.yml`](examples/cost-gate.yml).

| Input | Default | Meaning |
| --- | --- | --- |
| `artifact` | — (required) | solc artifact JSON or raw 0x bytecode file |
| `max-tpot` | — (required) | budget in tPOT |
| `rpc` | `https://test-evm-rpc-v3.portaldot.dev` | EVM RPC |
| `surface` | `evm` | `evm` or `cheapest` |
| `wss` | `wss://test-node-v3.portaldot.dev` | Substrate WSS (cheapest only) |
| `from` | `0x03c5…d912` | dry-run origin |

Outputs: `cost-tpot`, `over` (`true` / `false` / `unknown`), `surface`
(`evm` / `native`), `block`. A markdown table goes to the job summary.

## Run it locally

```bash
node scripts/cost-gate.mjs \
  --artifact contracts/out/NodeScopeAttestation.sol/NodeScopeAttestation.json \
  --max-tpot 200
```

`scripts/cost-gate.test.mjs` runs the script against a mock JSON-RPC
server **and** executes the action's own `run:` block from
`.github/actions/cost-gate/action.yml` with bash, the way a runner does,
so the Action is tested locally on every `npx vitest run`.

## Relation to the root `action.yml`

The root action is the combined gate (node health + fees, both legs). This
one is the minimal cost-only gate: one input you must set (`max-tpot`), one
decision, no health check. Use whichever matches your pipeline.
