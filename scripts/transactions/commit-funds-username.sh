#!/bin/bash

if [ ! -d "${TXS_DIR}" ]; then
    mkdir -p ${TXS_DIR}
fi

cardano-cli query utxo \
  --address $(cardano-cli address build --payment-verification-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.vk) \
  --out-file ${TXS_DIR}/${USERNAME}-commit-utxo.json

curl -X POST 127.0.0.1:${MY_API_PORT}/commit \
  --data @${TXS_DIR}/${USERNAME}-commit-utxo.json \
  > ${TXS_DIR}/${USERNAME}-commit-tx.json

cardano-cli conway transaction sign \
  --tx-file ${TXS_DIR}/${USERNAME}-commit-tx.json \
  --signing-key-file ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.sk \
  --out-file ${TXS_DIR}/${USERNAME}-commit-tx-signed.json

cardano-cli conway transaction submit --tx-file ${TXS_DIR}/${USERNAME}-commit-tx-signed.json
