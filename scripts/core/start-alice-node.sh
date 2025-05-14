#!/bin/bash

# Adjusts the fees and pricing mechanisms to zero, ensuring that transactions within the Hydra head incur no costs.
cardano-cli query protocol-parameters \
  | jq '.txFeeFixed = 0 |.txFeePerByte = 0 | .executionUnitPrices.priceMemory = 0 | .executionUnitPrices.priceSteps = 0' > ${PARAMS_DIR}/protocol-parameters.json

HYDRA_SCRIPTS_TX_ID=$(curl https://raw.githubusercontent.com/cardano-scaling/hydra/master/networks.json | jq -r ".preprod.\"${HYDRA_VERSION}\"")

hydra-node \
  --node-id "alice-node" \
  --persistence-dir "${PERSISTENCE_DIR}/persistence-alice" \
  --cardano-signing-key "${CREDENTIALS_DIR}/alice/alice-node.sk" \
  --hydra-signing-key "${CREDENTIALS_DIR}/alice/alice-hydra.sk" \
  --hydra-scripts-tx-id "${HYDRA_SCRIPTS_TX_ID}" \
  --ledger-protocol-parameters "${PARAMS_DIR}/protocol-parameters.json" \
  --testnet-magic "${TESTNET_MAGIC}" \
  --node-socket "${CARDANO_NODE_SOCKET_PATH}" \
  --api-port "${ALICE_API_PORT}" \
  --host 0.0.0.0 \
  --api-host 0.0.0.0 \
  --port "${ALICE_PORT}" \
  --peer "127.0.0.1:${BOB_PORT}" \
  --hydra-verification-key "${CREDENTIALS_DIR}/bob/bob-hydra.vk" \
  --cardano-verification-key "${CREDENTIALS_DIR}/bob/bob-node.vk"

