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

# Create credentials directory if it doesn't exist
if [ ! -d "${CREDENTIALS_DIR}/alice" ]; then
    mkdir -p ${CREDENTIALS_DIR}/alice
fi

# Check and create Alice's node credentials
if [ -f "${CREDENTIALS_DIR}/alice/alice-node.vk" ] && [ -f "${CREDENTIALS_DIR}/alice/alice-node.sk" ] && [ -f "${CREDENTIALS_DIR}/alice/alice-node.addr" ]; then
    echo "Alice's node credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file ${CREDENTIALS_DIR}/alice/alice-node.vk \
      --signing-key-file ${CREDENTIALS_DIR}/alice/alice-node.sk

    cardano-cli address build \
      --verification-key-file ${CREDENTIALS_DIR}/alice/alice-node.vk \
      --out-file ${CREDENTIALS_DIR}/alice/alice-node.addr
fi

# Check and create Alice's funds credentials
if [ -f "${CREDENTIALS_DIR}/alice/alice-funds.vk" ] && [ -f "${CREDENTIALS_DIR}/alice/alice-funds.sk" ] && [ -f "${CREDENTIALS_DIR}/alice/alice-funds.addr" ]; then
    echo "Alice's funds credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file ${CREDENTIALS_DIR}/alice/alice-funds.vk \
      --signing-key-file ${CREDENTIALS_DIR}/alice/alice-funds.sk

    cardano-cli address build \
      --verification-key-file ${CREDENTIALS_DIR}/alice/alice-funds.vk \
      --out-file ${CREDENTIALS_DIR}/alice/alice-funds.addr
fi

if [ ! -d "${CREDENTIALS_DIR}/bob" ]; then
    mkdir -p ${CREDENTIALS_DIR}/bob
fi

# Check and create Bob's node credentials
if [ -f "${CREDENTIALS_DIR}/bob/bob-node.vk" ] && [ -f "${CREDENTIALS_DIR}/bob/bob-node.sk" ] && [ -f "${CREDENTIALS_DIR}/bob/bob-node.addr" ]; then
    echo "Bob's node credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file ${CREDENTIALS_DIR}/bob/bob-node.vk \
      --signing-key-file ${CREDENTIALS_DIR}/bob/bob-node.sk

    cardano-cli address build \
      --verification-key-file ${CREDENTIALS_DIR}/bob/bob-node.vk \
      --out-file ${CREDENTIALS_DIR}/bob/bob-node.addr
fi

# Check and create Bob's funds credentials
if [ -f "${CREDENTIALS_DIR}/bob/bob-funds.vk" ] && [ -f "${CREDENTIALS_DIR}/bob/bob-funds.sk" ] && [ -f "${CREDENTIALS_DIR}/bob/bob-funds.addr" ]; then
    echo "Bob's funds credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file ${CREDENTIALS_DIR}/bob/bob-funds.vk \
      --signing-key-file ${CREDENTIALS_DIR}/bob/bob-funds.sk

    cardano-cli address build \
      --verification-key-file ${CREDENTIALS_DIR}/bob/bob-funds.vk \
      --out-file ${CREDENTIALS_DIR}/bob/bob-funds.addr
fi

if [ ! -d "${TXS_DIR}" ]; then
    mkdir -p ${TXS_DIR}
fi

# Get funding wallet UTxO state
cardano-cli query utxo \
    --address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) \
    --out-file ${TXS_DIR}/funding-wallet-utxo.json

# Build a Tx to send funds from `funding-wallet` to the others who need them
cardano-cli conway transaction build \
    $(cat ${TXS_DIR}/funding-wallet-utxo.json | jq -j 'to_entries[].key | "--tx-in ", ., " "') \
    --change-address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) \
    --tx-out $(cat ${CREDENTIALS_DIR}/alice/alice-funds.addr)+1000000000 \
    --tx-out $(cat ${CREDENTIALS_DIR}/alice/alice-node.addr)+1000000000 \
    --tx-out $(cat ${CREDENTIALS_DIR}/bob/bob-funds.addr)+1000000000 \
    --tx-out $(cat ${CREDENTIALS_DIR}/bob/bob-node.addr)+1000000000 \
    --out-file ${TXS_DIR}/funding-tx.json

cardano-cli conway transaction sign \
  --tx-file ${TXS_DIR}/funding-tx.json \
  --signing-key-file ${CREDENTIALS_DIR}/funding/funding-wallet.sk \
  --out-file ${TXS_DIR}/funding-tx-signed.json

cardano-cli conway transaction submit --tx-file ${TXS_DIR}/funding-tx-signed.json