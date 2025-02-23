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
  --node-id "alice-node" \
  --persistence-dir infra/persistence/persistence-alice \
  --cardano-signing-key infra/credentials/alice/alice-node.sk \
  --hydra-signing-key infra/credentials/alice/alice-hydra.sk \
  --hydra-scripts-tx-id $(curl https://raw.githubusercontent.com/cardano-scaling/hydra/master/networks.json | jq -r ".preprod.\"${hydra_version}\"") \
  --ledger-protocol-parameters infra/params/protocol-parameters.json \
  --testnet-magic 1 \
  --node-socket $(pwd)/infra/node/preprod/node.socket \
  --api-port 4001 \
  --host 0.0.0.0 \
  --api-host 0.0.0.0 \
  --port 5001 \
  --peer 127.0.0.1:5002 \
  --hydra-verification-key infra/credentials/bob/bob-hydra.vk \
  --cardano-verification-key infra/credentials/bob/bob-node.vk