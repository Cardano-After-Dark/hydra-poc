#!/bin/bash

echo "# UTxO of ${USERNAME}-node"
cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.addr) --out-file /dev/stdout | jq

echo "# UTxO of ${USERNAME}-funds"
cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-funds.addr) --out-file /dev/stdout | jq
