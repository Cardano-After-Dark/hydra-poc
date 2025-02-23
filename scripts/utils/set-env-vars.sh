#!/bin/bash

# Find the project root directory (where .git is located)
find_project_root() {
    local current_dir="$PWD"
    while [[ "$current_dir" != "/" ]]; do
        if [[ -d "$current_dir/.git" ]]; then
            echo "$current_dir"
            return 0
        fi
        current_dir="$(dirname "$current_dir")"
    done
    echo "Error: Not inside a git repository" >&2
    return 1
}

# Get absolute project root path
PROJECT_ROOT=$(find_project_root) || exit 1

# Create .env file
cat > "${PROJECT_ROOT}/.env" << EOF
# Base paths
PROJECT_ROOT=${PROJECT_ROOT}
INFRA_DIR=\${PROJECT_ROOT}/infra
NODE_DIR=\${INFRA_DIR}/node
CREDENTIALS_DIR=\${INFRA_DIR}/credentials
PERSISTENCE_DIR=\${INFRA_DIR}/persistence
PARAMS_DIR=\${INFRA_DIR}/params
TXS_DIR=\${INFRA_DIR}/txs

# Node binary and socket paths
PATH=\${NODE_DIR}/bin:\${PATH}
CARDANO_NODE_SOCKET_PATH=\${NODE_DIR}/preprod/node.socket
DYLD_FALLBACK_LIBRARY_PATH=\${NODE_DIR}/bin

# Network configuration
CARDANO_NODE_NETWORK_ID=1
TESTNET_MAGIC=1

# Mithril configuration
GENESIS_VERIFICATION_KEY=$(curl -s https://raw.githubusercontent.com/input-output-hk/mithril/main/mithril-infra/configuration/release-preprod/genesis.vkey 2> /dev/null)
AGGREGATOR_ENDPOINT=https://aggregator.release-preprod.api.mithril.network/aggregator

# Hydra configuration
HYDRA_VERSION=0.20.0

# Node API ports
ALICE_API_PORT=4001
BOB_API_PORT=4002

# Node network ports
ALICE_PORT=5001
BOB_PORT=5002
EOF

# Source the .env file
source "${PROJECT_ROOT}/.env"

# Create required directories if they don't exist
mkdir -p "${CREDENTIALS_DIR}/alice" "${CREDENTIALS_DIR}/bob" "${CREDENTIALS_DIR}/funding" \
         "${PERSISTENCE_DIR}" "${PARAMS_DIR}" "${TXS_DIR}"

# Function to check if required binaries are available
check_requirements() {
    local required_bins=("cardano-cli" "cardano-node" "hydra-node" "jq" "curl")
    local missing_bins=()

    for bin in "${required_bins[@]}"; do
        if ! command -v "$bin" >/dev/null 2>&1; then
            missing_bins+=("$bin")
        fi
    done

    if [ ${#missing_bins[@]} -ne 0 ]; then
        echo "Error: Required binaries not found: ${missing_bins[*]}"
        echo "Please run install.sh first"
        return 1
    fi

    return 0
}

# Check requirements when script is sourced
check_requirements

# Print environment setup status
echo "Environment variables set:"
echo "- Project root: ${PROJECT_ROOT}"
echo "- Node socket: ${CARDANO_NODE_SOCKET_PATH}"
echo "- Network ID: ${CARDANO_NODE_NETWORK_ID}"
echo "- Hydra version: ${HYDRA_VERSION}" 