#!/bin/bash

# This script serves as a central entry point for all Hydra management tasks
# It ensures scripts are always run from the correct directory context

# Get absolute path to the project root
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_ROOT"

# Export environment for all scripts
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# Command mapping
case "$1" in
    install)
        ./scripts/core/install.sh
        ;;
    cardano-node)
        ./scripts/core/setup-cardano-node.sh
        ;;
    setup-funds)
        ./scripts/core/setup-and-fund-nodes.sh
        ;;
    alice-node)
        ./scripts/core/start-alice-node.sh
        ;;
    bob-node)
        ./scripts/core/start-bob-node.sh
        ;;
    commit-funds)
        ./scripts/transactions/commit-funds.sh
        ;;
    scan)
        ./scripts/core/scan-head-metadata.sh
        ;;
    env)
        ./scripts/utils/set-env-vars.sh
        ;;
    query-funding-wallet)
        ./scripts/utils/query-funding-wallet.sh
        ;;
    query-username-wallets)
        ./scripts/utils/query-username-wallets.sh
        ;;
    refund-funding-wallet-demo)
        ./scripts/utils/refund-funding-wallet-demo.sh
        ;;
    refund-funding-wallet-username)
        ./scripts/utils/refund-funding-wallet-username.sh
        ;;
    query-tip)
        ./scripts/utils/query-tip.sh
        ;;
    query-demo-wallets)
        ./scripts/utils/query-demo-wallets.sh
        ;;
    username-credentials)
        ./scripts/setup/node/username-credentials.sh
        ;;
    fund-username)
        ./scripts/transactions/fund-username.sh
        ;;
    start-user-node)
        ./scripts/core/start-user-node.sh
        ;;
    demo-credentials)
        ./scripts/setup/node/demo-credentials.sh
        ;;
    demo-hydra-keys)
        ./scripts/setup/node/demo-hydra-keys.sh
        ;;
    fund-demo)
        ./scripts/transactions/fund-demo.sh
        ;;
    *)
        echo "Hydra Node Manager"
        echo ""
        echo "Available commands:"
        echo "  install       - Install required dependencies"
        echo "  cardano-node  - Set up and start Cardano node"
        echo "  setup-funds   - Set up funding wallet and distribute funds"
        echo "  alice-node    - Start Alice's Hydra node"
        echo "  bob-node      - Start Bob's Hydra node"
        echo "  init-head     - Initialize Hydra Head (run after nodes are started)"
        echo "  scan          - Monitor Hydra head for transactions"
        echo "  env           - Set up environment variables"
        echo ""
        echo "Example sequence:"
        echo "  install"
        echo "  env"
        echo "  cardano-node"
        echo "  setup-funds"
        echo "  Terminal 1: alice-node"
        echo "  Terminal 2: bob-node"
        echo "  Terminal 3: init-head"
        echo "  Terminal 4: scan"
        ;;
esac 