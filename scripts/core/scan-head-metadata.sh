#!/bin/bash

# Source environment variables
if [[ -f ".env" ]]; then
    source .env
elif [[ -f "../.env" ]]; then
    source ../.env
else
    echo "Error: .env file not found. Please run scripts/utils/set-env-vars.sh first"
    exit 1
fi

NODE_PORT=${BOB_API_PORT}  # Use ALICE_API_PORT for Alice, BOB_API_PORT for Bob
METADATA_LABEL=1337  # The label we're interested in

echo "Monitoring Hydra head for metadata with label $METADATA_LABEL..."
echo "Press Ctrl+C to stop"

websocat ws://127.0.0.1:$NODE_PORT | \
while read -r line; do
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