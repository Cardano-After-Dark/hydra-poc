#!/bin/bash

# Detect OS type
os_type=$(uname -s)

if [ "$os_type" = "Darwin" ]; then
    # macOS: Install and link libiconv via brew
    if ! brew list libiconv &>/dev/null; then
        echo "Installing libiconv via brew..."
        brew install libiconv
    fi
    
    # Check if symlink already exists before creating it
    if [ ! -L "${NODE_DIR}/bin/libiconv.2.dylib" ]; then
        ln -s /opt/homebrew/opt/libiconv/lib/libiconv.2.dylib ${NODE_DIR}/bin/libiconv.2.dylib
    fi
elif [ "$os_type" = "Linux" ]; then
    # Linux: Install libiconv via apt-get
    if ! dpkg -l libc6 &>/dev/null; then
        echo "Installing libc6 (includes iconv)..."
        sudo apt-get update
        sudo apt-get install -y libc6
    fi
    
    # On Linux, libiconv functionality is typically provided by glibc (libc6)
    # and is automatically available to applications, so no symlink is needed
fi

# Ensure required directories exist with explicit checks
if [ ! -d "${PARAMS_DIR}" ]; then
    echo "Creating parameters directory: ${PARAMS_DIR}"
    mkdir -p "${PARAMS_DIR}"
fi

if [ ! -d "${PERSISTENCE_DIR}/persistence-alice" ]; then
    echo "Creating persistence directory: ${PERSISTENCE_DIR}/persistence-alice"
    mkdir -p "${PERSISTENCE_DIR}/persistence-alice"
fi

# Adjusts the fees and pricing mechanisms to zero, ensuring that transactions within the Hydra head incur no costs.
cardano-cli query protocol-parameters \
  | jq '.txFeeFixed = 0 |.txFeePerByte = 0 | .executionUnitPrices.priceMemory = 0 | .executionUnitPrices.priceSteps = 0' > ${PARAMS_DIR}/protocol-parameters.json

hydra-node \
  --node-id "alice-node" \
  --persistence-dir "${PERSISTENCE_DIR}/persistence-alice" \
  --cardano-signing-key "${CREDENTIALS_DIR}/alice/alice-node.sk" \
  --hydra-signing-key "${CREDENTIALS_DIR}/alice/alice-hydra.sk" \
  --hydra-scripts-tx-id "${HYDRA_SCRIPTS_TX_ID}" \
  --ledger-protocol-parameters "${PARAMS_DIR}/protocol-parameters.json" \
  --testnet-magic "${TESTNET_MAGIC}" \
  --node-socket "${CARDANO_NODE_SOCKET_PATH}" \
  --api-port "${ALICE_API_PORT}" \
  --host 0.0.0.0 \
  --api-host 0.0.0.0 \
  --port "${ALICE_PORT}" \
  --peer "127.0.0.1:${BOB_PORT}" \
  --hydra-verification-key "${CREDENTIALS_DIR}/bob/bob-hydra.vk" \
  --cardano-verification-key "${CREDENTIALS_DIR}/bob/bob-node.vk"

