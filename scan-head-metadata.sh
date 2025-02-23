#!/bin/bash

# Set environment variables
export PATH=$(pwd)/node/bin:$PATH
export CARDANO_NODE_SOCKET_PATH=$(pwd)/node/preprod/node.socket
export CARDANO_NODE_NETWORK_ID=1
export DYLD_FALLBACK_LIBRARY_PATH=$(pwd)/node/bin

# monitor-hydra-metadata.sh - Monitor Hydra head for metadata messages
NODE_PORT=4002  # Use 4001 for Alice, 4002 for Bob
METADATA_LABEL=1337  # The label we're interested in

echo "Monitoring Hydra head for metadata with label $METADATA_LABEL..."
echo "Press Ctrl+C to stop"

websocat ws://127.0.0.1:$NODE_PORT | \
while read -r line; do
#   # Check if this is a SnapshotConfirmed message with transactions
#   if echo "$line" | jq -e '.tag == "SnapshotConfirmed" and .snapshot.confirmed != null' > /dev/null; then
#     echo "$line" | jq -r '.snapshot.confirmed[] | select(.cborHex | contains("d90103")) | .cborHex' | \
#     while read -r tx_cbor; do
#       if [ ! -z "$tx_cbor" ]; then
#         echo "----------------------------------------"
#         echo "Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
#         echo "Decoded Metadata:"
#         echo "$tx_cbor" 
#       fi
#     done
#   fi
  
  # Check if this is a TxValid message
  if echo "$line" | jq -e '.tag == "TxValid"' > /dev/null; then
    tx_cbor=$(echo "$line" | jq -r 'select(.transaction.cborHex | contains("d90103")) | .transaction.cborHex')
    if [ ! -z "$tx_cbor" ]; then
      echo "----------------------------------------"
      echo "Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
      echo "Decoded Metadata:"
      echo "$tx_cbor" 
    fi
  fi
done