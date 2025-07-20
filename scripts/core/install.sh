#!/bin/bash
# Create node directory in current path
mkdir -p infra/node/bin
cd infra/node

# Detect operating system
os_type=$(uname -s)

# Check and install dependencies based on OS
if [ "$os_type" = "Darwin" ]; then
    # macOS dependencies
    for pkg in curl jq websocat; do
        if ! brew list $pkg &>/dev/null; then
            echo "Installing $pkg..."
            brew install $pkg
        fi
    done
elif [ "$os_type" = "Linux" ]; then
    # Ubuntu Linux dependencies
    if [ -x "$(command -v apt-get)" ]; then
        echo "Updating package lists..."
        sudo apt-get update
        
        # Install curl and jq from apt
        for pkg in curl jq; do
            if ! dpkg -l $pkg &>/dev/null; then
                echo "Installing $pkg..."
                sudo apt-get install -y $pkg
            fi
        done
        
        # Install websocat from binary release since it's not in default repositories
        if ! command -v websocat &>/dev/null; then
            echo "Installing websocat from binary release..."
            # Download the latest release directly as a binary instead of tar.gz
            sudo curl -L -o /usr/local/bin/websocat https://github.com/vi/websocat/releases/latest/download/websocat.x86_64-unknown-linux-musl
            sudo chmod +x /usr/local/bin/websocat
        fi
    else
        echo "Error: This script only supports Ubuntu-based Linux distributions with apt-get"
        exit 1
    fi
else
    echo "Unsupported operating system: $os_type"
    exit 1
fi

hydra_version=0.20.0
cardano_node_version=10.1.2

# Detect architecture
arch=$(uname -m)
if [ "$arch" = "arm64" ] || [ "$arch" = "aarch64" ]; then
    hydra_arch="aarch64"
else
    hydra_arch="x86_64"
fi

# Download Hydra for appropriate architecture and OS
if [ "$os_type" = "Darwin" ]; then
    curl -L -O https://github.com/cardano-scaling/hydra/releases/download/${hydra_version}/hydra-${hydra_arch}-darwin-${hydra_version}.zip
    unzip -d bin hydra-${hydra_arch}-darwin-${hydra_version}.zip
    
    # Download and extract Cardano node binaries for macOS
    curl -L -O https://github.com/IntersectMBO/cardano-node/releases/download/${cardano_node_version}/cardano-node-${cardano_node_version}-macos.tar.gz
    tar -xf cardano-node-${cardano_node_version}-macos.tar.gz
elif [ "$os_type" = "Linux" ] && [ "$arch" = "x86_64" ]; then
    curl -L -O https://github.com/cardano-scaling/hydra/releases/download/${hydra_version}/hydra-${hydra_arch}-linux-${hydra_version}.zip
    unzip -d bin hydra-${hydra_arch}-linux-${hydra_version}.zip
    
    # Download and extract Cardano node binaries for Linux
    curl -L -O https://github.com/IntersectMBO/cardano-node/releases/download/${cardano_node_version}/cardano-node-${cardano_node_version}-linux.tar.gz
    tar -xf cardano-node-${cardano_node_version}-linux.tar.gz
fi

# Move only the needed files to the bin directory
if [ -d "./bin" ]; then
    if [ "$os_type" = "Darwin" ]; then
        mv ./bin/cardano-node ./bin/cardano-cli ./bin/*.dylib bin/ 2>/dev/null || true
    elif [ "$os_type" = "Linux" ]; then
        mv ./bin/cardano-node ./bin/cardano-cli ./bin/*.so bin/ 2>/dev/null || true
    fi
else
    # Find and move binaries if they exist in a different location
    if [ "$os_type" = "Darwin" ]; then
        find . -name 'cardano-node' -o -name 'cardano-cli' -o -name '*.dylib' | xargs -I{} mv {} bin/ 2>/dev/null || true
    elif [ "$os_type" = "Linux" ]; then
        find . -name 'cardano-node' -o -name 'cardano-cli' -o -name '*.so' | xargs -I{} mv {} bin/ 2>/dev/null || true
    fi
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

echo "Installation complete!"
echo "Installed components:"
echo "- Cardano Node: $(bin/cardano-node --version 2>/dev/null || echo "Not found or version check failed")"
echo "- Cardano CLI: $(bin/cardano-cli --version 2>/dev/null || echo "Not found or version check failed")"
echo "- Hydra Node: $(bin/hydra-node --version 2>/dev/null || echo "Not found or version check failed")"
echo "- Mithril Client: $(bin/mithril-client --version 2>/dev/null || echo "Not found or version check failed")"
echo ""
echo "All components have been installed to: ${PWD}/bin"
