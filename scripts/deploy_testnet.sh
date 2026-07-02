#!/usr/bin/env bash
set -euo pipefail

# Deploy the three InvoiceChain contracts to Stellar testnet and record their IDs.
# Usage: ./scripts/deploy_testnet.sh [source-identity]
#   source-identity: a funded testnet key (default: deployer)
#   Create one with: stellar keys generate deployer --network testnet --fund

NET=testnet
SRC=${1:-deployer}
WASM_DIR=target/wasm32v1-none/release

echo "==> Building contracts..."
stellar contract build
for c in test_token reputation marketplace; do
  stellar contract optimize --wasm "$WASM_DIR/$c.wasm"
done

ADMIN_ADDR=$(stellar keys address "$SRC")
echo "==> Deployer/admin: $ADMIN_ADDR"

echo "==> Deploying test_token..."
TOKEN_ID=$(stellar contract deploy --wasm "$WASM_DIR/test_token.optimized.wasm" \
  --source "$SRC" --network "$NET" -- \
  --admin "$ADMIN_ADDR" --decimal 7 --name "USD Coin" --symbol "USDC")
echo "    token: $TOKEN_ID"

echo "==> Deploying marketplace (reputation placeholder = token)..."
MARKET_ID=$(stellar contract deploy --wasm "$WASM_DIR/marketplace.optimized.wasm" \
  --source "$SRC" --network "$NET" -- \
  --admin "$ADMIN_ADDR" --token "$TOKEN_ID" --reputation "$TOKEN_ID")
echo "    marketplace: $MARKET_ID"

echo "==> Deploying reputation (points at marketplace)..."
REP_ID=$(stellar contract deploy --wasm "$WASM_DIR/reputation.optimized.wasm" \
  --source "$SRC" --network "$NET" -- \
  --marketplace "$MARKET_ID")
echo "    reputation: $REP_ID"

echo "==> Wiring marketplace -> reputation..."
stellar contract invoke --id "$MARKET_ID" --source "$SRC" --network "$NET" -- \
  set_reputation --reputation "$REP_ID"

mkdir -p deployments
cat > deployments/testnet.json <<EOF
{
  "network": "testnet",
  "admin": "$ADMIN_ADDR",
  "token": "$TOKEN_ID",
  "marketplace": "$MARKET_ID",
  "reputation": "$REP_ID"
}
EOF
echo "==> Wrote deployments/testnet.json"
cat deployments/testnet.json
