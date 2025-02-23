#!/bin/bash
# Create node directory in current path
mkdir -p infra/node/bin
cd infra/node

# Check and install dependencies
for pkg in curl jq websocat; do
    if ! brew list $pkg &>/dev/null; then
        echo "Installing $pkg..."
        brew install $pkg
    fi
done

hydra_version=0.20.0
cardano_node_version=10.1.2

# Detect architecture
arch=$(uname -m)
if [ "$arch" = "arm64" ]; then
  hydra_arch="aarch64"
else
  hydra_arch="x86_64"
fi

# Download Hydra for appropriate architecture
curl -L -O https://github.com/cardano-scaling/hydra/releases/download/${hydra_version}/hydra-${hydra_arch}-darwin-${hydra_version}.zip
unzip -d bin hydra-${hydra_arch}-darwin-${hydra_version}.zip

# Download and extract Cardano node binaries
curl -L -O https://github.com/IntersectMBO/cardano-node/releases/download/${cardano_node_version}/cardano-node-${cardano_node_version}-macos.tar.gz

# Use a simpler tar extraction approach
tar -xf cardano-node-${cardano_node_version}-macos.tar.gz

# Move only the needed files to the bin directory
if [ -d "./bin" ]; then
  mv ./bin/cardano-node ./bin/cardano-cli ./bin/*.dylib bin/ 2>/dev/null || true
else
  # Find and move binaries if they exist in a different location
  find . -name 'cardano-node' -o -name 'cardano-cli' -o -name '*.dylib' | xargs -I{} mv {} bin/ 2>/dev/null || true
fi

# Handle the preprod files
if [ -d "./share/preprod" ]; then
  mkdir -p preprod
  cp -r ./share/preprod/* preprod/
else
  # Try to find the preprod directory
  find . -name 'preprod' -type d | xargs -I{} cp -r {}/* preprod/ 2>/dev/null || true
fi

# Clean up extracted files
find . -type f -not -path "./bin/*" -name "cardano-*" -delete
rm -rf ./share 2>/dev/null || true

# Install Mithril client
curl --proto '=https' --tlsv1.2 -sSf https://raw.githubusercontent.com/input-output-hk/mithril/refs/heads/main/mithril-install.sh | sh -s -- -c mithril-client -d latest -p bin

# Make binaries executable
chmod +x bin/*

# Set environment variables
./scripts/utils/set-env-vars.sh

echo "Installation complete. Check that all components were downloaded successfully in the 'node' directory."