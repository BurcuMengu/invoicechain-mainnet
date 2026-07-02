#!/usr/bin/env bash
set -euo pipefail
NET=testnet

stellar contract bindings typescript --network "$NET" \
  --contract-id CAMG7TMIJ5FJ753ARMKBTFCLPBKX2GHESEQZLVAJO33AZTPNDNVBCXYR \
  --output-dir src/contracts/marketplace --overwrite

stellar contract bindings typescript --network "$NET" \
  --contract-id CA63PKCVFVYIHDVMRTRSK25E7YFBZGJWEXSCHUHM2LFCLSBFA7PEL7VK \
  --output-dir src/contracts/token --overwrite

stellar contract bindings typescript --network "$NET" \
  --contract-id CDEKX5WLSYOR54LUDEQ3UNIK7TDHEKE24U4FEA57XQBP7FGV3UVXIMCP \
  --output-dir src/contracts/reputation --overwrite

echo "bindings generated"
