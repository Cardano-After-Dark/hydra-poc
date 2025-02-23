#!/bin/bash

# Set environment variables
export PATH=$(pwd)/infra/node/bin:$PATH
export CARDANO_NODE_SOCKET_PATH=$(pwd)/infra/node/preprod/node.socket
export CARDANO_NODE_NETWORK_ID=1
export DYLD_FALLBACK_LIBRARY_PATH=$(pwd)/infra/node/bin

echo "# UTxO of alice-node"
cardano-cli query utxo --address $(cat infra/credentials/alice/alice-node.addr) --out-file /dev/stdout | jq

echo "# UTxO of alice-funds"
cardano-cli query utxo --address $(cat infra/credentials/alice/alice-funds.addr) --out-file /dev/stdout | jq

echo "# UTxO of bob-node"
cardano-cli query utxo --address $(cat infra/credentials/bob/bob-node.addr) --out-file /dev/stdout | jq

echo "# UTxO of bob-funds"
cardano-cli query utxo --address $(cat infra/credentials/bob/bob-funds.addr) --out-file /dev/stdout | jq