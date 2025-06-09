This document is related to cPoker Hydra Case Study: Implement Interactive dApp, and explains how to do the first run of the Hydra POC on MacOS.

The contents of this article are coming from https://github.com/Cardano-After-Dark/hydra-poc > main branch (commit b7f813c ).

## Getting started

Prepare a folder and clone the project

```
mkdir ~/temp && cd ~/temp
git clone git@github.com:Cardano-After-Dark/hydra-poc.git
cd hydra-poc
```

Open the project to consult the readme for the details
![[attach/Pasted image 20250511125103.png]]

## Installing and Setting Up Env Variables

Run the installation scripts and set up the environment variables to have a running environment

```
./install.sh
```

```
./scripts/utils/set-env-vars.sh
```

Your output should look like this
![[attach/Pasted image 20250511125718.png]]

## Setting up Cardano Node

Set up and start the Cardano node:

```
./setup-cardano-node.sh
```

The setup should be relatively quick:

The initial download and unpack of the cardano db should be done in a minute, if you have a fast internet connection.
![[attach/Pasted image 20250511130330.png]]

The replay of blocks from 0 to 100% should take 5-10 minutes, on a good machine with enough RAM.
![[attach/Pasted image 20250511130503.png]]
...
![[attach/Pasted image 20250511132052.png]]
When completed, leave the terminal open with the cardano node running
![[attach/Pasted image 20250511132354.png]]

Note: if requested, grant terminal the permission to access local network.

Open a new terminal, and query the tip of the running node

```
./scripts/utils/query-tip.sh
```

In your new terminal, you should see something like this
![[attach/Pasted image 20250511132824.png]]
While in the terminal running the cardano node, you should notice that the other process queried the node.
![[attach/Pasted image 20250511133018.png]]

## Prepare credentials for A and B
We're going to add two hydra nodes connected to the cardano node. Each of these node will be owned by a different party, let's call them Alice (A) and Bob (B). 

Run the script

```
./setup-and-fund-nodes.sh
```

The script will tell you to open [Cardano Testnet Faucet](https://docs.cardano.org/cardano-testnets/tools/faucet/) and select to send test funds into a specific address in Preprod Testnet. With this operation, we'll send funds needed to the test operations we're running later.

![[attach/Pasted image 20250511133815.png]]

When complete, the script will tell you the funds are sent.

![[attach/Pasted image 20250511134139.png]]

Let's complete this step by verifying the funds are in place 

```
./scripts/utils/query-node-funds.sh
```

The output should look like the one below
![[attach/Pasted image 20250511134430.png]]

## Launch two Hydra Nodes for Alice and Bob

Open a new terminal and start the Alice Hydra node

```
./start-alice-node.sh
```

Open a new terminal and start the Bob's Hydra node

```
./start-bob-node.sh
```

Now, you should have 
- a terminal running the cardano node
- a terminal running the Hydra node for Alice
- a terminal running the Hydra node for Bob

![[attach/Pasted image 20250511134801.png]]

Let's keep all this infrastructure running, and launch two more terminals to verify the nodes are running by connecting to their websocket APIs

Open a terminal

```
websocat ws://127.0.0.1:4001 | jq # For Alice
```

Open another terminal

```
websocat ws://127.0.0.1:4002 | jq # For Bob
```

You should see greeting messages from both
![[attach/Pasted image 20250511135151.png]]

## Opening a Hydra Head

With all the nodes running, we initiate a Hydra head through the Websocket connection

In one of the two websocket sessions, we send the initiation message. 

```json
{ "tag": "Init" }
```

Note: after entering the message and pressing enter, if nothing happens press enter again. It should succeed in a few seconds. If it fails, just send the message again.

If working, you'll see a `HeadIsInitializing` message in the WebSocket output
When working, you'll see a HeadsIsInitializing message like below

![[attach/Pasted image 20250511150159.png]]

Next, in a new terminal, commit the funds to the head

```
./scripts/transactions/commit-funds.sh
```

![[attach/Pasted image 20250511150405.png]]

## Layer 2 transactions

Open a new terminal, navigate to the project and make sure you are using nodejs v. 23+ and pnpm v 9+. If not install and use node 23 and pnpm 9. 

Then, run 

![[attach/Pasted image 20250511150846.png]]

Then, run the install

```
pnpm install
```

![[attach/Pasted image 20250511151026.png]]

Now, open two terminals: one for the Terminal User Interface (TUI)m and the other for the transaction stream viewer: 

In the TUI terminal

```
pnpm run tui
```

In the Stream terminal

```
pnpm run stream
```

Note: make sure you check the node version in each terminal before launching the commands. 

![[attach/Pasted image 20250511151711.png]]


TUI is a simplified interface to send and view sent messages, while the Stream Viewer provides real time monitoring in the hydra head. So, for instance, after sending a couple of messages through TUI, we'll see a situation like the one in the image

![[attach/Pasted image 20250511151650.png]]

Of course, when sending messages through TUI, you can also check the status on the websockets and hydra nodes.

## Closing Hydra Head

When done transacting on Hydra, and settle back to layer 1, send this message through the websocket connecttion:

```
{ "tag": "Close" }
```

If all goes as expected, you shall see a `HeadIsClosed` response message. 
Then, if you wait patiently the contestation period expiration(e.g. 30-60 sec), you shall see a message `ReadyToFanout`

![[attach/Pasted image 20250511152359.png]]

At this point you can finalize the head closure

```
{ "tag": "Fanout" }
```

With this:
- the fanout transaction is submitted to Layer1
- funds are distributed according to the final head state.
- The head transitions to `HeadIsFinalized` state

![[attach/Pasted image 20250511152746.png]]

Open a new terminal and verify the final balances on Layer1 with this script:

```
./scripts/utils/query-node-funds.sh
```

The result shall look like the image
![[attach/Pasted image 20250511153249.png]]

Now that the testing sequence is complete, return any unused test ada to the funding wallet to be used again later:

```
./scripts/utils/refund-funding-wallet.sh
```

![[attach/Pasted image 20250511153451.png]]

And this concludes your initial walkthrough running a hydra head