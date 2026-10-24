# Reproduce NodeScope's evidence yourself

No trust required. Every step below uses only public endpoints and the live app.
Nothing here needs an account, a wallet, a key, or a transaction.

## 1. The node answers, right now

```bash
curl -s -X POST https://test-evm-rpc-v3.portaldot.dev \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
```

Expected: a result of `0x190f1ca9`, which is chain ID 420420777, the Portaldot V3
EVM testnet chain. If the chain ID differs, NodeScope reports that as a finding
instead of hiding it.

```bash
curl -s -X POST https://test-evm-rpc-v3.portaldot.dev \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"eth_blockNumber","params":[]}'
```

Expected: a hex block number. Convert it to decimal and compare it with the block
shown on the landing page's Live Readout. The two will differ, because blocks keep
advancing; what must agree is the chain ID and the fact that the number moves
forward over time, never backward in a single session.

## 2. The app, end to end, in about 60 seconds

1. Open https://nodescope.vercel.app/app. The endpoint is already filled in.
2. Press Connect & Test, then Run Health Check. Four methods run
   (`eth_chainId`, `eth_blockNumber`, `web3_clientVersion`, `net_version`) and the
   result is saved as a timestamped snapshot.
3. In Overview, panel 06, press Probe WSS Node. The Substrate node at
   `wss://test-node-v3.portaldot.dev` answers with its own chain, header, peer
   count, and syncing state. A `Method not found` answer to an `eth_*` method on
   this transport is expected: it is a Substrate transport, not an EVM one.
4. Panel 07, Combined Verdict, reads the EVM snapshot and the Substrate probe
   together. Each number keeps its own timestamp. The two counters are never
   subtracted from each other, because they count different things on different
   transports.

## 3. The report, verified by anyone

1. In History, export the diagnostic report (schema
   `nodescope.diagnostic-report.v1`). It contains the endpoint, the chain ID, the
   records, the findings, and, when available, the session trends and the
   Substrate probe result.
2. Open https://nodescope.vercel.app/verify and drop the same file in, or paste
   its JSON. Verification is computed locally in the browser; nothing is
   uploaded, and no account or wallet is involved.
3. The report carries a SHA-256 integrity stamp over a canonical form of the
   report, covering everything except the stamp block itself. Change any value
   in the file and re-verify: the stamp must fail. That is the whole point.

## 4. What NodeScope deliberately does not do

- By default it sends no transactions and deploys no contracts. On-chain
  attestation is an optional extra step, documented in docs/ATTESTATION.md:
  the user deploys the registry contract and anchors a report hash with their
  own testnet wallet, and the app only verifies the anchoring transaction
  read-only. Until a contract is deployed, the attestation panel honestly
  reports that there is nothing to verify, and no transaction hash is
  invented to fill that state.
- It does not poll or monitor in the background. Every observation above is
  triggered by a person pressing a button, and the landing page's Live Readout
  fetches once on load.
- It does not claim a mainnet EVM check, because no public mainnet EVM RPC is
  published in the official V3 references. The Mainnet Profile page links only
  the official console, explorer, and bridge.

## 5. The test suite, if you want the code checked too

```bash
npm install
npm test -- --run
npm run lint
npm run build
```

At the last full verification, 25 Oct 2026, the suite passed 296 tests across
26 files, lint reported 0 errors, and the production build succeeded. If a
future change breaks that, the suite, not this document, is the authority.
