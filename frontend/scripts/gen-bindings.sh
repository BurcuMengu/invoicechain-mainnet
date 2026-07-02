#!/usr/bin/env bash
set -euo pipefail
NET=testnet

stellar contract bindings typescript --network "$NET" \
  --contract-id CDSLEGLUKSZ7X3M2I7DRP2PTKAGJOTAIZ5FVQVFJWTJBMZTJXRLDEUQD \
  --output-dir src/contracts/marketplace --overwrite

stellar contract bindings typescript --network "$NET" \
  --contract-id CBROMO54YLXSBAU2EDLJDJ7B2LNWGI366W4WMOULJVOFNBQDAZZLCAZA \
  --output-dir src/contracts/token --overwrite

stellar contract bindings typescript --network "$NET" \
  --contract-id CAX2MPXBTI7QTHZ5G6IWXGLFMXDF2IMQIHSKYQRDNGAO3ZVMY6VBO3K3 \
  --output-dir src/contracts/reputation --overwrite

echo "bindings generated"
