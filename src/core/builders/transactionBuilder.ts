import { Address } from "@hyperionbt/helios";
import { getUtxos } from "../../adapters/hydraAdapter";
import { Utxos } from "../types/utxo";
import { Transaction, TransactionInput, TransactionOutput, TransactionMetadata, RawTransaction, SignedTransaction } from "../types/transaction";
import { getConfig } from "../../utils/config";
import { Logger } from "../../utils/logger";
import { CardanoCli } from "../../adapters/cardanoCli";
import * as path from 'path';
import * as fs from 'fs';

const logger = Logger.getInstance();

export class HydraTransactionBuilder {
  private transaction: Transaction;
  private websocketUrl: string;
  private cardanoCli: CardanoCli;

  constructor(websocketUrl: string = "ws://127.0.0.1:4001") {
    logger.info("Initializing HydraTransactionBuilder with websocket URL:", websocketUrl);
    this.transaction = {
      inputs: [],
      outputs: [],
    };
    this.websocketUrl = websocketUrl;
    
    // Initialize Cardano CLI
    const config = getConfig();
    this.cardanoCli = new CardanoCli({
      network: "testnet",
      era: "conway",
      protocolParamsFile: path.join(config.paramsDir, 'protocol-parameters.json')
    });
  }

  /**
   * Add an input to the transaction from a UTXO
   * @param utxoKey The UTXO key in format "txHash#index"
   */
  addInput(utxoKey: string): this {
    logger.debug("Adding input with UTXO key:", utxoKey);
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
    logger.debug("Adding output - Address:", address, "Amount:", amount);
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
    logger.debug("Setting metadata:", metadata);
    this.transaction.metadata = metadata;
    return this;
  }

  /**
   * Set transaction fee
   * @param fee The fee in lovelace
   */
  setFee(fee: number): this {
    logger.debug("Setting fee:", fee);
    this.transaction.fee = fee;
    return this;
  }

  /**
   * Build the raw transaction
   * @returns The built raw transaction
   */
  async build(): Promise<RawTransaction> {
    logger.info("Building raw transaction...");
    const config = getConfig();
    
    // Get the first input and output
    const firstInput = this.transaction.inputs[0];
    const firstOutput = this.transaction.outputs[0];
    
    const txIn = `${firstInput.txHash}#${firstInput.txIndex}`;
    const txOut = `${firstOutput.address}+${firstOutput.amount}`;
    
    // Build raw transaction
    const rawTx = await this.cardanoCli.buildTransaction(
      txIn,
      txOut,
      this.transaction.outputs[1]?.address || '',
      this.transaction.outputs[1]?.amount || 0,
      this.transaction.metadata || {}
    );

    return rawTx;
  }

  /**
   * Sign the transaction
   * @param signingKeyFile Path to the signing key file
   * @returns The signed transaction
   */
  async sign(signingKeyFile: string): Promise<SignedTransaction> {
    logger.info("Signing transaction...");
    const config = getConfig();
    
    // Build the transaction first
    const rawTx = await this.build();
    
    // Sign the transaction
    const signedTx = await this.cardanoCli.signTransaction(
      rawTx,
      signingKeyFile
    );

    return signedTx;
  }

  /**
   * Submit the signed transaction to the Hydra head
   * @param signedTx The signed transaction to submit
   * @returns Promise that resolves when the transaction is submitted
   */
  async submit(signedTx: SignedTransaction): Promise<void> {
    logger.info("Preparing to submit transaction...");
    const message = {
      tag: "NewTx",
      transaction: signedTx,
    };
    logger.debug("Message to submit:", message);

    logger.info("Connecting to WebSocket at:", this.websocketUrl);
    const ws = new WebSocket(this.websocketUrl);
    
    return new Promise((resolve, reject) => {
      ws.onopen = () => {
        logger.info("WebSocket connection established");
        logger.info("Sending transaction...");
        ws.send(JSON.stringify(message));
        ws.close();
        logger.info("WebSocket connection closed");
        resolve();
      };

      ws.onerror = (error) => {
        logger.error("WebSocket error:", error);
        reject(error);
      };

      ws.onclose = (event) => {
        logger.debug("WebSocket closed with code:", event.code, "reason:", event.reason);
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
  logger.info("Creating transaction from UTXO");
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