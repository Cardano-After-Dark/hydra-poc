#!/bin/bash

# Create credentials directory if it doesn't exist
if [ ! -d "${CREDENTIALS_DIR}/alice" ]; then
    mkdir -p ${CREDENTIALS_DIR}/alice
fi

# Check and create Alice's node credentials
if [ -f "${CREDENTIALS_DIR}/alice/alice-node.vk" ] || [ -f "${CREDENTIALS_DIR}/alice/alice-node.sk" ] || [ -f "${CREDENTIALS_DIR}/alice/alice-node.addr" ]; then
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
if [ -f "${CREDENTIALS_DIR}/alice/alice-funds.vk" ] || [ -f "${CREDENTIALS_DIR}/alice/alice-funds.sk" ] || [ -f "${CREDENTIALS_DIR}/alice/alice-funds.addr" ]; then
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
if [ -f "${CREDENTIALS_DIR}/bob/bob-node.vk" ] || [ -f "${CREDENTIALS_DIR}/bob/bob-node.sk" ] || [ -f "${CREDENTIALS_DIR}/bob/bob-node.addr" ]; then
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
if [ -f "${CREDENTIALS_DIR}/bob/bob-funds.vk" ] || [ -f "${CREDENTIALS_DIR}/bob/bob-funds.sk" ] || [ -f "${CREDENTIALS_DIR}/bob/bob-funds.addr" ]; then
    echo "Bob's funds credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file ${CREDENTIALS_DIR}/bob/bob-funds.vk \
      --signing-key-file ${CREDENTIALS_DIR}/bob/bob-funds.sk

    cardano-cli address build \
      --verification-key-file ${CREDENTIALS_DIR}/bob/bob-funds.vk \
      --out-file ${CREDENTIALS_DIR}/bob/bob-funds.addr
fi
