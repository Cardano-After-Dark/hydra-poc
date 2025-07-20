# Cardano Node and Hydra Installation Guide

This comprehensive guide walks you through installing and operating Cardano Node with the Hydra Head protocol on macOS. Hydra is Cardano's layer 2 scaling solution that enables fast, low-cost transactions with instant finality.

## Table of Contents
- [Cardano Node and Hydra Installation Guide](#cardano-node-and-hydra-installation-guide)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Prerequisites](#prerequisites)
    - [System Requirements](#system-requirements)
    - [Knowledge Requirements](#knowledge-requirements)
    - [Testing Funds](#testing-funds)
    - [Required Tools](#required-tools)
  - [Installation](#installation)
  - [Setting Up Environment Variables](#setting-up-environment-variables)
  - [Setting Up Cardano Node](#setting-up-cardano-node)
  - [Preparing Credentials](#preparing-credentials)
  - [Setting Up Hydra Nodes](#setting-up-hydra-nodes)
  - [Opening a Hydra Head](#opening-a-hydra-head)
  - [Layer 2 Transactions](#layer-2-transactions)
  - [Closing the Hydra Head](#closing-the-hydra-head)
  - [Cleaning Up](#cleaning-up)
  - [Advanced Configuration](#advanced-configuration)
    - [Custom Protocol Parameters](#custom-protocol-parameters)
    - [Network Topology](#network-topology)
  - [Technical Reference](#technical-reference)
    - [Component Versions](#component-versions)
    - [Directory Structure](#directory-structure)
    - [Useful Commands](#useful-commands)

## Overview

The Hydra Head protocol implements a state channel between multiple participants, allowing them to:
- Process transactions off-chain with high throughput
- Achieve instant finality and lower fees
- Maintain the same security guarantees as Cardano's layer 1
- Preserve privacy of operations within the head

This guide demonstrates a two-participant Hydra head (Alice and Bob) on Cardano's preprod testnet.

## Prerequisites

### System Requirements
- macOS (compatible with both Intel and Apple Silicon)
- Terminal access
- Minimum 8GB RAM, 20GB free disk space
- Stable internet connection

### Knowledge Requirements
- Basic command line familiarity
- Basic understanding of Cardano and blockchain concepts

### Testing Funds
- 130 test ada per participant on Cardano's preprod network
  - Can be obtained from the [Cardano Testnet Faucet](https://docs.cardano.org/cardano-testnets/tools/faucet/)

### Required Tools
The following tools will be installed automatically by the installation script:
- `curl` - For downloading files and APIs
- `tar` - For extracting archives
- `jq` (>1.6) - For JSON manipulation
- `websocat` - For WebSocket communication with Hydra nodes

## Installation

Start by cloning this repository and running the installation script:

```bash
make install
```

The installation script:
1. Downloads pre-built binaries for Cardano Node, Cardano CLI, and Hydra Node
2. Installs the Mithril client for fast node syncing
3. Verifies all dependencies are correctly installed
4. Sets appropriate file permissions

## Setting Up Environment Variables

The following command configures your environment by creating a `.env` file from `.env.example`, replacing placeholder paths with your actual project location, and setting up required directories for credentials, persistence, and transactions.

```bash
make env
```

## Setting Up Cardano Node

Once installation is complete, set up and start the Cardano node:

```bash
make cardano-node
```

This script:
1. Downloads the latest Mithril snapshot of the preprod blockchain
2. Configures the node to connect to Cardano's preprod testnet
3. Starts the node and begins syncing with the network

Monitor the synchronization status in a separate terminal:

```bash
make query-tip
```

You'll see output similar to:
```json
{
    "block": 3206582,
    "epoch": 198,
    "era": "Conway",
    "hash": "b6ad4dd9f0d17be1da17e4a2f7965f291be663e3de077e8317e0a2615694702a",
    "slot": 84316455,
    "slotInEpoch": 422055,
    "slotsToEpochEnd": 9945,
    "syncProgress": "100.00"
}
``` 

Wait until `syncProgress` reaches "100.00" before proceeding.

## Preparing Credentials

Generate cryptographic credentials for preprod funding wallet:

```bash
make setup-funding-wallet
```

This will create a Cardano key pair for the funding wallet and generate an address. **Preprod tADA** can be obtained from the [Cardano Testnet Faucet](https://docs.cardano.org/cardano-testnets/tools/faucet/) with this address as the recipient.



The script will query the blockchain every 10 seconds until the funding wallet has enough funds or until a timeout of 5 minutes is reached. Once the funding wallet has enough funds, the script will create key pairs for the participants, generate addresses for all key pairs, and build a transaction to send 1000000000 lovelace from the funding wallet to the participants' node and funds addresses. It will also create a Hydra key pair for each participant.

Note: If this fails, try it again. TODO: Fix this 

You can verify the funds have been received by the participants:


```bash
make query-demo-wallets
```

Look for output showing the UTxOs at each address with their respective balances.

## Setting Up Hydra Nodes


TODO: document
```bash
make demo-credentials
```

```bash
make demo-hydra-keys
```

```bash
make fund-demo
```

Since the Hydra key pairs were generated in the setup script, we can start the Hydra nodes.

Now start the Hydra nodes in separate terminal windows:

For Alice:
```bash
make alice-node
```

For Bob:
```bash
make bob-node
```

These scripts:
1. Set all required environment variables
2. Configure the nodes to connect to each other and to Cardano
3. Start the Hydra nodes with appropriate parameters
4. Open the API on ports 4001 (Alice) and 4002 (Bob)

Verify the nodes are running by connecting to their WebSocket APIs:

```bash
websocat ws://127.0.0.1:4001 | jq  # For Alice
websocat ws://127.0.0.1:4002 | jq  # For Bob
```


You should see connection messages and a "Greetings" message with "headStatus": "Idle".

## Opening a Hydra Head

With both nodes running, initiate a Hydra head through the WebSocket connection.
In your WebSocket session, send:

```json
{ "tag": "Init" }
```

This triggers the head initialization process, which:
1. Creates an on-chain transaction referencing the head
2. Registers the participants (Alice and Bob)
3. Establishes the contestation parameters
4. Puts the head in "Initializing" state

You'll see a `HeadIsInitializing` message in the WebSocket output.

Next, commit funds to the head:

```bash
make commit-funds-demo
```

This script:
1. Queries the current UTxO state of both participants
2. Prepares commit transactions for both Alice and Bob
3. Signs the transactions with the appropriate keys
4. Submits the transactions to the Cardano network

When both participants have committed their funds, the head automatically opens. You'll see a `HeadIsOpen` message with details about the initial UTxO set in the head.

## Layer 2 Transactions

The Hydra Head implementation includes a Terminal User Interface (TUI) for sending messages and a real-time transaction stream viewer. These tools allow you to interact with the Hydra Head and monitor transactions in real-time.

### Setting Up the Message Interface

1. First, install the required dependencies:
```bash
pnpm install
```

2. Open two terminal windows side by side to run both components:

In the first terminal, start the TUI interface:
```bash
pnpm run tui
```

In the second terminal, start message receiving TUI:
```bash
pnpm run receiver
```

### Using the Message Interface

The TUI provides a user-friendly interface for sending messages through the Hydra Head:

- Type your message and press Enter to send
- Messages are sent as transactions with metadata
- Each message includes:
  - The message text
  - Timestamp
  - Sender identifier
- The interface shows message status (sending/sent/error)
- Use `clear` to clear message history
- Type `exit` to quit the application

### Transaction Stream Viewer

The stream viewer provides real-time monitoring of transactions in the Hydra Head:

- Displays transaction details including:
  - Sender information
  - Message content
  - Transaction timestamp
- Automatically parses and displays transaction metadata
- Shows transaction validation status
- Provides error reporting for failed transactions

Both components work together to provide a complete interface for interacting with the Hydra Head, allowing you to send messages and monitor their processing in real-time.

## Closing the Hydra Head

When you're ready to close the head and settle back to layer 1, send through your WebSocket connection:

```json
{ "tag": "Close" }
```

This initiates the closing process:
1. A closing transaction is submitted to Cardano layer 1
2. The most recent agreed state (snapshot) is recorded on-chain
3. A contestation period begins (configurable, default is 10 Cardano slots)

You'll receive a `HeadIsClosed` message with the `contestationDeadline`.

After the contestation period expires, you'll see a `ReadyToFanout` message. At this point, distribute the funds back to layer 1:

```json
{ "tag": "Fanout" }
```

This finalizes the head closure:
1. A fanout transaction is submitted to layer 1
2. Funds are distributed according to the final head state
3. The head transitions to "HeadIsFinalized" state

Verify the final balances on layer 1:

```bash
make query-demo-wallets
```

## Cleaning Up

Now that the testing sequence is complete, return any unused test ada to the funding wallet to be used again later:

```bash
make refund-funding-wallet-demo
```

This script:
1. Gathers all remaining funds from Alice and Bob addresses
2. Creates a transaction returning them to the testnet faucet
3. Signs and submits the transaction

To refund from your username's wallets, run this command:

```bash
make refund-funding-wallet-username
```

## Advanced Configuration

### Custom Protocol Parameters

The default setup uses zero fees for simplicity. For realistic testing, modify the protocol parameters:

```bash
cardano-cli query protocol-parameters | jq > protocol-parameters.json
# Edit as needed
```

### Network Topology

For actual deployment with remote participants:
1. Update IP addresses in the node startup scripts
2. Ensure firewalls allow the required ports (default: 5001, 5002)
3. Exchange verification keys securely between participants


## Technical Reference

### Component Versions
- Cardano Node: 10.1.2
- Hydra: 0.20.0
- Mithril Client: latest

### Directory Structure
- `/infra/node/bin/` - Executable binaries
- `/infra/credentials/` - Generated keys and addresses
- `/infra/persistence/persistence-alice/` - Alice's node state
- `/infra/persistence/persistence-bob/` - Bob's node state
- `/infra/params/protocol-parameters.json` - Custom protocol parameters

### Useful Commands

**Check Cardano Tip**
```bash
cardano-cli query tip
```

**Inspect UTxO**
```bash
cardano-cli query utxo --address $(cat infra/credentials/alice/alice-funds.addr)
```


**WebSocket API Examples**
```bash
# Send transaction
cat tx-signed.json | jq -c '{tag: "NewTx", transaction: .}' | websocat ws://127.0.0.1:4001
```

---

For more detailed information, visit the [Hydra Head Protocol Documentation](https://hydra.family/head-protocol/docs).

If you encounter issues or have questions, join the [Cardano Hydra Discord](https://discord.gg/Qq5vNTg9PT) or create an issue on GitHub.