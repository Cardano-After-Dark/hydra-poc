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

# Navigate to preprod directory
cd ${NODE_DIR}/preprod

# Check if the database directory exists
if [ ! -d "db" ]; then
    echo "First-time setup: Downloading blockchain snapshot..."
    mithril-client cardano-db download latest
else
    echo "Database already exists, skipping download..."
fi

# Start the Cardano node
echo "Starting Cardano node..."
cardano-node run \
  --topology topology.json \
  --database-path db \
  --socket-path node.socket \
  --config config.json