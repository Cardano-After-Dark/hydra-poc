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
WEBSOCKET_PORT="4001"

# Process command-line options
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sender)
      SENDER="$2"
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

# Prompt user for receiving address
echo "Enter the receiving address:"
read -r RECIPIENT_ADDR

# Validate that the address is not empty
if [[ -z "$RECIPIENT_ADDR" ]]; then
    echo "Error: Receiving address cannot be empty"
    exit 1
fi

# Prompt user for amount to send
echo "Enter the amount of ADA to send (e.g., 1.5 for 1.5 ADA):"
read -r ADA_AMOUNT

# Validate that the amount is not empty and is a valid number
if [[ -z "$ADA_AMOUNT" ]]; then
    echo "Error: Amount cannot be empty"
    exit 1
fi

# Check if the amount is a valid number
if ! [[ "$ADA_AMOUNT" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
    echo "Error: Invalid amount format. Please enter a valid number (e.g., 1.5)"
    exit 1
fi

# Convert ADA to Lovelace (1 ADA = 1,000,000 Lovelace)
SEND_AMOUNT=$(echo "$ADA_AMOUNT * 1000000" | bc)
SEND_AMOUNT=${SEND_AMOUNT%.*}  # Remove decimal part if any

echo "Sending $ADA_AMOUNT ADA ($SEND_AMOUNT Lovelace) to address: $RECIPIENT_ADDR"

# Credentials path
CRED_DIR="infra/credentials"

echo "Fetching UTXOs for $SENDER..."
curl -s 127.0.0.1:4001/snapshot/utxo \
  | jq "with_entries(select(.value.address == \"$(cat ${CREDENTIALS_DIR}/${SENDER}/${SENDER}-funds.addr)\"))" \
  > ${TXS_DIR}/${SENDER}-utxos.json

# Debug: Show all available UTXOs
echo "Available UTXOs for $SENDER:"
cat ${TXS_DIR}/${SENDER}-utxos.json | jq -r 'to_entries[] | "\(.key): \(.value.value.lovelace) Lovelace"'

# Check if we have any UTXOs
UTXO_COUNT=$(jq 'length' < ${TXS_DIR}/${SENDER}-utxos.json)
if [[ "$UTXO_COUNT" -eq 0 ]]; then
    echo "Error: No UTXOs found for $SENDER"
    exit 1
fi

echo "Found $UTXO_COUNT UTXO(s)"

# Find a UTXO with sufficient funds, or collect multiple UTXOs if needed
echo "Required amount: $SEND_AMOUNT Lovelace"

# First, try to find a single UTXO with sufficient funds
SUITABLE_UTXO=$(jq -r --argjson required "$SEND_AMOUNT" '
  to_entries[] | 
  select(.value.value.lovelace >= $required) | 
  .key
' < ${TXS_DIR}/${SENDER}-utxos.json | head -1)

if [[ -n "$SUITABLE_UTXO" ]]; then
    # Use single UTXO
    TX_IN="$SUITABLE_UTXO"
    TOTAL_AMOUNT=$(jq -r --arg utxo "$SUITABLE_UTXO" '.[$utxo].value.lovelace' < ${TXS_DIR}/${SENDER}-utxos.json)
    echo "Using single UTXO: $TX_IN with $TOTAL_AMOUNT Lovelace"
else
    # Need to combine multiple UTXOs
    echo "No single UTXO has sufficient funds. Combining multiple UTXOs..."
    
    # Get all UTXOs sorted by amount (descending)
    TX_INS_ARRAY=($(jq -r 'to_entries | sort_by(.value.value.lovelace) | reverse | .[].key' < ${TXS_DIR}/${SENDER}-utxos.json))
    AMOUNTS_ARRAY=($(jq -r 'to_entries | sort_by(.value.value.lovelace) | reverse | .[].value.value.lovelace' < ${TXS_DIR}/${SENDER}-utxos.json))
    
    # Collect UTXOs until we have enough
    TX_INS=()
    TOTAL_AMOUNT=0
    for i in "${!TX_INS_ARRAY[@]}"; do
        TX_INS+=("${TX_INS_ARRAY[$i]}")
        TOTAL_AMOUNT=$((TOTAL_AMOUNT + ${AMOUNTS_ARRAY[$i]}))
        echo "Adding UTXO: ${TX_INS_ARRAY[$i]} (${AMOUNTS_ARRAY[$i]} Lovelace) - Total: $TOTAL_AMOUNT Lovelace"
        
        if [[ "$TOTAL_AMOUNT" -ge "$SEND_AMOUNT" ]]; then
            break
        fi
    done
    
    # Check if we still don't have enough funds
    if [[ "$TOTAL_AMOUNT" -lt "$SEND_AMOUNT" ]]; then
        echo "Error: Insufficient total funds. Available: $TOTAL_AMOUNT Lovelace, Required: $SEND_AMOUNT Lovelace"
        exit 1
    fi
    
    # Convert array to space-separated string for cardano-cli
    TX_IN=$(printf " --tx-in %s" "${TX_INS[@]}")
    TX_IN=${TX_IN:8}  # Remove the leading " --tx-in "
    
    echo "Using ${#TX_INS[@]} UTXOs with total $TOTAL_AMOUNT Lovelace"
fi

# Check if there are sufficient funds
if [[ "$TOTAL_AMOUNT" -le "$SEND_AMOUNT" ]]; then
    echo "Error: Insufficient funds. Available: $TOTAL_AMOUNT Lovelace, Required: $SEND_AMOUNT Lovelace"
    exit 1
fi

CHANGE_AMOUNT=$((TOTAL_AMOUNT - SEND_AMOUNT))
echo "Change amount: $CHANGE_AMOUNT Lovelace"

# Build the transaction
echo "Building transaction..."
if [[ "$TX_IN" == *" "* ]]; then
    # Multiple UTXOs - need to construct the command differently
    TX_IN_FLAGS=""
    for utxo in $TX_IN; do
        TX_IN_FLAGS="$TX_IN_FLAGS --tx-in $utxo"
    done
    
    cardano-cli conway transaction build-raw \
      $TX_IN_FLAGS \
      --tx-out $RECIPIENT_ADDR+$SEND_AMOUNT \
      --tx-out $(cat ${CREDENTIALS_DIR}/${SENDER}/${SENDER}-funds.addr)+$CHANGE_AMOUNT \
      --fee 0 \
      --out-file ${TXS_DIR}/tx.json
else
    # Single UTXO
    cardano-cli conway transaction build-raw \
      --tx-in $TX_IN \
      --tx-out $RECIPIENT_ADDR+$SEND_AMOUNT \
      --tx-out $(cat ${CREDENTIALS_DIR}/${SENDER}/${SENDER}-funds.addr)+$CHANGE_AMOUNT \
      --fee 0 \
      --out-file ${TXS_DIR}/tx.json
fi

# Sign transaction
echo "Signing transaction..."
cardano-cli conway transaction sign \
  --tx-body-file ${TXS_DIR}/tx.json \
  --signing-key-file ${CREDENTIALS_DIR}/${SENDER}/${SENDER}-funds.sk \
  --out-file ${TXS_DIR}/tx-signed.json

# Format and submit to Hydra
echo "Submitting transaction to Hydra head..."
cat ${TXS_DIR}/tx-signed.json | jq -c '{tag: "NewTx", transaction: .}' | \
  websocat ws://127.0.0.1:$WEBSOCKET_PORT

echo "Transaction sent successfully!"