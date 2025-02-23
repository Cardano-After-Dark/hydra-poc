#!/bin/bash

# Set environment variables
export PATH=$(pwd)/infra/node/bin:$PATH
export CARDANO_NODE_SOCKET_PATH=$(pwd)/infra/node/preprod/node.socket
export CARDANO_NODE_NETWORK_ID=1
export DYLD_FALLBACK_LIBRARY_PATH=$(pwd)/infra/node/bin

cardano-cli query utxo \
  --address $(cat infra/credentials/alice/alice-node.addr) \
  --address $(cat infra/credentials/alice/alice-funds.addr) \
  --out-file infra/txs/alice-return-utxo.json

cardano-cli conway transaction build \
  $(cat infra/txs/alice-return-utxo.json | jq -j 'to_entries[].key | "--tx-in ", ., " "') \
  --change-address $(cat infra/credentials/funding/funding-wallet.addr) \
  --out-file infra/txs/alice-return-tx.json

cardano-cli conway transaction sign \
  --tx-file infra/txs/alice-return-tx.json \
  --signing-key-file infra/credentials/alice/alice-node.sk \
  --signing-key-file infra/credentials/alice/alice-funds.sk \
  --out-file infra/txs/alice-return-tx-signed.json

cardano-cli conway transaction submit --tx-file infra/txs/alice-return-tx-signed.json

cardano-cli query utxo \
  --address $(cat infra/credentials/bob/bob-node.addr) \
  --address $(cat infra/credentials/bob/bob-funds.addr) \
  --out-file infra/txs/bob-return-utxo.json

cardano-cli conway transaction build \
  $(cat infra/txs/bob-return-utxo.json | jq -j 'to_entries[].key | "--tx-in ", ., " "') \
  --change-address $(cat infra/credentials/funding/funding-wallet.addr) \
  --out-file infra/txs/bob-return-tx.json

cardano-cli conway transaction sign \
  --tx-file infra/txs/bob-return-tx.json \
  --signing-key-file infra/credentials/bob/bob-node.sk \
  --signing-key-file infra/credentials/bob/bob-funds.sk \
  --out-file infra/txs/bob-return-tx-signed.json

cardano-cli conway transaction submit --tx-file infra/txs/bob-return-tx-signed.json