#!/bin/bash

wallet_name=funding-wallet

if [ ! -d "${CREDENTIALS_DIR}/funding" ]; then
    mkdir -p ${CREDENTIALS_DIR}/funding
fi

# Check and create ${USERNAME}'s funds credentials
if [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.vk" ] || [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.sk" ] || [ -f "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.addr" ]; then
    echo "${USERNAME}'s funds credentials already exist. Skipping creation."
else
    cardano-cli address key-gen \
      --verification-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.vk \
      --signing-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.sk

    cardano-cli address build \
      --verification-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.vk \
      --out-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.addr

    echo ""
    echo "Request funding from the Cardano Testnet Faucet to:"
    echo $(cat ${CREDENTIALS_DIR}/funding/$wallet_name.addr)
    echo "Faucet: https://docs.cardano.org/cardano-testnets/tools/faucet/"
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

# Get funding wallet UTxO state
cardano-cli query utxo \
    --address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) \
    --out-file ${TXS_DIR}/funding-wallet-utxo.json

# Build a Tx to send funds from `funding-wallet` to the others who need them
cardano-cli conway transaction build \
    $(cat ${TXS_DIR}/funding-wallet-utxo.json | jq -j 'to_entries[].key | "--tx-in ", ., " "') \
    --change-address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) \
    --tx-out $(cat ${CREDENTIALS_DIR}/alice/alice-funds.addr)+1000000000 \
    --tx-out $(cat ${CREDENTIALS_DIR}/alice/alice-node.addr)+1000000000 \
    --tx-out $(cat ${CREDENTIALS_DIR}/bob/bob-funds.addr)+1000000000 \
    --tx-out $(cat ${CREDENTIALS_DIR}/bob/bob-node.addr)+1000000000 \
    --out-file ${TXS_DIR}/funding-tx.json

cardano-cli conway transaction sign \
  --tx-file ${TXS_DIR}/funding-tx.json \
  --signing-key-file ${CREDENTIALS_DIR}/funding/funding-wallet.sk \
  --out-file ${TXS_DIR}/funding-tx-signed.json

cardano-cli conway transaction submit --tx-file ${TXS_DIR}/funding-tx-signed.json