#!/bin/bash

# Set environment variables
export PATH=$(pwd)/infra/node/bin:$PATH
export CARDANO_NODE_SOCKET_PATH=$(pwd)/infra/node/preprod/node.socket
export CARDANO_NODE_NETWORK_ID=1
export DYLD_FALLBACK_LIBRARY_PATH=$(pwd)/infra/node/bin

if [ ! -d "infra/txs" ]; then
    mkdir -p infra/txs
fi

cardano-cli query utxo \
  --address $(cat infra/credentials/alice/alice-funds.addr) \
  --out-file infra/txs/alice-commit-utxo.json

curl -X POST 127.0.0.1:4001/commit \
  --data @infra/txs/alice-commit-utxo.json \
  > infra/txs/alice-commit-tx.json

cardano-cli conway transaction sign \
  --tx-file infra/txs/alice-commit-tx.json \
  --signing-key-file infra/credentials/alice/alice-funds.sk \
  --out-file infra/txs/alice-commit-tx-signed.json

cardano-cli conway transaction submit --tx-file infra/txs/alice-commit-tx-signed.json

cardano-cli query utxo \
  --address $(cat infra/credentials/bob/bob-funds.addr) \
  --out-file infra/txs/bob-commit-utxo.json

curl -X POST 127.0.0.1:4002/commit \
  --data @infra/txs/bob-commit-utxo.json \
  > infra/txs/bob-commit-tx.json

cardano-cli conway transaction sign \
  --tx-file infra/txs/bob-commit-tx.json \
  --signing-key-file infra/credentials/bob/bob-funds.sk \
  --out-file infra/txs/bob-commit-tx-signed.json

cardano-cli conway transaction submit --tx-file infra/txs/bob-commit-tx-signed.json