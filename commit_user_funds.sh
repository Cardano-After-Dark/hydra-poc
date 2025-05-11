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

if [ ! -d "${TXS_DIR}" ]; then
    mkdir -p ${TXS_DIR}
fi

cardano-cli query utxo \
  --address $(cat ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.addr) \
  --out-file ${TXS_DIR}/${USERNAME}-commit-utxo.json

curl -X POST 127.0.0.1:${MY_API_PORT}/commit \
  --data @${TXS_DIR}/${USERNAME}-commit-utxo.json \
  > ${TXS_DIR}/${USERNAME}-commit-tx.json

cardano-cli conway transaction sign \
  --tx-file ${TXS_DIR}/${USERNAME}-commit-tx.json \
  --signing-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.sk \
  --out-file ${TXS_DIR}/${USERNAME}-commit-tx-signed.json

cardano-cli conway transaction submit --tx-file ${TXS_DIR}/${USERNAME}-commit-tx-signed.json
