import { Address } from "@hyperionbt/helios";
import { getUtxos } from "../../adapters/hydraAdapter";
import { Utxos } from "../types/utxo";
import { Transaction, TransactionInput, TransactionOutput, TransactionMetadata, RawTransaction, SignedTransaction } from "../types/transaction";
import { getConfig } from "../../utils/config";
import logger from "../../utils/debugLogger";
import { CardanoCli } from "../../adapters/cardanoCli";
import * as path from 'path';
import * as fs from 'fs';

export class HydraTransactionBuilder {
  private transaction: Transaction;
  private websocketUrl: string;
  private cardanoCli: CardanoCli;

  constructor(websocketUrl: string = "ws://127.0.0.1:4001") {
    logger.info(`Initializing HydraTransactionBuilder with websocket URL: ${websocketUrl}`);
    debugger
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
    logger.debug("Adding input with UTXO key:", {}, utxoKey);
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
    logger.debug("Adding output - Address:", {}, address, "Amount:", amount);
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
    logger.debug("Setting fee:", {}, fee);
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
    logger.info("Preparing to submit transaction...", {
      transaction: { type: signedTx.type, description: signedTx.description }
    });

    const message = {
      tag: "NewTx",
      transaction: signedTx,
    };
    logger.debug("Message to submit:", {
      message: { tag: message.tag, transactionType: message.transaction.type }
    });

    logger.info("Connecting to WebSocket at:", {
      connection: { url: this.websocketUrl }
    });

    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.websocketUrl);
        
        // Connection timeout
        const connectionTimeout = setTimeout(() => {
          logger.error("WebSocket connection timeout", {
            connection: { url: this.websocketUrl, timeout: 5000 }
          });
          ws.close();
          reject(new Error("WebSocket connection timeout"));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(connectionTimeout);
          logger.info("WebSocket connection established", {
            connection: { url: this.websocketUrl, protocol: ws.protocol }
          });

          try {
            logger.info("Sending transaction...", {
              transaction: { type: signedTx.type }
            });
            ws.send(JSON.stringify(message));
            
            // Add a small delay before closing to ensure message is sent
            setTimeout(() => {
              logger.info("Closing WebSocket connection", {
                connection: { url: this.websocketUrl }
              });
              ws.close();
              logger.info("WebSocket connection closed", {
                connection: { url: this.websocketUrl }
              });
              resolve();
            }, 100);
          } catch (sendError: any) {
            logger.error("Error sending transaction:", {
              error: { message: sendError.message, stack: sendError.stack }
            }, sendError);
            ws.close();
            reject(sendError);
          }
        };

        ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          logger.error("WebSocket error:", {
            error: { 
              message: error.message,
              type: error.type,
              target: error.target ? 'WebSocket' : 'Unknown'
            }
          }, error);
          reject(error);
        };

        ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          logger.debug("WebSocket closed", {
            connection: {
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean
            }
          });
        };

      } catch (connectionError: any) {
        logger.error("Failed to create WebSocket connection:", {
          error: { message: connectionError.message, stack: connectionError.stack }
        }, connectionError);
        reject(connectionError);
      }
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
  debugger
  logger.info("Retrieving UTXOs for sender in hydra head");
  const utxos = await getUtxos(senderAddress, hydraHeadUrl);
  const utxoKeys = Object.keys(utxos);

  if (utxoKeys.length > 0) {
    logger.info(`${utxoKeys.length} UTXOs found for the sender address`);
  }
  else {
    logger.error("No UTXOs found for the sender address");
    throw new Error("No UTXOs found for the sender address");
  }
  debugger

  const firstUtxo = utxos[utxoKeys[0]];
  const totalAmount = firstUtxo.value.lovelace;
  const changeAmount = totalAmount - amount;
  
  debugger
  const builder = new HydraTransactionBuilder();
  builder
    .addInput(utxoKeys[0])
    .addOutput(recipientAddress, amount)
    .addOutput(senderAddress.toBech32(), changeAmount)
    .setFee(0);

  return builder;
} 