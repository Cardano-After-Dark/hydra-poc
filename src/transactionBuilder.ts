import { Address } from "@hyperionbt/helios";
import { Utxos, getUtxos } from "./hydraAdapter";

interface TransactionOutput {
  address: string;
  amount: number;
}

interface TransactionInput {
  txHash: string;
  txIndex: number;
}

interface TransactionMetadata {
  [key: string]: any;
}

interface Transaction {
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  metadata?: TransactionMetadata;
  fee?: number;
}

export class HydraTransactionBuilder {
  private transaction: Transaction;
  private websocketUrl: string;

  constructor(websocketUrl: string = "ws://127.0.0.1:4001") {
    console.log("Initializing HydraTransactionBuilder with websocket URL:", websocketUrl);
    this.transaction = {
      inputs: [],
      outputs: [],
    };
    this.websocketUrl = websocketUrl;
  }

  /**
   * Add an input to the transaction from a UTXO
   * @param utxoKey The UTXO key in format "txHash#index"
   */
  addInput(utxoKey: string): this {
    console.log("Adding input with UTXO key:", utxoKey);
    const [txHash, txIndex] = utxoKey.split("#");
    this.transaction.inputs.push({
      txHash,
      txIndex: parseInt(txIndex),
    });
    return this;
  }

  /**
   * Add an output to the transaction
   * @param address The recipient address
   * @param amount The amount in lovelace
   */
  addOutput(address: string, amount: number): this {
    console.log("Adding output - Address:", address, "Amount:", amount);
    this.transaction.outputs.push({
      address,
      amount,
    });
    return this;
  }

  /**
   * Set transaction metadata
   * @param metadata The metadata object
   */
  setMetadata(metadata: TransactionMetadata): this {
    console.log("Setting metadata:", metadata);
    this.transaction.metadata = metadata;
    return this;
  }

  /**
   * Set transaction fee
   * @param fee The fee in lovelace
   */
  setFee(fee: number): this {
    console.log("Setting fee:", fee);
    this.transaction.fee = fee;
    return this;
  }

  /**
   * Build the transaction
   * @returns The built transaction
   */
  build(): Transaction {
    console.log("Building transaction:", this.transaction);
    return this.transaction;
  }

  /**
   * Submit the transaction to the Hydra head
   * @returns Promise that resolves when the transaction is submitted
   */
  async submit(): Promise<void> {
    console.log("Preparing to submit transaction...");
    const message = {
      tag: "NewTx",
      transaction: this.transaction,
    };
    console.log("Message to submit:", message);

    console.log("Connecting to WebSocket at:", this.websocketUrl);
    const ws = new WebSocket(this.websocketUrl);
    
    return new Promise((resolve, reject) => {
      ws.onopen = () => {
        console.log("WebSocket connection established");
        console.log("Sending transaction...");
        ws.send(JSON.stringify(message));
        ws.close();
        console.log("WebSocket connection closed");
        resolve();
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        reject(error);
      };

      ws.onclose = (event) => {
        console.log("WebSocket closed with code:", event.code, "reason:", event.reason);
      };
    });
  }
}

/**
 * Helper function to create a transaction from a sender's UTXO
 * @param senderAddress The sender's address
 * @param recipientAddress The recipient's address
 * @param amount The amount to send in lovelace
 * @param hydraHeadUrl The URL of the Hydra head
 * @returns Promise containing the transaction builder
 */
export async function createTransactionFromUtxo(
  senderAddress: Address,
  recipientAddress: string,
  amount: number,
  hydraHeadUrl: string = "http://127.0.0.1:4001"
): Promise<HydraTransactionBuilder> {
  const utxos = await getUtxos(senderAddress, hydraHeadUrl);
  const utxoKeys = Object.keys(utxos);
  
  if (utxoKeys.length === 0) {
    throw new Error("No UTXOs found for the sender address");
  }

  const firstUtxo = utxos[utxoKeys[0]];
  const totalAmount = firstUtxo.value.lovelace;
  const changeAmount = totalAmount - amount;

  const builder = new HydraTransactionBuilder();
  builder
    .addInput(utxoKeys[0])
    .addOutput(recipientAddress, amount)
    .addOutput(senderAddress.toBech32(), changeAmount)
    .setFee(0);

  return builder;
} 