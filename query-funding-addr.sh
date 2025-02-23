#!/bin/bash

# Set environment variables
export PATH=$(pwd)/infra/node/bin:$PATH
export CARDANO_NODE_SOCKET_PATH=$(pwd)/infra/node/preprod/node.socket
export CARDANO_NODE_NETWORK_ID=1
export DYLD_FALLBACK_LIBRARY_PATH=$(pwd)/infra/node/bin

echo "# UTxO of funding-wallet"
cardano-cli query utxo --address $(cat infra/credentials/funding/funding-wallet.addr) --out-file /dev/stdout | jq