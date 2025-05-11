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

# Prompt for username instead of taking it as an argument
read -p "Enter username: " USERNAME

# Create credentials directory if it doesn't exist
if [ ! -d "${CREDENTIALS_DIR}/${USERNAME}" ]; then
    mkdir -p ${CREDENTIALS_DIR}/${USERNAME}
fi

# Check and create ${USERNAME}'s node credentials
if [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.vk" ] && [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.sk" ] && [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.addr" ]; then
    echo "${USERNAME}'s node credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.vk \
      --signing-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.sk

    cardano-cli address build \
      --verification-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.vk \
      --out-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.addr
fi


# Check and create ${USERNAME}'s funds credentials
if [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.vk" ] && [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.sk" ] && [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.addr" ]; then
    echo "${USERNAME}'s funds credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.vk \
      --signing-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.sk

    cardano-cli address build \
      --verification-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.vk \
      --out-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.addr
fi


wallet_name=funding-wallet

if [ ! -d "${CREDENTIALS_DIR}/funding" ]; then
    mkdir -p ${CREDENTIALS_DIR}/funding
fi

# Check if credentials already exist
if [ -f "${CREDENTIALS_DIR}/funding/$wallet_name.vk" ] && [ -f "${CREDENTIALS_DIR}/funding/$wallet_name.sk" ] && [ -f "${CREDENTIALS_DIR}/funding/$wallet_name.addr" ]; then
    echo "Funding credentials already exist. Skipping creation."
    echo ""
    echo "Existing wallet address for funding from the Cardano Testnet Faucet:"
    echo $(cat ${CREDENTIALS_DIR}/funding/$wallet_name.addr)
else
    mkdir -p ${CREDENTIALS_DIR}/funding
    
    cardano-cli address key-gen \
      --verification-key-file ${CREDENTIALS_DIR}/funding/$wallet_name.vk \
      --signing-key-file ${CREDENTIALS_DIR}/funding/$wallet_name.sk

    cardano-cli address build \
      --verification-key-file ${CREDENTIALS_DIR}/funding/$wallet_name.vk \
      --out-file ${CREDENTIALS_DIR}/funding/$wallet_name.addr

    echo ""
    echo "Request funding from the Cardano Testnet Faucet:"
    echo $(cat ${CREDENTIALS_DIR}/funding/$wallet_name.addr)
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


Get funding wallet UTxO state
cardano-cli query utxo \
    --address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) \
    --out-file ${TXS_DIR}/funding-wallet-utxo.json

# Build a Tx to send funds from `funding-wallet` to the others who need them
cardano-cli conway transaction build \
    $(cat ${TXS_DIR}/funding-wallet-utxo.json | jq -j 'to_entries[].key | "--tx-in ", ., " "') \
    --change-address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) \
    --tx-out $(cat ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.addr)+1000000000 \
    --tx-out $(cat ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.addr)+1000000000 \
    --out-file ${TXS_DIR}/funding-tx.json

cardano-cli conway transaction sign \
  --tx-file ${TXS_DIR}/funding-tx.json \
  --signing-key-file ${CREDENTIALS_DIR}/funding/funding-wallet.sk \
  --out-file ${TXS_DIR}/funding-tx-signed.json

cardano-cli conway transaction submit --tx-file ${TXS_DIR}/funding-tx-signed.json


# Check if libiconv is already installed
if ! brew list libiconv &>/dev/null; then
    echo "Installing libiconv..."
    brew install libiconv
fi

# Check if symlink already exists before creating it
if [ ! -L "${NODE_DIR}/bin/libiconv.2.dylib" ]; then
    ln -s /opt/homebrew/opt/libiconv/lib/libiconv.2.dylib ${NODE_DIR}/bin/libiconv.2.dylib
fi

# Generate Hydra key pairs for use on layer 2 if they don't exist
if [ ! -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-hydra.sk" ]; then
    hydra-node gen-hydra-key --output-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-hydra
    echo "Hydra keys generated for ${USERNAME}"
else
    echo "${USERNAME}'s Hydra keys already exist, skipping generation"
fi


# HYDRA_SCRIPTS_TX_ID=$(curl https://raw.githubusercontent.com/cardano-scaling/hydra/master/networks.json | jq -r ".preprod.\"${HYDRA_VERSION}\"")

# hydra-node \
#   --node-id "mynode-node" \
#   --persistence-dir "${PERSISTENCE_DIR}/persistence-${USERNAME}" \
#   --cardano-signing-key "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.sk" \
#   --hydra-signing-key "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-hydra.sk" \
#   --hydra-scripts-tx-id "${HYDRA_SCRIPTS_TX_ID}" \
#   --ledger-protocol-parameters "${PARAMS_DIR}/protocol-parameters.json" \
#   --testnet-magic "${TESTNET_MAGIC}" \
#   --node-socket "${CARDANO_NODE_SOCKET_PATH}" \
#   --api-port "${${USERNAME}_API_PORT}" \
#   --host 0.0.0.0 \
#   --api-host 0.0.0.0 \
#   --port "${${USERNAME}_PORT}" \
#   --peer "${PEER_NODE_IP}:${PEER_NODE_PORT}" \
#   --hydra-verification-key "${CREDENTIALS_DIR}/bob/bob-hydra.vk" \
#   --cardano-verification-key "${CREDENTIALS_DIR}/bob/bob-node.vk"

