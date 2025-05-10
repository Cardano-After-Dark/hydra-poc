#!/bin/bash

# Check if environment variables are already set
if [[ -z "${PROJECT_ROOT}" ]]; then
    if [[ -f ".env" ]]; then
        echo "Found .env file in current directory"
        set -a  # automatically export all variables
        source .env
        set +a
    elif [[ -f "../.env" ]]; then
        echo "Found .env file in parent directory"
        set -a  # automatically export all variables
        source ../.env
        set +a
    else
        echo "Error: .env file not found. Please run scripts/utils/set-env-vars.sh first"
        exit 1
    fi
fi

cardano-cli query utxo \
  --address $(cat ${CREDENTIALS_DIR}/alice/alice-node.addr) \
  --address $(cat ${CREDENTIALS_DIR}/alice/alice-funds.addr) \
  --out-file ${TXS_DIR}/alice-return-utxo.json

cardano-cli conway transaction build \
  $(cat ${TXS_DIR}/alice-return-utxo.json | jq -j 'to_entries[].key | "--tx-in ", ., " "') \
  --change-address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) \
  --out-file ${TXS_DIR}/alice-return-tx.json

cardano-cli conway transaction sign \
  --tx-file ${TXS_DIR}/alice-return-tx.json \
  --signing-key-file ${CREDENTIALS_DIR}/alice/alice-node.sk \
  --signing-key-file ${CREDENTIALS_DIR}/alice/alice-funds.sk \
  --out-file ${TXS_DIR}/alice-return-tx-signed.json

cardano-cli conway transaction submit --tx-file ${TXS_DIR}/alice-return-tx-signed.json

cardano-cli query utxo \
  --address $(cat ${CREDENTIALS_DIR}/bob/bob-node.addr) \
  --address $(cat ${CREDENTIALS_DIR}/bob/bob-funds.addr) \
  --out-file ${TXS_DIR}/bob-return-utxo.json

cardano-cli conway transaction build \
  $(cat ${TXS_DIR}/bob-return-utxo.json | jq -j 'to_entries[].key | "--tx-in ", ., " "') \
  --change-address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) \
  --out-file ${TXS_DIR}/bob-return-tx.json

cardano-cli conway transaction sign \
  --tx-file ${TXS_DIR}/bob-return-tx.json \
  --signing-key-file ${CREDENTIALS_DIR}/bob/bob-node.sk \
  --signing-key-file ${CREDENTIALS_DIR}/bob/bob-funds.sk \
  --out-file ${TXS_DIR}/bob-return-tx-signed.json

cardano-cli conway transaction submit --tx-file ${TXS_DIR}/bob-return-tx-signed.json