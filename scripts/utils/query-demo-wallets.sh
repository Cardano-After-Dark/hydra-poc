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

echo "# UTxO of alice-node"
cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/alice/alice-node.addr) --out-file /dev/stdout | jq

echo "# UTxO of alice-funds"
cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/alice/alice-funds.addr) --out-file /dev/stdout | jq

echo "# UTxO of bob-node"
cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/bob/bob-node.addr) --out-file /dev/stdout | jq

echo "# UTxO of bob-funds"
cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/bob/bob-funds.addr) --out-file /dev/stdout | jq