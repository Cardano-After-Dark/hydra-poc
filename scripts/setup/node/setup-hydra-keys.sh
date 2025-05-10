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

# Check if libiconv is already installed
if ! brew list libiconv &>/dev/null; then
    echo "Installing libiconv..."
    brew install libiconv
fi

# Check if symlink already exists before creating it
if [ ! -L "${NODE_DIR}/bin/libiconv.2.dylib" ]; then
    ln -s /opt/homebrew/opt/libiconv/lib/libiconv.2.dylib ${NODE_DIR}/bin/libiconv.2.dylib
fi

# Create credentials directory if it doesn't exist
if [ ! -d "${CREDENTIALS_DIR}/alice" ]; then
    mkdir -p ${CREDENTIALS_DIR}/alice
fi

# Generate Hydra key pairs for use on layer 2 if they don't exist
if [ ! -f "${CREDENTIALS_DIR}/alice/alice-hydra.sk" ]; then
    hydra-node gen-hydra-key --output-file ${CREDENTIALS_DIR}/alice/alice-hydra
else
    echo "Alice's Hydra keys already exist, skipping generation"
fi

# Create credentials directory if it doesn't exist
if [ ! -d "${CREDENTIALS_DIR}/bob" ]; then
    mkdir -p ${CREDENTIALS_DIR}/bob
fi

if [ ! -f "${CREDENTIALS_DIR}/bob/bob-hydra.sk" ]; then
    hydra-node gen-hydra-key --output-file ${CREDENTIALS_DIR}/bob/bob-hydra
else
    echo "Bob's Hydra keys already exist, skipping generation"
fi

if [ ! -d "${PARAMS_DIR}" ]; then
    mkdir -p ${PARAMS_DIR}
fi

# Generate protocol parameters
#    - Adjusts the fees and pricing mechanisms to zero, ensuring that transactions within the Hydra head incur no costs.
cardano-cli query protocol-parameters \
  | jq '.txFeeFixed = 0 |.txFeePerByte = 0 | .executionUnitPrices.priceMemory = 0 | .executionUnitPrices.priceSteps = 0' \
  > ${PARAMS_DIR}/protocol-parameters.json