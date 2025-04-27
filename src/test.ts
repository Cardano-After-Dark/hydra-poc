import { Address } from "@hyperionbt/helios";
import { getUtxos } from "./hydraAdapter";
import { CardanoCli } from "./cardanoCli";
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log("Starting transaction process...");
  
  const senderAddress = Address.fromBech32("addr_test1vql8mpv20pdcr0pzqwyl23xsdejz5p9umc9rtk0xcha97vsuynzsz");
  console.log("Sender address:", senderAddress.toBech32());
  
  const recipientAddress = "addr_test1vql8mpv20pdcr0pzqwyl23xsdejz5p9umc9rtk0xcha97vsuynzsz";
  console.log("Recipient address:", recipientAddress);
  
  const amount = 1000000; // 1 ADA in lovelace
  console.log("Amount to send:", amount);
  
  const fee = 0; // Example fee
  console.log("Transaction fee:", fee);

  // Get UTXOs to calculate total input amount
  console.log("Fetching UTXOs for sender...");
  const utxos = await getUtxos(senderAddress);
  console.log("UTXOs found:", utxos);
  
  const utxoKeys = Object.keys(utxos);
  console.log("UTXO keys:", utxoKeys);
  
  if (utxoKeys.length === 0) {
    throw new Error("No UTXOs found for the sender address");
  }

  const firstUtxo = utxos[utxoKeys[0]];
  console.log("Using UTXO:", firstUtxo);
  
  const totalInputAmount = firstUtxo.value.lovelace;
  console.log("Total input amount:", totalInputAmount);
  
  const changeAmount = totalInputAmount - amount - fee;
  console.log("Change amount:", changeAmount);

  // Create metadata file with correct format (numeric keys)
  const metadata = {
    674: { // Using a random numeric key
      msg: "Hello from TypeScript!"
    }
  };
  const metadataFile = path.join(process.env.TXS_DIR || '', 'metadata.json');
  fs.writeFileSync(metadataFile, JSON.stringify(metadata));
  console.log("Metadata file created:", metadataFile);

  // Initialize Cardano CLI
  const cardanoCli = new CardanoCli({
    network: "testnet",
    era: "conway",
    protocolParamsFile: path.join(process.env.PARAMS_DIR || '', 'protocol-parameters.json')
  });

  // Build transaction
  const txBodyFile = path.join(process.env.TXS_DIR || '', 'tx.json');
  await cardanoCli.buildTransaction(
    utxoKeys[0],
    `${recipientAddress}+${amount}`,
    senderAddress.toBech32(),
    changeAmount,
    metadataFile,
    txBodyFile
  );

  // Sign transaction
  const signingKeyFile = path.join(process.env.CREDENTIALS_DIR || '', 'alice/alice-funds.sk');
  console.log("Using signing key file:", signingKeyFile);
  
  // Check if signing key file exists
  if (!fs.existsSync(signingKeyFile)) {
    throw new Error(`Signing key file not found at: ${signingKeyFile}`);
  }

  const signedTxFile = path.join(process.env.TXS_DIR || '', 'tx-signed.json');
  await cardanoCli.signTransaction(
    txBodyFile,
    signingKeyFile,
    signedTxFile
  );

  // Read signed transaction
  const signedTx = JSON.parse(fs.readFileSync(signedTxFile, 'utf8'));
  console.log("Signed transaction:", signedTx);

  // Send over WebSocket
  console.log("Sending transaction to Hydra head...");
  const ws = new WebSocket(`ws://127.0.0.1:${process.env.ALICE_API_PORT || '4001'}`);
  
  await new Promise((resolve, reject) => {
    ws.onopen = () => {
      console.log("WebSocket connection established");
      const message = {
        tag: "NewTx",
        transaction: signedTx
      };
      console.log("Sending message:", message);
      ws.send(JSON.stringify(message));
      ws.close();
      resolve(undefined);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      reject(error);
    };
  });

  console.log("Transaction process completed successfully!");
}

main().catch(error => {
  console.error("Error in main:", error);
  process.exit(1);
});
