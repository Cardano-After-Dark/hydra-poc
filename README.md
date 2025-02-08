# 🃏 cPoker Hydra Case Study  

🚀 **Exploring Real-Time Transaction Handling & Cryptographic Protocols on Hydra** 🚀  

## 📌 Overview  
This repository documents the **cPoker Hydra Case Study**, where we implement and test **real-time, multi-user transactions on Cardano** using **Hydra**. The focus is on **handling cPoker ingame transactions, locking funds, releasing winnings**, and **integrating cryptographic protocols** within Hydra Heads.

---

## 🎯 Project Goals  

✅ **Study the feasibility** of running multi-user game transactions inside Hydra.  
✅ **Develop smart contracts** to handle **fund locking, in-game transactions, and payouts**.  
✅ **Benchmark Hydra’s transaction speed & efficiency** for gaming use cases.  
✅ **Implement a cryptographic protocol** (Threshold ElGamal) inside Hydra Heads.  
✅ **Provide open-source documentation** to help developers use Hydra for interactive dApps.  

---

## 🔹 How Hydra is Used in This Project  

| Feature                | Usage in cPoker |
|------------------------|--------------------------------------------------|
| **Hydra Heads**        | Enabling **real-time, multi-user transactions** with minimal fees. |
| **Smart Contracts**    | Locking player funds, handling game logic, and ensuring fair payouts. |
| **Off-Chain Execution** | Running game logic **off-chain within Hydra** for speed and efficiency. |
| **Cryptography**       | Testing **Threshold ElGamal encryption** for secure information exchange. |

---

## 🏗️ Project Structure  

```
.
├── src/
│   ├── contracts/                  # Plutus smart contracts for Hydra-based game transactions
│   ├── transactions/                # Scripts for committing & releasing UTxOs in Hydra
│   └── cryptography/                 # Cryptographic protocol implementation (Threshold ElGamal)
├── docs/
│   ├── transaction-feasibility.md   # Research on Hydra’s transaction handling capabilities
│   ├── fund-release-process.md      # Explanation of how game winnings are paid out
│   ├── smart-contract-examples.md   # Sample transactions for interacting with Hydra
│   ├── hydra-fees-analysis.md       # Cost optimization & benchmarking Hydra transactions
│   ├── feasibility-study.md         # Full research paper on Hydra for gaming applications
│   └── setup-guide.md               # Step-by-step instructions to run Hydra locally
└── README.md
```

---

## 🔧 Setup & Installation  

To run **Hydra locally**, follow these steps:  

### 1️⃣ Clone the Repository  

```bash
git clone https://github.com/Cardano-After-Dark/hydra-poc.git
cd hydra-poc
```

### 2️⃣ Install Dependencies  

Ensure you have **Cardano Node, Hydra, and required dependencies installed**:  

```bash
curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.dev | sh
nix build .#hydra-node
```

### 3️⃣ Run Hydra Head Locally  

Start the Hydra Head and connect it to **Cardano testnet**:  

```bash
hydra-node \
  --node-id 1 \
  --api-host 127.0.0.1 \
  --api-port 4001 \
  --persistence-dir ./hydra-data \
  --network-id 1097911063 \
  --cardano-signing-key ./testnet-skey.skey \
  --cardano-verification-key ./testnet-vkey.vkey \
  --cardano-node-socket ./db/node.socket \
  --hydra-scripts-tx-id <YOUR_TX_ID>
```

---

## 🧪 Running a Test Transaction in Hydra  

Once the Hydra Head is running, you can **commit UTxOs and perform game transactions**:

### ✅ Commit Funds to Hydra  
```bash
hydra-tx commit \
  --tx-in <INPUT_UTXO> \
  --testnet-magic 1097911063 \
  --out-file commit_tx.raw
```

### ✅ Place a Bet (Example Transaction)  
```bash
hydra-tx build \
  --tx-in <COMMITTED_UTXO> \
  --tx-out <GAME_ADDRESS>+1000000 \
  --testnet-magic 1097911063 \
  --out-file bet_tx.raw
```

### ✅ Release Funds After Game Ends  
```bash
hydra-tx close
hydra-tx finalize
```

---

## 📖 Documentation  

under construction

## 💡 Contributing  

We welcome **contributions** from the community!  

1️⃣ Fork the repository  
2️⃣ Submit a pull request with your changes  
3️⃣ Join discussions in the [**Cardano After Dark Discord** ](https://discord.gg/pffzDQdXuk) 

🔗 **Join the conversation!** [Cardano Forum Discussion](#) (to be created)  

---

## 🛠️ Roadmap  

✔ **Milestone 1: Feasibility Study** ✅  
🔄 **Milestone 2: Implement Cryptographic Transactions** 🏗️  
⏳ **Milestone 3: Finalize & Benchmark Hydra Performance** ⏳  

---

## 🔗 Useful Links  

- **Hydra Documentation:** [Hydra Family](https://hydra.family/)  
- **Cardano Developer Portal:** [Cardano Docs](https://developers.cardano.org/)  
- **Plutus Smart Contracts:** [Plutus Playground](https://playground.plutus.iohkdev.io/)  

---

## 📝 License  

TBD

📜 **See LICENSE.md for details.**  

---
🚀 **cPoker Hydra Case Study – Pushing the Limits of Real-Time Cardano Transactions!** 🚀  
