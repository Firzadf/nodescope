#!/usr/bin/env bash
#
# deploy-attestation.sh — deploy NodeScopeAttestation to the Portaldot V3
# testnet. RUN BY THE USER (not by any agent): this script sends a real
# transaction from the user's own testnet wallet.
#
# Key handling (hard rules, never weakened):
#   - The script NEVER prints, logs, or echoes a private key. Do not run it
#     with `set -x`, and never paste a key into chat, CI logs, or issues.
#   - The key is read ONLY from the user's local setup, in this order:
#       1. cast keystore account:  CAST_ACCOUNT=<name>  (preferred)
#          Create it once with: cast wallet import <name> --interactive
#       2. PRIVATE_KEY from the environment, or from .env in the repo root
#          (the repo .gitignore covers .env / .env.local / .env.*.local;
#          NEVER commit .env).
#   - If neither is set, the script stops and prints the import command.
#
# What it does:
#   1. Pre-flight summary (chain, contract, bytecode, gas estimate, gas
#      price, estimated tPOT cost, deployer address) and a [y/N] confirm.
#   2. cast send --create with the compiled creation bytecode.
#   3. Writes deployments/portaldot-v3.json with address, tx hash, block,
#      deployer, and timestamp. That file is created BY THIS SCRIPT when it
#      runs; it must not be hand-written with invented values.
#   4. Prints post-run verification commands (eth_getCode, receipt status).
#
# Usage:
#   ./scripts/deploy-attestation.sh [--rpc URL] [--yes]
#
# Requirements: cast (foundry), jq or python3, forge build already run.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC_URL="https://test-evm-rpc-v3.portaldot.dev"
CHAIN_ID=420420777
YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --rpc) RPC_URL="$2"; shift 2 ;;
    --yes) YES=1; shift ;;
    --help|-h)
      echo "Usage: $0 [--rpc URL] [--yes]"
      echo "Deploys NodeScopeAttestation to chain $CHAIN_ID from YOUR testnet wallet."
      echo "Key sources: CAST_ACCOUNT (cast keystore, preferred) or PRIVATE_KEY (env/.env)."
      exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

CAST_BIN="${CAST_BIN:-$(command -v cast || echo "$HOME/.foundry/bin/cast")}"
if [ ! -x "$CAST_BIN" ]; then
  echo "ERROR: cast not found. Install Foundry (foundryup) or set CAST_BIN." >&2
  exit 1
fi

# Load .env if present (repo-root only). Values are used, never printed.
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

AUTH_DESC=""
if [ -n "${CAST_ACCOUNT:-}" ]; then
  AUTH=(--account "$CAST_ACCOUNT")
  AUTH_DESC="cast keystore account '$CAST_ACCOUNT'"
elif [ -n "${PRIVATE_KEY:-}" ]; then
  AUTH=(--private-key "$PRIVATE_KEY")
  AUTH_DESC="PRIVATE_KEY from environment/.env (value never printed)"
else
  echo "ERROR: no deploy key configured." >&2
  echo "Preferred (keystore, key never sits in a file as plaintext):" >&2
  echo "  cast wallet import nodescope-deployer --interactive" >&2
  echo "  CAST_ACCOUNT=nodescope-deployer $0" >&2
  echo "Alternative (env file, gitignored by this repo):" >&2
  echo "  echo 'PRIVATE_KEY=0x...' >> .env   # never commit .env" >&2
  echo "  $0" >&2
  exit 1
fi

ARTIFACT="$ROOT/contracts/out/NodeScopeAttestation.sol/NodeScopeAttestation.json"
if [ ! -f "$ARTIFACT" ]; then
  echo "ERROR: artifact not found: $ARTIFACT" >&2
  echo "Run: forge build (from the repo root) and retry." >&2
  exit 1
fi
BYTECODE="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['bytecode']['object'])" "$ARTIFACT")"

# --- Pre-flight -------------------------------------------------------------
LIVE_CHAIN_ID="$("$CAST_BIN" chain-id --rpc-url "$RPC_URL")"
if [ "$LIVE_CHAIN_ID" != "$CHAIN_ID" ]; then
  echo "ERROR: RPC chain id is $LIVE_CHAIN_ID, expected $CHAIN_ID. Refusing to deploy." >&2
  exit 1
fi
if [ -n "${CAST_ACCOUNT:-}" ]; then
  DEPLOYER="$("$CAST_BIN" wallet address --account "$CAST_ACCOUNT")"
else
  DEPLOYER="$("$CAST_BIN" wallet address --private-key "$PRIVATE_KEY")"
fi
EST_GAS="$("$CAST_BIN" estimate --rpc-url "$RPC_URL" --create "$BYTECODE")"
GAS_PRICE="$("$CAST_BIN" gas-price --rpc-url "$RPC_URL")"
EST_TPOT="$(python3 -c "print(f'{(int('$EST_GAS')*int('$GAS_PRICE'))/10**18:.6f}')")"

echo "Pre-flight summary (nothing sent yet):"
echo "  chain       : $CHAIN_ID (Portaldot V3 testnet)"
echo "  rpc         : $RPC_URL"
echo "  contract    : NodeScopeAttestation (contracts/NodeScopeAttestation.sol)"
echo "  auth        : $AUTH_DESC"
echo "  deployer    : $DEPLOYER"
echo "  est. gas    : $EST_GAS"
echo "  gas price   : $GAS_PRICE wei"
echo "  est. cost   : $EST_TPOT tPOT"
echo
if [ "$YES" -ne 1 ]; then
  read -r -p "Deploy to Portaldot V3 testnet? [y/N] " ANSWER
  case "$ANSWER" in
    y|Y|yes|YES) ;;
    *) echo "Aborted. Nothing sent."; exit 0 ;;
  esac
fi

# --- Deploy -----------------------------------------------------------------
SEND_JSON="$("$CAST_BIN" send --rpc-url "$RPC_URL" "${AUTH[@]}" --json --create "$BYTECODE")"
read -r CONTRACT_ADDR TX_HASH BLOCK_NUM <<< "$(python3 -c "
import json, sys
d = json.loads(sys.argv[1])
print(d.get('contractAddress') or '', d.get('transactionHash') or '', d.get('blockNumber') or '')
" "$SEND_JSON")"
if [ -z "$CONTRACT_ADDR" ]; then
  # Fallback: contract address from the mined receipt.
  RECEIPT_JSON="$("$CAST_BIN" receipt "$TX_HASH" --rpc-url "$RPC_URL" --json)"
  CONTRACT_ADDR="$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('contractAddress') or '')" "$RECEIPT_JSON")"
  BLOCK_NUM="$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('blockNumber') or '')" "$RECEIPT_JSON")"
fi
if [ -z "$CONTRACT_ADDR" ] || [ -z "$TX_HASH" ]; then
  echo "ERROR: could not parse deploy result. Raw output:" >&2
  echo "$SEND_JSON" >&2
  exit 1
fi
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
mkdir -p "$ROOT/deployments"
python3 - "$ROOT/deployments/portaldot-v3.json" "$CONTRACT_ADDR" "$TX_HASH" "$BLOCK_NUM" "$DEPLOYER" "$RPC_URL" "$TIMESTAMP" <<'PYEOF'
import json, sys
path, addr, tx, block, deployer, rpc, ts = sys.argv[1:8]
doc = {
    "contractName": "NodeScopeAttestation",
    "contract": addr,
    "chainId": 420420777,
    "rpcUrl": rpc,
    "deployer": deployer,
    "deployTx": tx,
    "deployBlock": int(block) if str(block).isdigit() else block,
    "deployedAt": ts,
    "anchor": None,
}
with open(path, "w") as f:
    json.dump(doc, f, indent=2)
    f.write("\n")
PYEOF

echo
echo "Deployed."
echo "  contract : $CONTRACT_ADDR"
echo "  tx       : $TX_HASH"
echo "  block    : $BLOCK_NUM"
echo "  saved to : deployments/portaldot-v3.json"
echo
echo "Verify (post-run checks):"
echo "  cast code $CONTRACT_ADDR --rpc-url $RPC_URL            # must be non-empty (0x...)"
echo "  cast receipt $TX_HASH --rpc-url $RPC_URL --json       # status must be 0x1"
echo
echo "Next: anchor a report with ./scripts/anchor-report.sh, then report"
echo "the contract address, deploy tx, and block back so the app wiring"
echo "(step 4) and deployment docs (step 5) can be completed."
