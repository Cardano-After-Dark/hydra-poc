#!/bin/bash

# Check if environment variables are already set
if [[ -z "${PROJECT_ROOT}" ]]; then
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
fi

# Default parameters
SENDER="alice"
RECEIVER="bob"
MESSAGE="Hello from Hydra!"
METADATA_LABEL="1337"
WEBSOCKET_PORT="4001"

# Process command-line options
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sender)
      SENDER="$2"
      shift 2
      ;;
    --message)
      MESSAGE="$2"
      shift 2
      ;;
    --metadata-label)
      METADATA_LABEL="$2"
      shift 2
      ;;
    --port)
      WEBSOCKET_PORT="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo "Options:"
      echo "  --sender VALUE         Sender name (alice or bob, default: alice)"
      echo "  --message VALUE        Message content (default: Hello from Hydra!)"
      echo "  --metadata-label VALUE Metadata label (default: 1337)"
      echo "  --port VALUE           WebSocket port (default: 4001 for alice, 4002 for bob)"
      echo "  --help                 Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Set port based on sender if not specified
if [[ "$WEBSOCKET_PORT" == "4001" && "$SENDER" == "bob" ]]; then
  WEBSOCKET_PORT="4002"
fi

# Credentials path
CRED_DIR="infra/credentials"

# Create metadata.json file
echo "Creating metadata with message: '$MESSAGE'"
cat > metadata.json << EOF
{
  "$METADATA_LABEL": {
    "message": "$MESSAGE",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "sender": "$SENDER",
    "recipient": "$RECEIVER"
  }
}
EOF

curl -s 127.0.0.1:4001/snapshot/utxo \
  | jq "with_entries(select(.value.address == \"$(cat ${CREDENTIALS_DIR}/${SENDER}/${SENDER}-funds.addr)\"))" \
  > ${TXS_DIR}/${SENDER}-utxos.json

# Get UTXO and calculate amounts
TX_IN=$(jq -r 'to_entries[0].key' < ${TXS_DIR}/${SENDER}-utxos.json)
TOTAL_AMOUNT=$(jq -r 'to_entries[0].value.value.lovelace' < ${TXS_DIR}/${SENDER}-utxos.json)
RECIPIENT_ADDR=$(cat ${CREDENTIALS_DIR}/${RECEIVER}/${RECEIVER}-funds.addr)
SEND_AMOUNT=1000000  # 1 ADA in Lovelace
CHANGE_AMOUNT=$((TOTAL_AMOUNT - SEND_AMOUNT))

# Build the transaction
echo "Building transaction..."
cardano-cli conway transaction build-raw \
  --tx-in $TX_IN \
  --tx-out $RECIPIENT_ADDR+$SEND_AMOUNT \
  --tx-out $(cat ${CREDENTIALS_DIR}/${SENDER}/${SENDER}-funds.addr)+$CHANGE_AMOUNT \
  --metadata-json-file metadata.json \
  --fee 0 \
  --out-file ${TXS_DIR}/tx.json

# Sign transaction
echo "Signing transaction..."
cardano-cli conway transaction sign \
  --tx-body-file ${TXS_DIR}/tx.json \
  --signing-key-file ${CREDENTIALS_DIR}/${SENDER}/${SENDER}-funds.sk \
  --out-file ${TXS_DIR}/tx-signed.json

# Format and submit to Hydra
echo "Submitting message to Hydra head..."
cat ${TXS_DIR}/tx-signed.json | jq -c '{tag: "NewTx", transaction: .}' | \
  websocat ws://127.0.0.1:$WEBSOCKET_PORT

echo "Message sent successfully!"
echo "The receiving node can view this message in their WebSocket stream"