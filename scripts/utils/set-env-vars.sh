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

# Check if .env.example exists
if [ ! -f "${PROJECT_ROOT}/.env.example" ]; then
    echo "Error: .env.example file not found in project root" >&2
    exit 1
fi

# Create .env file from .env.example
cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env"

# Replace path/to/project/ with actual project root
sed -i '' "s|path/to/project/|${PROJECT_ROOT}/|g" "${PROJECT_ROOT}/.env"

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