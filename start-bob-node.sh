#!/bin/bash

# Set environment variables
export PATH=$(pwd)/infra/node/bin:$PATH
export CARDANO_NODE_SOCKET_PATH=$(pwd)/infra/node/preprod/node.socket
export CARDANO_NODE_NETWORK_ID=1
export DYLD_FALLBACK_LIBRARY_PATH=$(pwd)/infra/node/bin

if [ ! -d "infra/persistence" ]; then
    mkdir -p infra/persistence
fi

hydra_version=0.20.0
hydra-node \
  --node-id "bob-node" \
  --persistence-dir infra/persistence/persistence-bob \
  --cardano-signing-key infra/credentials/bob/bob-node.sk \
  --hydra-signing-key infra/credentials/bob/bob-hydra.sk \
  --hydra-scripts-tx-id $(curl https://raw.githubusercontent.com/cardano-scaling/hydra/master/networks.json | jq -r ".preprod.\"${hydra_version}\"") \
  --ledger-protocol-parameters infra/params/protocol-parameters.json \
  --testnet-magic 1 \
  --node-socket $(pwd)/infra/node/preprod/node.socket \
  --api-port 4002 \
  --host 0.0.0.0 \
  --api-host 0.0.0.0 \
  --port 5002 \
  --peer 127.0.0.1:5001 \
  --hydra-verification-key infra/credentials/alice/alice-hydra.vk \
  --cardano-verification-key infra/credentials/alice/alice-node.vk