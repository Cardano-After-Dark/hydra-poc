#!/bin/bash

# Set environment variables
export PATH=$(pwd)/infra/node/bin:$PATH
export CARDANO_NODE_SOCKET_PATH=$(pwd)/infra/node/preprod/node.socket
export CARDANO_NODE_NETWORK_ID=1
export DYLD_FALLBACK_LIBRARY_PATH=$(pwd)/infra/node/bin

# Function to check if funding wallet has sufficient funds
check_funding_wallet() {
    echo "Checking funding wallet balance..."
    BALANCE=$(cardano-cli query utxo --address $(cat infra/credentials/funding/funding-wallet.addr) | tail -n +3 | awk '{sum += $3} END {print sum}')
    
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
./setup-funding-credentials.sh
if [ $? -ne 0 ]; then
    echo "Error setting up funding credentials"
    exit 1
fi

# Step 2: Wait for funds to be available
echo "Waiting for funds to be available in funding wallet..."
echo "Please fund the wallet using the Cardano Testnet Faucet"
echo "Address: $(cat infra/credentials/funding/funding-wallet.addr)"

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
    ./setup-node-credentials.sh
fi

# Display current balances
echo "# UTxO of alice-node"
cardano-cli query utxo --address $(cat infra/credentials/alice/alice-node.addr) --out-file /dev/stdout | jq

echo "# UTxO of alice-funds"
cardano-cli query utxo --address $(cat infra/credentials/alice/alice-funds.addr) --out-file /dev/stdout | jq

echo "# UTxO of bob-node"
cardano-cli query utxo --address $(cat infra/credentials/bob/bob-node.addr) --out-file /dev/stdout | jq

echo "# UTxO of bob-funds"
cardano-cli query utxo --address $(cat infra/credentials/bob/bob-funds.addr) --out-file /dev/stdout | jq

echo "Setup complete! Node wallets have been created and funded." 

# Check if libiconv is already installed
if ! brew list libiconv &>/dev/null; then
    echo "Installing libiconv..."
    brew install libiconv
fi

# Check if symlink already exists before creating it
if [ ! -L "$(pwd)/infra/node/bin/libiconv.2.dylib" ]; then
    ln -s /opt/homebrew/opt/libiconv/lib/libiconv.2.dylib $(pwd)/infra/node/bin/libiconv.2.dylib
fi

# Create credentials directory if it doesn't exist
if [ ! -d "infra/credentials/alice" ]; then
    mkdir -p infra/credentials/alice
fi

# Generate Hydra key pairs for use on layer 2 if they don't exist
if [ ! -f "infra/credentials/alice/alice-hydra.sk" ]; then
    hydra-node gen-hydra-key --output-file infra/credentials/alice/alice-hydra
else
    echo "Alice's Hydra keys already exist, skipping generation"
fi

# Create credentials directory if it doesn't exist
if [ ! -d "infra/credentials/bob" ]; then
    mkdir -p infra/credentials/bob
fi


if [ ! -f "infra/credentials/bob/bob-hydra.sk" ]; then
    hydra-node gen-hydra-key --output-file infra/credentials/bob/bob-hydra
else
    echo "Bob's Hydra keys already exist, skipping generation"
fi

if [ ! -d "infra/params" ]; then
    mkdir -p infra/params
fi

# Generate protocol parameters
#    - Adjusts the fees and pricing mechanisms to zero, ensuring that transactions within the Hydra head incur no costs.
cardano-cli query protocol-parameters \
  | jq '.txFeeFixed = 0 |.txFeePerByte = 0 | .executionUnitPrices.priceMemory = 0 | .executionUnitPrices.priceSteps = 0' \
  > infra/params/protocol-parameters.json

echo "Protocol parameters generated successfully!"

echo "Setup complete! Node wallets have been created and funded." 
echo "You can now start hydra-node for alice and bob."

