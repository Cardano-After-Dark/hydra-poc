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

#    - Adjusts the fees and pricing mechanisms to zero, ensuring that transactions within the Hydra head incur no costs.
cardano-cli query protocol-parameters \
  | jq '.txFeeFixed = 0 |.txFeePerByte = 0 | .executionUnitPrices.priceMemory = 0 | .executionUnitPrices.priceSteps = 0' \
  > ${PARAMS_DIR}/protocol-parameters.json

HYDRA_SCRIPTS_TX_ID=$(curl https://raw.githubusercontent.com/cardano-scaling/hydra/master/networks.json | jq -r ".preprod.\"${HYDRA_VERSION}\"")

hydra-node \
  --node-id "${USERNAME}-node" \
  --persistence-dir "${PERSISTENCE_DIR}/persistence-${USERNAME}" \
  --cardano-signing-key "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-node.sk" \
  --hydra-signing-key "${CREDENTIALS_DIR}/${USERNAME}/${USERNAME}-hydra.sk" \
  --hydra-scripts-tx-id "${HYDRA_SCRIPTS_TX_ID}" \
  --ledger-protocol-parameters "${PARAMS_DIR}/protocol-parameters.json" \
  --testnet-magic "${TESTNET_MAGIC}" \
  --node-socket "${CARDANO_NODE_SOCKET_PATH}" \
  --api-port "${MY_API_PORT}" \
  --host 0.0.0.0 \
  --api-host 0.0.0.0 \
  --port "${MY_PORT}" \
  --peer "${PEER_NODE_IP}:${PEER_NODE_PORT}" \
  --hydra-verification-key "${CREDENTIALS_DIR}/${PEER_USERNAME}/${PEER_USERNAME}-hydra.vk" \
  --cardano-verification-key "${CREDENTIALS_DIR}/${PEER_USERNAME}/${PEER_USERNAME}-node.vk"

