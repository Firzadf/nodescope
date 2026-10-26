#!/usr/bin/env bash
#
# estimate-attestation.sh — read-only cost estimate for deploying
# NodeScopeAttestation on the Portaldot V3 testnet.
#
# What it does (no key, no signing, no transaction):
#   1. EVM surface: eth_estimateGas for the contract creation bytecode
#      x eth_gasPrice on https://test-evm-rpc-v3.portaldot.dev.
#   2. Native surface: the same deployment weighed as
#      revive.instantiateWithCode, using the Fee Lab's own dry-run logic
#      (see scripts/estimate-attestation-native.mjs).
# It prints the tPOT needed before deploy. Narrative, in the project's own
# words: kami menghitung biaya deploy kami sendiri pakai Fee Lab.
#
# Usage:
#   ./scripts/estimate-attestation.sh [--wss URL] [--rpc URL]
#
# Requirements: cast (foundry), node, python3. The contract must already be
# compiled: run `forge build` first (contracts/out artifact).
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC_URL="https://test-evm-rpc-v3.portaldot.dev"
WSS_URL="wss://test-node-v3.portaldot.dev"

while [ $# -gt 0 ]; do
  case "$1" in
    --rpc) RPC_URL="$2"; shift 2 ;;
    --wss) WSS_URL="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--rpc URL] [--wss URL]"
      echo "Read-only estimate. No key, no signing, no transaction."
      exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

CAST_BIN="${CAST_BIN:-$(command -v cast || echo "$HOME/.foundry/bin/cast")}"
if [ ! -x "$CAST_BIN" ]; then
  echo "ERROR: cast not found. Install Foundry (foundryup) or set CAST_BIN." >&2
  exit 1
fi

ARTIFACT="$ROOT/contracts/out/NodeScopeAttestation.sol/NodeScopeAttestation.json"
if [ ! -f "$ARTIFACT" ]; then
  echo "ERROR: artifact not found: $ARTIFACT" >&2
  echo "Run: forge build (from the repo root) and retry." >&2
  exit 1
fi

BYTECODE="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['bytecode']['object'])" "$ARTIFACT")"
BYTECODE_LEN=$(( (${#BYTECODE} - 2) / 2 ))
echo "Contract: NodeScopeAttestation (creation bytecode: $BYTECODE_LEN bytes)"
echo "RPC: $RPC_URL"
echo "WSS: $WSS_URL"
echo

# --- EVM surface: eth_estimateGas (create) x eth_gasPrice -------------------
GAS=""
if GAS_OUT="$("$CAST_BIN" estimate --rpc-url "$RPC_URL" --create "$BYTECODE" 2>/dev/null)"; then
  GAS="$GAS_OUT"
else
  # Fallback: raw eth_estimateGas with data only (no from: a fresh contract
  # creation has no constructor args and no state dependencies).
  # Note: this endpoint 403s urllib's default User-Agent, so send a
  # browser-like one.
  GAS="$(python3 - "$RPC_URL" "$BYTECODE" <<'PYEOF'
import json, sys, urllib.request
rpc, data = sys.argv[1], sys.argv[2]
req = urllib.request.Request(rpc, data=json.dumps({
    "jsonrpc": "2.0", "id": 1, "method": "eth_estimateGas",
    "params": [{"data": data}]}).encode(), headers={
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"})
res = json.load(urllib.request.urlopen(req, timeout=30))
if "error" in res:
    raise SystemExit(f"eth_estimateGas failed: {res['error']}")
print(int(res["result"], 16))
PYEOF
)"
fi
GAS_PRICE="$("$CAST_BIN" gas-price --rpc-url "$RPC_URL")"
EVM_TPOT="$(python3 -c "g=int('$GAS'); p=int('$GAS_PRICE'); print(f'{(g*p)/10**18:.6f}')" 2>/dev/null || echo "?")"
EVM_FEE_WEI="$(python3 -c "print(int('$GAS')*int('$GAS_PRICE'))")"
echo "EVM surface (eth_estimateGas create):"
echo "  gas estimate : $GAS"
echo "  gas price    : $GAS_PRICE wei"
echo "  deploy cost  : $EVM_FEE_WEI wei = $EVM_TPOT tPOT"
echo

# --- Native surface: revive.instantiateWithCode dry-run (Fee Lab logic) -----
echo "Native surface (revive.instantiateWithCode dry-run, Fee Lab logic):"
if NATIVE_JSON="$(node "$ROOT/scripts/estimate-attestation-native.mjs" --code "$BYTECODE" --wss "$WSS_URL" 2>&1)"; then
  python3 - "$NATIVE_JSON" <<'PYEOF'
import json, sys
d = json.loads(sys.argv[1])
print(f"  partialFee (fee-only) : {d['partialFeePlanck']} planck = {d['feeOnlyTPOT']:.6f} tPOT")
print(f"  storage deposit       : {d['storageDepositPlanck']} planck = {d['storageDepositTPOT']:.6f} tPOT")
print(f"  all-in                : {d['allInPlanck']} planck = {d['allInTPOT']:.6f} tPOT")
print(f"  weight refTime/proof  : {d['weight']['refTime']} / {d['weight']['proofSize']}")
print(f"  block                 : {d['blockNumber']}")
PYEOF
  NATIVE_ALLIN="$(python3 -c "import json,sys; print(f\"{json.loads(sys.argv[1])['allInTPOT']:.6f}\")" "$NATIVE_JSON")"
  echo "  native all-in         : $NATIVE_ALLIN tPOT (informational; the deploy itself pays the EVM cost)"
else
  echo "  unavailable: native dry-run failed or timed out."
  echo "  detail: $NATIVE_JSON"
  echo "  The EVM figure above is still the amount the deploy itself needs."
fi
echo
echo "Total tPOT needed before deploy (EVM surface): $EVM_TPOT tPOT"
echo "Narasi: kami menghitung biaya deploy kami sendiri pakai Fee Lab."
