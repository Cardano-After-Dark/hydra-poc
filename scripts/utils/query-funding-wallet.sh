#!/bin/bash

echo "# UTxO of funding-wallet"
cardano-cli query utxo --address $(cat ${CREDENTIALS_DIR}/funding/funding-wallet.addr) --out-file /dev/stdout | jq