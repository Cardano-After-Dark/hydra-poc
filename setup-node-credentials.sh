#!/bin/bash

# Set environment variables
export PATH=$(pwd)/infra/node/bin:$PATH
export CARDANO_NODE_SOCKET_PATH=$(pwd)/infra/node/preprod/node.socket
export CARDANO_NODE_NETWORK_ID=1
export DYLD_FALLBACK_LIBRARY_PATH=$(pwd)/infra/node/bin


# Create credentials directory if it doesn't exist
if [ ! -d "infra/credentials/alice" ]; then
    mkdir -p infra/credentials/alice
fi

# Check and create Alice's node credentials
if [ -f "infra/credentials/alice/alice-node.vk" ] && [ -f "infra/credentials/alice/alice-node.sk" ] && [ -f "infra/credentials/alice/alice-node.addr" ]; then
    echo "Alice's node credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file infra/credentials/alice/alice-node.vk \
      --signing-key-file infra/credentials/alice/alice-node.sk

    cardano-cli address build \
      --verification-key-file infra/credentials/alice/alice-node.vk \
      --out-file infra/credentials/alice/alice-node.addr
fi

# Check and create Alice's funds credentials
if [ -f "infra/credentials/alice/alice-funds.vk" ] && [ -f "infra/credentials/alice/alice-funds.sk" ] && [ -f "infra/credentials/alice/alice-funds.addr" ]; then
    echo "Alice's funds credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file infra/credentials/alice/alice-funds.vk \
      --signing-key-file infra/credentials/alice/alice-funds.sk

    cardano-cli address build \
      --verification-key-file infra/credentials/alice/alice-funds.vk \
      --out-file infra/credentials/alice/alice-funds.addr
fi

if [ ! -d "infra/credentials/bob" ]; then
    mkdir -p infra/credentials/bob
fi

# Check and create Bob's node credentials
if [ -f "infra/credentials/bob/bob-node.vk" ] && [ -f "infra/credentials/bob/bob-node.sk" ] && [ -f "infra/credentials/bob/bob-node.addr" ]; then
    echo "Bob's node credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file infra/credentials/bob/bob-node.vk \
      --signing-key-file infra/credentials/bob/bob-node.sk

    cardano-cli address build \
      --verification-key-file infra/credentials/bob/bob-node.vk \
      --out-file infra/credentials/bob/bob-node.addr
fi

# Check and create Bob's funds credentials
if [ -f "infra/credentials/bob/bob-funds.vk" ] && [ -f "infra/credentials/bob/bob-funds.sk" ] && [ -f "infra/credentials/bob/bob-funds.addr" ]; then
    echo "Bob's funds credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file infra/credentials/bob/bob-funds.vk \
      --signing-key-file infra/credentials/bob/bob-funds.sk

    cardano-cli address build \
      --verification-key-file infra/credentials/bob/bob-funds.vk \
      --out-file infra/credentials/bob/bob-funds.addr
fi

if [ ! -d "infra/txs" ]; then
    mkdir -p infra/txs
fi


# Get funding wallet UTxO state
cardano-cli query utxo \
    --address $(cat infra/credentials/funding/funding-wallet.addr) \
    --out-file infra/txs/funding-wallet-utxo.json

# Build a Tx to send funds from `funding-wallet` to the others who need them
cardano-cli conway transaction build \
    $(cat infra/txs/funding-wallet-utxo.json | jq -j 'to_entries[].key | "--tx-in ", ., " "') \
    --change-address $(cat infra/credentials/funding/funding-wallet.addr) \
    --tx-out $(cat infra/credentials/alice/alice-funds.addr)+1000000000 \
    --tx-out $(cat infra/credentials/alice/alice-node.addr)+1000000000 \
    --tx-out $(cat infra/credentials/bob/bob-funds.addr)+1000000000 \
    --tx-out $(cat infra/credentials/bob/bob-node.addr)+1000000000 \
    --out-file infra/txs/funding-tx.json

cardano-cli conway transaction sign \
  --tx-file infra/txs/funding-tx.json \
  --signing-key-file infra/credentials/funding/funding-wallet.sk \
  --out-file infra/txs/funding-tx-signed.json

cardano-cli conway transaction submit --tx-file infra/txs/funding-tx-signed.json