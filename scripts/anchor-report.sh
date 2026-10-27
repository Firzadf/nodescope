#!/usr/bin/env bash
#
# anchor-report.sh — anchor a NodeScope diagnostic report hash in the
# NodeScopeAttestation registry on the Portaldot V3 testnet.
# RUN BY THE USER (not by any agent): this script sends a real transaction
# from the user's own testnet wallet.
#
# Key handling: identical to scripts/deploy-attestation.sh. The key is read
# ONLY from CAST_ACCOUNT (cast keystore, preferred) or PRIVATE_KEY (env /
# .env in the repo root, gitignored). It is NEVER printed or logged.
#
# What it does:
#   1. Reads integrity.hash from a report JSON (default:
#      public/sample-report.json, or any exported report).
#   2. Registry address defaults to deployments/portaldot-v3.json (written
#      by deploy-attestation.sh); override with --registry.
#   3. Pre-flight summary (registry, hash, endpoint, chain, block) and a
#      [y/N] confirm, then:
#        cast send <registry> "anchor(bytes32,string,uint256,uint256)"
#          <hash> "<endpoint>" 420420777 <currentBlock>
#   4. Appends the anchor tx hash + block to deployments/portaldot-v3.json.
#   5. Runs the post-run checks in-script: eth_getCode non-empty, receipt
#      status 0x1, Attested log topics[1] == report hash. It also prints the
#      manual cast commands so anyone can re-verify independently.
#
# Usage:
#   ./scripts/anchor-report.sh [--report FILE] [--registry 0x...]
#                              [--endpoint URL] [--rpc URL] [--yes]
#
# Requirements: cast (foundry), python3.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RPC_URL="https://test-evm-rpc-v3.portaldot.dev"
CHAIN_ID=420420777
REPORT_FILE="$ROOT/public/sample-report.json"
REGISTRY=""
ENDPOINT="$RPC_URL"
YES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --report) REPORT_FILE="$2"; shift 2 ;;
    --registry) REGISTRY="$2"; shift 2 ;;
    --endpoint) ENDPOINT="$2"; shift 2 ;;
    --rpc) RPC_URL="$2"; shift 2 ;;
    --yes) YES=1; shift ;;
    --help|-h)
      echo "Usage: $0 [--report FILE] [--registry 0x...] [--endpoint URL] [--rpc URL] [--yes]"
      echo "Anchors integrity.hash from a report JSON in the registry contract."
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
  echo "ERROR: no anchor key configured." >&2
  echo "  cast wallet import nodescope-deployer --interactive" >&2
  echo "  CAST_ACCOUNT=nodescope-deployer $0" >&2
  echo "Or set PRIVATE_KEY in env / .env (never commit .env)." >&2
  exit 1
fi

DEPLOY_FILE="$ROOT/deployments/portaldot-v3.json"
if [ -z "$REGISTRY" ]; then
  if [ -f "$DEPLOY_FILE" ]; then
    REGISTRY="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('contract') or '')" "$DEPLOY_FILE")"
  fi
  if [ -z "$REGISTRY" ]; then
    echo "ERROR: no registry address. Run deploy-attestation.sh first, or pass --registry 0x..." >&2
    exit 1
  fi
fi

if [ ! -f "$REPORT_FILE" ]; then
  echo "ERROR: report file not found: $REPORT_FILE" >&2
  exit 1
fi
REPORT_HASH="$(python3 -c "
import json, re, sys
d = json.load(open(sys.argv[1]))
h = (d.get('integrity') or {}).get('hash') or ''
if re.fullmatch(r'[0-9a-fA-F]{64}', h or ''):
    h = '0x' + h
if not re.fullmatch(r'0x[0-9a-fA-F]{64}', h or ''):
    raise SystemExit('ERROR: report has no valid integrity.hash (0x + 64 hex chars)')
print(h.lower())
" "$REPORT_FILE")"

LIVE_CHAIN_ID="$("$CAST_BIN" chain-id --rpc-url "$RPC_URL")"
if [ "$LIVE_CHAIN_ID" != "$CHAIN_ID" ]; then
  echo "ERROR: RPC chain id is $LIVE_CHAIN_ID, expected $CHAIN_ID. Refusing to anchor." >&2
  exit 1
fi
BLOCK_PARAM="$("$CAST_BIN" block-number --rpc-url "$RPC_URL")"

echo "Pre-flight summary (nothing sent yet):"
echo "  registry   : $REGISTRY"
echo "  report     : $REPORT_FILE"
echo "  report hash: $REPORT_HASH"
echo "  endpoint   : $ENDPOINT"
echo "  chain      : $CHAIN_ID"
echo "  block param: $BLOCK_PARAM (current head; the anchor also records the mined tx block)"
echo "  auth       : $AUTH_DESC"
echo
if [ "$YES" -ne 1 ]; then
  read -r -p "Anchor this report hash? [y/N] " ANSWER
  case "$ANSWER" in
    y|Y|yes|YES) ;;
    *) echo "Aborted. Nothing sent."; exit 0 ;;
  esac
fi

SEND_JSON="$("$CAST_BIN" send "$REGISTRY" "anchor(bytes32,string,uint256,uint256)" "$REPORT_HASH" "$ENDPOINT" "$CHAIN_ID" "$BLOCK_PARAM" --rpc-url "$RPC_URL" "${AUTH[@]}" --json)"
read -r TX_HASH ANCHOR_BLOCK <<< "$(python3 -c "
import json, sys
d = json.loads(sys.argv[1])
print(d.get('transactionHash') or '', d.get('blockNumber') or '')
" "$SEND_JSON")"
if [ -z "$TX_HASH" ]; then
  echo "ERROR: could not parse anchor result. Raw output:" >&2
  echo "$SEND_JSON" >&2
  exit 1
fi
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
mkdir -p "$ROOT/deployments"
python3 - "$DEPLOY_FILE" "$REGISTRY" "$REPORT_FILE" "$REPORT_HASH" "$ENDPOINT" "$BLOCK_PARAM" "$TX_HASH" "$ANCHOR_BLOCK" "$TIMESTAMP" <<'PYEOF'
import json, os, sys
path, registry, report, h, endpoint, param, tx, block, ts = sys.argv[1:10]
def to_int(v):
    try:
        return int(v, 0)
    except (TypeError, ValueError):
        return v
doc = {}
if os.path.exists(path):
    doc = json.load(open(path))
doc.setdefault("contractName", "NodeScopeAttestation")
doc.setdefault("contract", registry)
doc.setdefault("chainId", 420420777)
# Record the report path relative to the repo root when it lives inside
# the repo, so the deployments file never leaks a local absolute path.
root = os.path.dirname(os.path.dirname(os.path.abspath(path)))
if os.path.isabs(report):
    try:
        rel = os.path.relpath(report, root)
        if not rel.startswith(".."):
            report = rel
    except ValueError:
        pass
anchors = doc.get("anchors")
if not isinstance(anchors, list):
    anchors = []
    if isinstance(doc.get("anchor"), dict):
        anchors.append(doc["anchor"])
    doc["anchors"] = anchors
    doc.pop("anchor", None)
anchors.append({
    "reportFile": report,
    "reportHash": h,
    "endpoint": endpoint,
    "chainId": 420420777,
    "blockParam": to_int(param),
    "txHash": tx,
    "block": to_int(block),
    "anchoredAt": ts,
})
# Label is display metadata for /judges; add one by hand in the
# deployments file when wiring the anchor into the app.
with open(path, "w") as f:
    json.dump(doc, f, indent=2)
    f.write("\n")
PYEOF

echo
echo "Anchored."
echo "  tx       : $TX_HASH"
echo "  block    : $ANCHOR_BLOCK"
echo "  saved to : deployments/portaldot-v3.json"
echo
echo "Post-run verification (run in-script, re-runnable manually):"
CODE="$("$CAST_BIN" code "$REGISTRY" --rpc-url "$RPC_URL")"
if [ "$CODE" != "0x" ] && [ -n "$CODE" ]; then echo "  [PASS] eth_getCode at registry is non-empty"; else echo "  [FAIL] eth_getCode at registry is empty"; fi
RECEIPT_JSON="$("$CAST_BIN" receipt "$TX_HASH" --rpc-url "$RPC_URL" --json)"
python3 - "$RECEIPT_JSON" "$REGISTRY" "$REPORT_HASH" <<'PYEOF'
import json, sys
receipt, registry, h = json.loads(sys.argv[1]), sys.argv[2].lower(), sys.argv[3].lower()
status = receipt.get("status")
print(f"  [{'PASS' if status == '0x1' else 'FAIL'}] receipt status is {status} (want 0x1)")
match = any(
    (log.get("address") or "").lower() == registry
    and len(log.get("topics") or []) >= 2
    and (log["topics"][1] or "").lower() == h
    for log in receipt.get("logs") or []
)
print(f"  [{'PASS' if match else 'FAIL'}] Attested log topics[1] == report hash")
PYEOF
echo
echo "Manual re-verification:"
echo "  cast code $REGISTRY --rpc-url $RPC_URL"
echo "  cast receipt $TX_HASH --rpc-url $RPC_URL --json"
echo "  cast call $REGISTRY \"isAnchored(bytes32)(bool)\" $REPORT_HASH --rpc-url $RPC_URL  # want true"
echo
echo "Next: report the registry address, anchor tx, and anchor block back so"
echo "the app wiring (step 4) and deployment docs (step 5) can be completed."
