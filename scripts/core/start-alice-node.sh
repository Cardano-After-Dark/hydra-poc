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

