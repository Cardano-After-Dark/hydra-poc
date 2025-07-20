#!/bin/bash

read -p "Enter username: " USERNAME

# Check if ${USERNAME} exists
if [ ! -d "${CREDENTIALS_DIR}/${USERNAME}" ]; then
    echo "Error: ${USERNAME} does not exist."
    exit 1
fi

# Check if there's a .env file in the project directory and compare username
if [ -f "${PROJECT_ROOT}/.env" ]; then
    # Extract existing username from .env file
    EXISTING_USERNAME=$(grep "^USERNAME=" "${PROJECT_ROOT}/.env" | cut -d '=' -f2)
    
    # Remove quotes if present
    EXISTING_USERNAME="${EXISTING_USERNAME//\"/}"
    EXISTING_USERNAME="${EXISTING_USERNAME//\'/}"
    
    # Compare with entered username
    if [ -n "$EXISTING_USERNAME" ] && [ "$EXISTING_USERNAME" != "$USERNAME" ]; then
        echo "Found different username in .env file: $EXISTING_USERNAME"
        read -p "Warning: you are requesting funds for a username that is different from the one in .env file. Do you want to continue? (y/n): " UPDATE_CHOICE
        
        if [[ "$UPDATE_CHOICE" =~ ^[Yy]$ ]]; then
          echo "Continuing with username: $USERNAME"
        else
          echo "Exiting script"
          exit 1
        fi
    fi
fi

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

if [ ! -d "${PERSISTENCE_DIR}/persistence-${USERNAME}" ]; then
    echo "Creating persistence directory: ${PERSISTENCE_DIR}/persistence-${USERNAME}"
    mkdir -p "${PERSISTENCE_DIR}/persistence-${USERNAME}"
fi


# Adjusts the fees and pricing mechanisms to zero, ensuring that transactions within the Hydra head incur no costs.
cardano-cli query protocol-parameters \
  | jq '.txFeeFixed = 0 |.txFeePerByte = 0 | .executionUnitPrices.priceMemory = 0 | .executionUnitPrices.priceSteps = 0' > ${PARAMS_DIR}/protocol-parameters.json

hydra-node \
  --node-id "${USERNAME}-node" \
  --persistence-dir "${PERSISTENCE_DIR}/persistence-${USERNAME}" \
  --cardano-signing-key "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.sk" \
  --hydra-signing-key "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-hydra.sk" \
  --hydra-scripts-tx-id "${HYDRA_SCRIPTS_TX_ID}" \
  --ledger-protocol-parameters "${PARAMS_DIR}/protocol-parameters.json" \
  --testnet-magic "${TESTNET_MAGIC}" \
  --node-socket "${CARDANO_NODE_SOCKET_PATH}" \
  --api-port "${MY_API_PORT}" \
  --host 0.0.0.0 \
  --api-host 0.0.0.0 \
  --port "${MY_PORT}" \
  --peer "${PEER_NODE_IP}:${PEER_NODE_PORT}" \
  --hydra-verification-key "${CREDENTIALS_DIR}/${PEER_USERNAME}/${PEER_USERNAME}-hydra.vk" \
  --cardano-verification-key "${CREDENTIALS_DIR}/${PEER_USERNAME}/${PEER_USERNAME}-node.vk"

