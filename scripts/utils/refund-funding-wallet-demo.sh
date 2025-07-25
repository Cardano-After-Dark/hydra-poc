#!/bin/bash

cardano-cli query utxo \
  --address $(cat ${CREDENTIALS_DIR}/alice/alice-node.addr) \
  --address $(cat ${CREDENTIALS_DIR}/alice/alice-funds.addr) \
  --out-file ${TXS_DIR}/alice-return-utxo.json

# Check if there are any UTXOs to refund
UTXO_COUNT=$(jq 'length' ${TXS_DIR}/alice-return-utxo.json)

if [ "$UTXO_COUNT" -eq 0 ]; then
    echo "No UTXOs found for alice. Nothing to refund."
else
    cardano-cli conway transaction build \
      $(cat ${TXS_DIR}/alice-return-utxo.json | jq -j 'to_entries[].key | "--tx-in ", ., " "') \
      --change-address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) \
      --out-file ${TXS_DIR}/alice-return-tx.json

    cardano-cli conway transaction sign \
      --tx-file ${TXS_DIR}/alice-return-tx.json \
      --signing-key-file ${CREDENTIALS_DIR}/alice/alice-node.sk \
      --signing-key-file ${CREDENTIALS_DIR}/alice/alice-funds.sk \
      --out-file ${TXS_DIR}/alice-return-tx-signed.json

    cardano-cli conway transaction submit --tx-file ${TXS_DIR}/alice-return-tx-signed.json

    echo "Refunded ${UTXO_COUNT} UTXOs for alice."
fi


cardano-cli query utxo \
  --address $(cat ${CREDENTIALS_DIR}/bob/bob-node.addr) \
  --address $(cat ${CREDENTIALS_DIR}/bob/bob-funds.addr) \
  --out-file ${TXS_DIR}/bob-return-utxo.json


# Check if there are any UTXOs to refund
UTXO_COUNT=$(jq 'length' ${TXS_DIR}/bob-return-utxo.json)

if [ "$UTXO_COUNT" -eq 0 ]; then
    echo "No UTXOs found for bob. Nothing to refund."
else
    cardano-cli conway transaction build \
      $(cat ${TXS_DIR}/bob-return-utxo.json | jq -j 'to_entries[].key | "--tx-in ", ., " "') \
      --change-address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) \
      --out-file ${TXS_DIR}/bob-return-tx.json

    cardano-cli conway transaction sign \
      --tx-file ${TXS_DIR}/bob-return-tx.json \
      --signing-key-file ${CREDENTIALS_DIR}/bob/bob-node.sk \
      --signing-key-file ${CREDENTIALS_DIR}/bob/bob-funds.sk \
      --out-file ${TXS_DIR}/bob-return-tx-signed.json

    cardano-cli conway transaction submit --tx-file ${TXS_DIR}/bob-return-tx-signed.json

    echo "Refunded ${UTXO_COUNT} UTXOs for bob."
fi


# cardano-cli conway transaction build \
#   $(cat ${TXS_DIR}/bob-return-utxo.json | jq -j 'to_entries[].key | "--tx-in ", ., " "') \
#   --change-address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) \
#   --out-file ${TXS_DIR}/bob-return-tx.json

# cardano-cli conway transaction sign \
#   --tx-file ${TXS_DIR}/bob-return-tx.json \
#   --signing-key-file ${CREDENTIALS_DIR}/bob/bob-node.sk \
#   --signing-key-file ${CREDENTIALS_DIR}/bob/bob-funds.sk \
#   --out-file ${TXS_DIR}/bob-return-tx-signed.json

# cardano-cli conway transaction submit --tx-file ${TXS_DIR}/bob-return-tx-signed.json