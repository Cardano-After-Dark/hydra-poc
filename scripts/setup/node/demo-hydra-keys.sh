#!/bin/bash

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
