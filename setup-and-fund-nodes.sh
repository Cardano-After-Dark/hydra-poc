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

# Verify required environment variables
if [[ -z "${CREDENTIALS_DIR}" ]] || [[ -z "${NODE_DIR}" ]] || [[ -z "${PARAMS_DIR}" ]]; then
    echo "Error: Required environment variables are not set"
    echo "Please ensure your .env file contains CREDENTIALS_DIR, NODE_DIR, and PARAMS_DIR"
    exit 1
fi

# Function to check if funding wallet has sufficient funds
check_funding_wallet() {
    echo "Checking funding wallet balance..."
    BALANCE=$(cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) | tail -n +3 | awk '{sum += $3} END {print sum}')
    
    if [ -z "$BALANCE" ]; then
        BALANCE=0
    fi
    
    echo "Current balance: $BALANCE lovelace"
    # We need at least 4000000000 lovelace (4000 ADA) plus fees
    if [ "$BALANCE" -lt 4100000000 ]; then
        return 1
    fi
    return 0
}

# Step 1: Setup funding credentials
echo "Setting up funding credentials..."
./scripts/setup/funding/setup-funding-credentials.sh
if [ $? -ne 0 ]; then
    echo "Error setting up funding credentials"
    exit 1
fi

# Step 2: Wait for funds to be available
echo "Waiting for funds to be available in funding wallet..."
echo "Please fund the wallet using the Cardano Testnet Faucet"
echo "Address: $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr)"

ATTEMPTS=0
MAX_ATTEMPTS=30  # Will wait up to 5 minutes (30 * 10 seconds)
while ! check_funding_wallet; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ $ATTEMPTS -ge $MAX_ATTEMPTS ]; then
        echo "Timeout waiting for funds. Please fund the wallet and try again."
        exit 1
    fi
    echo "Insufficient funds. Checking again in 10 seconds... (Attempt $ATTEMPTS/$MAX_ATTEMPTS)"
    sleep 10
done

echo "Sufficient funds detected in funding wallet!"

# Function to check if a wallet has any ADA
check_wallet_balance() {
    local addr_file=$1
    local balance=$(cardano-cli query utxo --address $(cat $addr_file) --out-file /dev/stdout | jq '[.[]] | length')
    if [ "$balance" -gt 0 ]; then
        return 0  # has funds
    else
        return 1  # no funds
    fi
}

# Check all wallets
needs_funding=false
for wallet in "alice-node" "alice-funds" "bob-node" "bob-funds"; do
    if ! check_wallet_balance "infra/credentials/${wallet%%-*}/${wallet}.addr"; then
        echo "Warning: $wallet wallet has no funds"
        needs_funding=true
    fi
done

# Run setup-node-credentials if any wallet needs funding
if [ "$needs_funding" = true ]; then
    echo "Some wallets need funding. Running setup-node-credentials..."
    ./scripts/setup/node/setup-node-credentials.sh
fi

# Display current balances
echo "# UTxO of alice-node"
cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/alice/alice-node.addr) --out-file /dev/stdout | jq

echo "# UTxO of alice-funds"
cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/alice/alice-funds.addr) --out-file /dev/stdout | jq

echo "# UTxO of bob-node"
cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/bob/bob-node.addr) --out-file /dev/stdout | jq

echo "# UTxO of bob-funds"
cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/bob/bob-funds.addr) --out-file /dev/stdout | jq

echo "Setup complete! Node wallets have been created and funded." 

# Check if libiconv is already installed
if ! brew list libiconv &>/dev/null; then
    echo "Installing libiconv..."
    brew install libiconv
fi

# Check if symlink already exists before creating it
if [ ! -L "${NODE_DIR}/bin/libiconv.2.dylib" ]; then
    ln -s /opt/homebrew/opt/libiconv/lib/libiconv.2.dylib ${NODE_DIR}/bin/libiconv.2.dylib
fi

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

if [ ! -d "${PARAMS_DIR}" ]; then
    mkdir -p ${PARAMS_DIR}
fi

# Generate protocol parameters
#    - Adjusts the fees and pricing mechanisms to zero, ensuring that transactions within the Hydra head incur no costs.
cardano-cli query protocol-parameters \
  | jq '.txFeeFixed = 0 |.txFeePerByte = 0 | .executionUnitPrices.priceMemory = 0 | .executionUnitPrices.priceSteps = 0' \
  > ${PARAMS_DIR}/protocol-parameters.json

echo "Protocol parameters generated successfully!"

echo "Setup complete! Node wallets have been created and funded." 
echo "You can now start hydra-node for alice and bob."

