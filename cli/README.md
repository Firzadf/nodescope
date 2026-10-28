# nodescope CLI

Check the node and price the deploy before you deploy, from CI or a terminal.
No signing, no key, no wallet: the `--from` address is only a dry-run
origin, exactly like the Fee Lab.

## Run it

From a repo checkout (the package stays private; nothing is published to
npm — publishing is a separate manual step by the user):

```bash
npx nodescope check https://test-evm-rpc-v3.portaldot.dev
node cli/nodescope.mjs check https://test-evm-rpc-v3.portaldot.dev --json
```

## check

```bash
nodescope check <rpc-url> [--json] [--format text|json|prometheus]
  [--wss <wss-url>] [--reliability N] [--metrics-file <path>]
  [--timeout-ms N]
```

Calls `eth_chainId`, `eth_blockNumber`, `web3_clientVersion`, and
`net_version`, then `eth_getBlockByNumber` for the best-block timestamp.
`--wss` also reads finality, peers, and sync. The verdict matches the app:

- `healthy` — every method answered, the chain id is 420420777, and the head is moving.
- `degraded` — partial answers, or a chain id mismatch, and the head is not stalled.
- `stalled` — the RPC answered and the best head (timestamp ≥ 90s old) or the finalized head has not advanced. Chain paused but RPC answers.
- `down` — nothing answered.

Exit code: 0 healthy, 1 degraded/stalled/down, 2 usage error.

### Prometheus (`--format prometheus`)

Prints the text exposition: `nodescope_up`, `nodescope_health_score` (formula `nodescope.health-score.v2`), `nodescope_verdict`, `nodescope_stalled`, `nodescope_best_block`, `nodescope_finalized_block`, `nodescope_finality_lag_blocks`, `nodescope_peers`, `nodescope_syncing`, `nodescope_best_head_age_seconds`. With `--reliability N` (1–20) it also prints the error ratio and p50/p95 latency. Missing signals are omitted.

```bash
nodescope check https://test-evm-rpc-v3.portaldot.dev \
  --wss wss://test-node-v3.portaldot.dev \
  --format prometheus --metrics-file /var/lib/node_exporter/nodescope.prom
```

Grafana: add that file to the node_exporter textfile collector, or scrape a copy Alloy tails. The metric names above are the dashboard queries. `--watch 60 --metrics-file …` replaces the file each cycle.

### Alerts: `--webhook` and `--watch`

```bash
nodescope check <rpc-url> --webhook https://discord.com/api/webhooks/…
nodescope check <rpc-url> --webhook https://hooks.slack.com/services/… --watch 60
```

- `--webhook URL` — an https Discord (`discord.com/api/webhooks/…`) or
  Slack (`hooks.slack.com/…`) incoming webhook. Anything else is a usage
  error (exit 2). The URL is never printed.
- One-shot (no `--watch`): posts one message only when the verdict is
  `degraded` or `down`. A healthy node sends nothing.
- `--watch N` (N ≥ 30 seconds): repeats the check every N seconds until
  Ctrl-C. The first check is the baseline; after that a message goes out
  only on a transition — **degrade**, **recover**, **stall**, or **resume**.
  Stall/resume replaces the generic degrade/recover for that cycle.
  stalled → down is a degrade, not a resume. Steady state sends nothing.
  With `--format prometheus` each cycle's exposition goes to stdout (the
  human line goes to stderr) and, with `--metrics-file`, to that file.
- Same transition rule as the app's Watch & alerts panel. Read-only toward
  the chain: the only writes are the webhook POSTs.

## bench

```bash
nodescope bench <rpc-url> [<rpc-url> …] [--samples N] [--json]
```

Read-only RPC endpoint benchmark. For each endpoint: one `eth_chainId`,
then `--samples` rounds (default 5, max 50) of `eth_blockNumber`, all
endpoints in parallel per round. Prints p50 / p95 / max latency, answers
vs errors, and the head of the last round, then a consistency line: do
the chain ids agree, and the head spread (max − min) in the last round.
A spread of a block or two is normal between two calls and is reported,
not judged. Exit 0 when every endpoint answered and the chain ids agree,
1 otherwise, 2 on a usage error.

## Cost gate (`scripts/cost-gate.mjs` + `.github/actions/cost-gate`)

```bash
node scripts/cost-gate.mjs --artifact out/MyContract.sol/MyContract.json --max-tpot 150
```

A single-purpose pre-deploy gate: prices the deploy with the Fee Lab's
EVM formula (`eth_estimateGas` × `eth_gasPrice`; add `--surface cheapest`
to also price native fee + refundable deposit and gate the cheaper leg)
and exits 1 when the cost is above `--max-tpot`, or when the deploy
cannot be priced at all. Inside GitHub Actions it writes `cost_tpot`,
`over`, `surface`, and `block` outputs plus a step-summary table. See
`docs/COST-GATE.md` and the example workflow in
`docs/examples/cost-gate.yml`.

## fees

```bash
nodescope fees --artifact <file.json> [--evm-rpc URL] [--wss URL]
  [--from 0x…] [--max-tpot N] [--evm-only] [--json]
  [--connect-timeout-ms N] [--estimate-timeout-ms N]
```

Defaults: `--evm-rpc https://test-evm-rpc-v3.portaldot.dev`,
`--wss wss://test-node-v3.portaldot.dev`,
`--from 0x03c502abb79e8eee50135c91933d059d982dd912` (dry-run origin only).

The artifact is a solc JSON artifact (creation bytecode from `bytecode`,
`bytecode.object`, or `evm.bytecode.object`), or raw `0x` creation
bytecode. Optional `constructorArgs` / `constructorData` (0x hex,
ABI-encoded) is appended to the creation bytecode. An artifact that
contains only `deployedBytecode` is rejected with a plain-language error:
runtime code cannot price a deploy.

The same operation is priced on both surfaces, the same way the Fee Lab
prices it:

- EVM: `eth_estimateGas` × `eth_gasPrice`. The gas figure already folds
  the storage deposit in.
- Native: `ReviveApi.instantiate` dry-run + `paymentInfo` on the real
  `revive.instantiateWithCode` extrinsic, reported as partialFee + storage
  deposit separately. The deposit is a refundable hold, not a burned fee.

The comparison uses the same 2% tie band as the Fee Lab. `--max-tpot`
checks the cheapest priced all-in cost: exit 1 when the deploy would cost
more than the budget. A native leg that is unavailable is a warning in
the output, not a failure — the EVM leg alone still gates the deploy
cost. Exit codes: 0 priced and within budget, 1 EVM leg unavailable or
budget exceeded, 2 usage/artifact error.

## Why plain .mjs

CI runs Node 20 and the app's TypeScript sources use extensionless
imports that Node cannot resolve without a bundler, so the CLI ports the
Fee Lab logic to plain `.mjs` explicitly (see the header comment in
`cli/lib.mjs` for the mapping). The browser app remains the source of
truth; if its logic changes, this port must change with it.

## GitHub Action

See `action.yml` at the repo root and the example workflow in the README.
The Action runs this CLI in CI: check the node, then price the deploy,
and fail the job when the node is unhealthy or the cost exceeds
`--max-tpot`.
