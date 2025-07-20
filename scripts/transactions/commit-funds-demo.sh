#!/bin/bash

if [ ! -d "${TXS_DIR}" ]; then
    mkdir -p ${TXS_DIR}
fi


cardano-cli query utxo \
  --address $(cardano-cli address build --payment-verification-key-file ${CREDENTIALS_DIR}/alice/alice-funds.vk) \
  --out-file ${TXS_DIR}/alice-commit-utxo.json


curl -X POST 127.0.0.1:4001/commit \
  --data @${TXS_DIR}/alice-commit-utxo.json \
  > ${TXS_DIR}/alice-commit-tx.json

cardano-cli conway transaction sign \
  --tx-file ${TXS_DIR}/alice-commit-tx.json \
  --signing-key-file ${CREDENTIALS_DIR}/alice/alice-funds.sk \
  --out-file ${TXS_DIR}/alice-commit-tx-signed.json

cardano-cli conway transaction submit --tx-file ${TXS_DIR}/alice-commit-tx-signed.json

cardano-cli query utxo \
  --address $(cardano-cli address build --payment-verification-key-file ${CREDENTIALS_DIR}/bob/bob-funds.vk) \
  --out-file ${TXS_DIR}/bob-commit-utxo.json


curl -X POST 127.0.0.1:4002/commit \
  --data @${TXS_DIR}/bob-commit-utxo.json \
  > ${TXS_DIR}/bob-commit-tx.json

cardano-cli conway transaction sign \
  --tx-file ${TXS_DIR}/bob-commit-tx.json \
  --signing-key-file ${CREDENTIALS_DIR}/bob/bob-funds.sk \
  --out-file ${TXS_DIR}/bob-commit-tx-signed.json

cardano-cli conway transaction submit --tx-file ${TXS_DIR}/bob-commit-tx-signed.json
