#!/bin/bash

# Set environment variables
export PATH=$(pwd)/infra/node/bin:$PATH
export CARDANO_NODE_SOCKET_PATH=$(pwd)/infra/node/preprod/node.socket
export CARDANO_NODE_NETWORK_ID=1
export DYLD_FALLBACK_LIBRARY_PATH=$(pwd)/infra/node/bin

wallet_name=funding-wallet

if [ ! -d "infra/credentials/funding" ]; then
    mkdir -p infra/credentials/funding
fi

# Check if credentials already exist
if [ -f "infra/credentials/funding/$wallet_name.vk" ] && [ -f "infra/credentials/funding/$wallet_name.sk" ] && [ -f "infra/credentials/funding/$wallet_name.addr" ]; then
    echo "Funding credentials already exist. Skipping creation."
    echo ""
    echo "Existing wallet address for funding from the Cardano Testnet Faucet:"
    echo $(cat infra/credentials/funding/$wallet_name.addr)
else
    mkdir -p infra/credentials/funding
    
    cardano-cli address key-gen \
      --verification-key-file infra/credentials/funding/$wallet_name.vk \
      --signing-key-file infra/credentials/funding/$wallet_name.sk

    cardano-cli address build \
      --verification-key-file infra/credentials/funding/$wallet_name.vk \
      --out-file infra/credentials/funding/$wallet_name.addr

    echo ""
    echo "Request funding from the Cardano Testnet Faucet:"
    echo $(cat infra/credentials/funding/$wallet_name.addr)
fi