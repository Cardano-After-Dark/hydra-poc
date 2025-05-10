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

wallet_name=funding-wallet

if [ ! -d "${CREDENTIALS_DIR}/funding" ]; then
    mkdir -p ${CREDENTIALS_DIR}/funding
fi

# Check if credentials already exist
if [ -f "${CREDENTIALS_DIR}/funding/$wallet_name.vk" ] && [ -f "${CREDENTIALS_DIR}/funding/$wallet_name.sk" ] && [ -f "${CREDENTIALS_DIR}/funding/$wallet_name.addr" ]; then
    echo "Funding credentials already exist. Skipping creation."
    echo ""
    echo "Existing wallet address for funding from the Cardano Testnet Faucet:"
    echo $(cat ${CREDENTIALS_DIR}/funding/$wallet_name.addr)
else
    mkdir -p ${CREDENTIALS_DIR}/funding
    
    cardano-cli address key-gen \
      --verification-key-file ${CREDENTIALS_DIR}/funding/$wallet_name.vk \
      --signing-key-file ${CREDENTIALS_DIR}/funding/$wallet_name.sk

    cardano-cli address build \
      --verification-key-file ${CREDENTIALS_DIR}/funding/$wallet_name.vk \
      --out-file ${CREDENTIALS_DIR}/funding/$wallet_name.addr

    echo ""
    echo "Request funding from the Cardano Testnet Faucet:"
    echo $(cat ${CREDENTIALS_DIR}/funding/$wallet_name.addr)
fi