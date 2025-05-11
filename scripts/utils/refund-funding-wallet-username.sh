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

# Prompt for username instead of taking it as an argument
read -p "Enter username: " USERNAME

cardano-cli query utxo \
  --address $(cat ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.addr) \
  --address $(cat ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.addr) \
  --out-file ${TXS_DIR}/${USERNAME}-return-utxo.json

cardano-cli conway transaction build \
  $(cat ${TXS_DIR}/${USERNAME}-return-utxo.json | jq -j 'to_entries[].key | "--tx-in ", ., " "') \
  --change-address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) \
  --out-file ${TXS_DIR}/${USERNAME}-return-tx.json

cardano-cli conway transaction sign \
  --tx-file ${TXS_DIR}/${USERNAME}-return-tx.json \
  --signing-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.sk \
  --signing-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.sk \
  --out-file ${TXS_DIR}/${USERNAME}-return-tx-signed.json

cardano-cli conway transaction submit --tx-file ${TXS_DIR}/${USERNAME}-return-tx-signed.json
