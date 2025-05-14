#!/bin/bash

# Check if the database directory exists

if [ ! -d "${NODE_DIR}/${NETWORK}/db" ]; then
    echo "First-time setup: Downloading blockchain snapshot..."
    cd "${NODE_DIR}/${NETWORK}" && mithril-client cardano-db download latest
else
    echo "Database already exists, skipping download..."
    read -p "Do you want remove the database? (y/n): " REMOVE_DB
    if [[ "$REMOVE_DB" =~ ^[Yy]$ ]]; then
        rm -rf ${NODE_DIR}/${NETWORK}/db
        echo "Database removed"
        cd "${NODE_DIR}/${NETWORK}" && mithril-client cardano-db download latest
    fi
fi

# Start the Cardano node
echo "Starting Cardano node..."
cardano-node run \
  --topology ${NODE_DIR}/${NETWORK}/topology.json \
  --database-path ${NODE_DIR}/${NETWORK}/db \
  --socket-path ${NODE_DIR}/${NETWORK}/node.socket \
  --config ${NODE_DIR}/${NETWORK}/config.json