This document is related to [cPoker Hydra Case Study: Implement Interactive dApp](https://projectcatalyst.io/funds/13/cardano-use-cases-concept/cpoker-hydra-case-study-implement-interactive-dapp), and explains how to run of the Hydra POC on MacOS.

## Getting started

Prepare a folder and clone the project

```
mkdir ~/poc && cd ~/poc
git clone git@github.com:Cardano-After-Dark/hydra-poc.git
cd hydra-poc
git checkout blog
```

Open the project and check the readme for the details.

![[Pasted image 20250614084010.png]]

## Installing and Setting Up Env Variables

Run the installation scripts and set up the environment variables to have a running environment. 

First run install to setup the system, download mithryl, and prepare the `infra` directory

```bash
make install
```

 ![[Pasted image 20250614084515.png]]

Then run `env` to create an `.env` file to use for the demo

```bash
make env
```

![[Pasted image 20250614084747.png]]  

## Setting up Cardano Node

Now, set up and start the Cardano node:

```bash
make cardano-node
```

This will download the cardano db, deflate it, and replay all its transactions. Wait until all the transactions are replayed and the cardano node is started.

![[Pasted image 20250614111351.png]]


Notes:
- If requested, grant terminal the permission to access the local network. 
- When completed, leave the terminal open with the cardano node running
- To restart run `make cardano-node` but chose `n` to not remove the existing database.

Check the cardano node is updated by querying the tip of the running node

```bash
make query-tip
```

In your terminal you should see a confirmation 
![[Pasted image 20250614111618.png]]

Now we have the cardano node set up to run the PoCs
## Hydra PoC Local

In this PoC we run two clients: A, and B, each one communicating through a two hydra nodes running agains the same Cardano node.

![[Pasted image 20250614170402.png]]

### Preparing Credentials

Generate cryptographic credentials for preprod funding wallet:

```bash
make setup-funding-wallet
```

This will create a Cardano key pair for the funding wallet and generate an address.
![[Pasted image 20250614172920.png]]
 **Preprod tADA** can be obtained from the [Cardano Testnet Faucet](https://docs.cardano.org/cardano-testnets/tools/faucet/) with this address as the recipient.

![[Pasted image 20250614234607.png]]


Creating credentials for Alice and bob in the folder `infra\credentials\alice|bob`:

```bash
# User credentials
make demo-credentials
# Hydra key pairs 
make demo hydra-keys
```

At this stage, the credentials will be into `infra\credentials\alice|bob`

* `<user>-node.*` : user's node credentials
* `<user>-funds.*` : user's funds credentials
* `<user>-hydra.*` : Hydra key pair for the user 

Transfering the preprod tADA from funding wallet to the users wallets

```bash
 make fund-demo
```

If you already transferred the tADA from the the [Cardano Testnet Faucet](https://docs.cardano.org/cardano-testnets/tools/faucet/), you'll see the balance is transfered to users. Otherwise, it waits for fund transfer.

![[Pasted image 20250615164534.png]]

When done, you can check Alice's and Bob's funds by querying

``` bash
make query-demo-wallets
```

See output example
![[Pasted image 20250615164923.png]]
### Starting Hydra Nodes

Start the hydra nodes in separate terminal windows: 

For Alice:
```bash
make alice-node
```

For Bob:
```bash
make bob-node
```

At  this stage, you should have 
- a terminal running the cardano node
- two more terminals running the Hydra nodes for Alice and Bob

![[Pasted image 20250615175402.png]]

Let's keep all this infrastructure running, and launch two more terminals to verify the nodes are running by connecting to their websocket APIs

Open a terminal

```bash
websocat ws://127.0.0.1:4001 | jq # For Alice
```

Open another terminal

```bash
websocat ws://127.0.0.1:4002 | jq # For Bob
```

You should see connection messages and a "Greetings" message with "headStatus": "Idle".

![[Pasted image 20250615175842.png]]

### Opening a Hydra Head

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

![[Pasted image 20250615180240.png]]

Next, commit funds to the head:

```bash
make commit-funds-demo
```

![[Pasted image 20250615180448.png]]

This script:
1. Queries the current UTxO state of both participants
2. Prepares commit transactions for both Alice and Bob
3. Signs the transactions with the appropriate keys
4. Submits the transactions to the Cardano network

When both participants have committed their funds, the head automatically opens. You'll see a `HeadIsOpen` message with details about the initial UTxO set in the head.


### Layer 2 transactions

The Hydra Head implementation includes a Terminal User Interface (TUI) chat for sending messages and a real-time transaction stream viewer. These tools allow you to interact with the Hydra Head and monitor transactions in real-time.

### Setting Up the Chat 

First, install the required dependencies:
```bash
pnpm install
```

Open two terminal windows side by side to run both message sender and receiver for Alice and Bob. For each terminal window do the following:

- Split the terminal horizontally
- In the upper part:
	- run `pnpm chat`, 
	- select 1 to start the sender TUI
	- type the username (alice or bob)
- In the lower part:
	- run `pnpm chat`, 
	- select 2 to start the sender TUI
	- type the username (alice or bob)

### Using the Chat

The chat provides two components in a user-friendly interface:
- Sending: for sending messages through the Hydra Head
- Receiving: for monitoring in real time of the transactions in the Hydra Head

Here is an example of chat commuinication between Alice and Bob

![[Pasted image 20250615184146.png]]


### Closing the Hydra Head

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

### Cleaning Up

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

This script:
1. Gathers all remaining funds from Alice and Bob addresses
2. Creates a transaction returning them to the testnet faucet
3. Signs and submits the transaction

To refund from your username's wallets, run this command:

```bash
make refund-funding-wallet-username
```

## Possible Error
If you find this error, just disregard it for now.

![[Pasted image 20250615180655.png]]

![[Pasted image 20250615180931.png]]

---

## Hydra PoC Remote

In this PoC, we run two Hydra nodes on separate remote computers. 

![[Pasted image 20250615211020.png]]


### Setting up the Cardano Nodes
This part of the process is same as what explained at begining of this tutorial, but the cardano nodes are being set up on different computers. 

### Setup Networking
Each of the parties has to find their external ip address, and choose a port to use for communicating with the peer. 

``` bash
# find external ip address
> curl -4 ifconfig.me
78.55.20.191% # My public IP
```




---

We're going to add two hydra nodes connected to the cardano node. Each of these node will be owned by a different party, let's call them Alice (A) and Bob (B). 



```
make username-credentials
make setup-funding-wallet
make fund-username
```

Setup network
```
# find external ip addr
> curl -4 ifconfig.me
81.57.83.175% # My public IP

# find your internal ip addr
> ifconfig | grep "inet " | grep -v 127.0.0.1
	inet 192.168.1.78 netmask 0xffffff00 broadcast 192.168.1.255
```

Send your ext IP to your peer, and make sure you have a port forwarding for your internal IP and choose a port e.g. port 8858, then check your peer

Toubleshoting (remove below)
ask your peer to open a small server on the port

```
python3 -m http.server 8858
```

Then, try to connect to your peer
```
> nc -zv 50.25.233.241 8858
Connection to 50.25.233.241 port 8858 [tcp/*] succeeded!
```

If this works:
- Set peer details into env
- Copy peer keys into your infra/$peer folder

```
# start hydra node
make start-user-node
```


Initialize hydra head

after initi

```
make commit-funds-username
```

## Glossary

- **Hydra Head**: A Layer 2 scaling solution that allows off-chain transactions
- **Layer 1**: The main Cardano blockchain
- **Layer 2**: The Hydra network for off-chain transactions
- **tADA**: Test ADA used on the preprod network
- **UTxO**: Unspent Transaction Output
- **WebSocket**: Protocol for real-time communication between nodes


