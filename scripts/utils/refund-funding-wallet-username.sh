#!/bin/bash

# Prompt for username instead of taking it as an argument
read -p "Enter username: " USERNAME

# Check if ${USERNAME} exists
if [ ! -d "${CREDENTIALS_DIR}/${USERNAME}" ]; then
    echo "Error: ${USERNAME} does not exist."
    exit 1
fi

echo "Found $UTXO_COUNT UTXOs to refund for ${USERNAME}." 
cardano-cli query utxo \
  --address $(cat ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.addr) \
  --address $(cat ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.addr) \
  --out-file ${TXS_DIR}/${USERNAME}-return-utxo.json

# Check if there are any UTXOs to refund
UTXO_COUNT=$(jq 'length' ${TXS_DIR}/${USERNAME}-return-utxo.json)

if [ "$UTXO_COUNT" -eq 0 ]; then
    echo "No UTXOs found for ${USERNAME}. Nothing to refund."
    exit 0
fi

cardano-cli conway transaction build \
  $(cat ${TXS_DIR}/${USERNAME}-return-utxo.json | jq -j 'to_entries[].key | "--tx-in ", ., " "') \
  --change-address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) \
  --out-file ${TXS_DIR}/${USERNAME}-return-tx.json

cardano-cli conway transaction sign \
  --tx-file ${TXS_DIR}/${USERNAME}-return-tx.json \
  --signing-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.sk \
  --signing-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.sk \
  --out-file ${TXS_DIR}/${USERNAME}-return-tx-signed.json

cardano-cli conway transaction submit --tx-file ${TXS_DIR}/${USERNAME}-return-tx-signed.json
