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

echo "# UTxO of ${USERNAME}-node"
cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.addr) --out-file /dev/stdout | jq

echo "# UTxO of ${USERNAME}-funds"
cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.addr) --out-file /dev/stdout | jq
