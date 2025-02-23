#!/bin/bash

# Set environment variables
export PATH=$(pwd)/infra/node/bin:$PATH
export GENESIS_VERIFICATION_KEY=$(curl https://raw.githubusercontent.com/input-output-hk/mithril/main/mithril-infra/configuration/release-preprod/genesis.vkey 2> /dev/null)
export AGGREGATOR_ENDPOINT=https://aggregator.release-preprod.api.mithril.network/aggregator
export CARDANO_NODE_SOCKET_PATH=$(pwd)/infra/node/preprod/node.socket
export CARDANO_NODE_NETWORK_ID=1
export DYLD_FALLBACK_LIBRARY_PATH=$(pwd)/infra/node/bin

# Navigate to preprod directory
cd infra/node/preprod

# Check if the database directory exists
if [ ! -d "db" ]; then
    echo "First-time setup: Downloading blockchain snapshot..."
    mithril-client cardano-db download latest
else
    echo "Database already exists, skipping download..."
fi

# Start the Cardano node
echo "Starting Cardano node..."
cardano-node run \
  --topology topology.json \
  --database-path db \
  --socket-path node.socket \
  --config config.json