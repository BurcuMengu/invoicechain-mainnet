#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# InvoiceChain — MAINNET (pubnet) deployment
# ═══════════════════════════════════════════════════════════════════════════════
# ⚠️  REAL MONEY. This deploys to the Stellar public network and wires the
#     marketplace to the CANONICAL USDC Stellar Asset Contract (SAC). The mock
#     `test_token` is intentionally NOT deployed (audit IC-01).
#
# Prerequisites:
#   - stellar-cli configured with a `mainnet` network:
#       stellar network add mainnet \
#         --rpc-url https://mainnet.sorobanrpc.com \
#         --network-passphrase "Public Global Stellar Network ; September 2015"
#   - A funded deployer key (real XLM for fees):
#       stellar keys address <deployer>
#   - RECOMMENDED (audit DD-2): set ADMIN_ADDR to a MULTISIG / hardware-wallet
#     account, NOT the raw deployer hot key. Admin controls upgrade / pause /
#     set_reputation.
#
# Usage:
#   [ADMIN_ADDR=G...] [USDC_SAC=C...] ./scripts/deploy_mainnet.sh <deployer-identity>
#
# Env overrides:
#   USDC_SAC   - USDC SAC contract id. If unset, derived from the canonical
#                mainnet USDC asset via `stellar contract id asset`.
#   ADMIN_ADDR - admin address (default: deployer address; USE A MULTISIG).
# ═══════════════════════════════════════════════════════════════════════════════

NET=${NET:-mainnet}
SRC=${1:?"usage: ./scripts/deploy_mainnet.sh <deployer-identity>  (a funded mainnet key)"}
WASM_DIR=target/wasm32v1-none/release

# Canonical mainnet USDC (Circle) — used only to DERIVE the SAC id if USDC_SAC
# is not supplied. Override USDC_SAC to pin an exact contract id.
USDC_ASSET="USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"

DEPLOYER_ADDR=$(stellar keys address "$SRC")
ADMIN_ADDR=${ADMIN_ADDR:-$DEPLOYER_ADDR}

# ── Derive / validate the real USDC SAC address (audit IC-01) ─────────────────
if [[ -z "${USDC_SAC:-}" ]]; then
  echo "==> Deriving USDC SAC id from $USDC_ASSET on $NET..."
  # `contract id asset` derives a deterministic address; it takes no --source.
  # --network provides the rpc-url + passphrase from the configured network.
  USDC_SAC=$(stellar contract id asset --asset "$USDC_ASSET" --network "$NET")
fi
echo "    USDC SAC (token): $USDC_SAC"
case "$USDC_SAC" in
  C*) : ;;  # looks like a contract id
  *) echo "!! USDC_SAC does not look like a contract id (C...): $USDC_SAC" >&2; exit 1 ;;
esac

# ── Safety confirmation (real money) ──────────────────────────────────────────
echo
echo "════════════════════════════════════════════════════════"
echo "  MAINNET DEPLOY — this spends REAL XLM on $NET"
echo "  deployer : $DEPLOYER_ADDR"
echo "  admin    : $ADMIN_ADDR"
if [[ "$ADMIN_ADDR" == "$DEPLOYER_ADDR" ]]; then
  echo "  ⚠️  admin == deployer hot key. DD-2 recommends a MULTISIG admin."
fi
echo "  token    : $USDC_SAC  (canonical USDC — mock NOT deployed)"
echo "════════════════════════════════════════════════════════"
read -r -p 'Type "DEPLOY MAINNET" to proceed: ' CONFIRM
[[ "$CONFIRM" == "DEPLOY MAINNET" ]] || { echo "Aborted."; exit 1; }

# ── Build + optimize (only the two real contracts; NOT test_token) ────────────
echo "==> Building contracts..."
stellar contract build
for c in reputation marketplace; do
  stellar contract optimize --wasm "$WASM_DIR/$c.wasm"
done

# ── Deploy (marketplace with reputation placeholder, then reputation, then wire)
# The constructor cycle (marketplace needs reputation, reputation needs
# marketplace) is resolved with a temporary placeholder + set_reputation. To
# fully close audit IC-09 this script VERIFIES the final wiring below and, via
# `set -e`, refuses to write deployments/mainnet.json on any failure.
echo "==> Deploying marketplace (reputation placeholder = admin, token = USDC SAC)..."
MARKET_ID=$(stellar contract deploy --wasm "$WASM_DIR/marketplace.optimized.wasm" \
  --source "$SRC" --network "$NET" -- \
  --admin "$ADMIN_ADDR" --token "$USDC_SAC" --reputation "$ADMIN_ADDR")
echo "    marketplace: $MARKET_ID"

echo "==> Deploying reputation (points at marketplace)..."
REP_ID=$(stellar contract deploy --wasm "$WASM_DIR/reputation.optimized.wasm" \
  --source "$SRC" --network "$NET" -- \
  --marketplace "$MARKET_ID")
echo "    reputation: $REP_ID"

echo "==> Wiring marketplace -> reputation..."
stellar contract invoke --id "$MARKET_ID" --source "$SRC" --network "$NET" -- \
  set_reputation --reputation "$REP_ID"

# ── Post-deploy verification (audit IC-09) ────────────────────────────────────
# Read the wired addresses back from the marketplace and assert correctness
# BEFORE recording the deployment. If set_reputation had silently failed, or the
# placeholder had leaked, these checks abort the script.
echo "==> Verifying wiring..."
WIRED_REP=$(stellar contract invoke --id "$MARKET_ID" --source "$SRC" --network "$NET" -- reputation | tr -d '"')
WIRED_TOKEN=$(stellar contract invoke --id "$MARKET_ID" --source "$SRC" --network "$NET" -- token | tr -d '"')
echo "    marketplace.reputation() = $WIRED_REP"
echo "    marketplace.token()      = $WIRED_TOKEN"
[[ "$WIRED_REP" == "$REP_ID" ]]      || { echo "!! reputation wiring mismatch (got $WIRED_REP, want $REP_ID)"; exit 1; }
[[ "$WIRED_TOKEN" == "$USDC_SAC" ]]  || { echo "!! token mismatch (got $WIRED_TOKEN, want $USDC_SAC)"; exit 1; }
[[ "$WIRED_REP" != "$WIRED_TOKEN" ]] || { echo "!! reputation == token (IC-09 placeholder leaked)"; exit 1; }
echo "    ✓ wiring verified (reputation != token, token is USDC SAC)"

# ── Record deployment ─────────────────────────────────────────────────────────
mkdir -p deployments
cat > deployments/mainnet.json <<EOF
{
  "network": "$NET",
  "admin": "$ADMIN_ADDR",
  "token": "$USDC_SAC",
  "token_note": "canonical USDC SAC (mock test_token NOT deployed) — audit IC-01",
  "marketplace": "$MARKET_ID",
  "reputation": "$REP_ID"
}
EOF
echo "==> Wrote deployments/mainnet.json"
cat deployments/mainnet.json

echo
echo "Next steps:"
echo "  - If admin is not yet a multisig, migrate admin control now (DD-2)."
echo "  - Update the frontend mainnet config with the ids above (WS2)."
echo "  - Never deploy test_token to mainnet (IC-01)."
