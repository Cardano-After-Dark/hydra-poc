#!/bin/bash

# Source environment variables with debug output
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

# Check if the database directory exists

if [ ! -d "${NODE_DIR}/${NETWORK}/db" ]; then
    echo "First-time setup: Downloading blockchain snapshot..."
    cd "${NODE_DIR}/${NETWORK}" && mithril-client cardano-db download latest
else
    echo "Database already exists, skipping download..."
fi

# Start the Cardano node
echo "Starting Cardano node..."
cardano-node run \
  --topology ${NODE_DIR}/${NETWORK}/topology.json \
  --database-path ${NODE_DIR}/${NETWORK}/db \
  --socket-path ${NODE_DIR}/${NETWORK}/node.socket \
  --config ${NODE_DIR}/${NETWORK}/config.json