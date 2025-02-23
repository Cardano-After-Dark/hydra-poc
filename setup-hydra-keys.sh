#!/bin/bash

# Set environment variables
export PATH=$(pwd)/infra/node/bin:$PATH
export CARDANO_NODE_SOCKET_PATH=$(pwd)/infra/node/preprod/node.socket
export CARDANO_NODE_NETWORK_ID=1
export DYLD_FALLBACK_LIBRARY_PATH=$(pwd)/infra/node/bin

# Check if libiconv is already installed
if ! brew list libiconv &>/dev/null; then
    echo "Installing libiconv..."
    brew install libiconv
fi

# Check if symlink already exists before creating it
if [ ! -L "$(pwd)/infra/node/bin/libiconv.2.dylib" ]; then
    ln -s /opt/homebrew/opt/libiconv/lib/libiconv.2.dylib $(pwd)/infra/node/bin/libiconv.2.dylib
fi

# Create credentials directory if it doesn't exist
if [ ! -d "infra/credentials/alice" ]; then
    mkdir -p infra/credentials/alice
fi

# Generate Hydra key pairs for use on layer 2 if they don't exist
if [ ! -f "infra/credentials/alice/alice-hydra.sk" ]; then
    hydra-node gen-hydra-key --output-file infra/credentials/alice/alice-hydra
else
    echo "Alice's Hydra keys already exist, skipping generation"
fi

# Create credentials directory if it doesn't exist
if [ ! -d "infra/credentials/bob" ]; then
    mkdir -p infra/credentials/bob
fi


if [ ! -f "infra/credentials/bob/bob-hydra.sk" ]; then
    hydra-node gen-hydra-key --output-file infra/credentials/bob/bob-hydra
else
    echo "Bob's Hydra keys already exist, skipping generation"
fi

if [ ! -d "infra/params" ]; then
    mkdir -p infra/params
fi

# Generate protocol parameters
#    - Adjusts the fees and pricing mechanisms to zero, ensuring that transactions within the Hydra head incur no costs.
cardano-cli query protocol-parameters \
  | jq '.txFeeFixed = 0 |.txFeePerByte = 0 | .executionUnitPrices.priceMemory = 0 | .executionUnitPrices.priceSteps = 0' \
  > infra/params/protocol-parameters.json