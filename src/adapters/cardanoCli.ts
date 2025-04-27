import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { CardanoCliConfig, RawTransaction, SignedTransaction } from '../core/types/transaction';
import { getConfig, getCardanoCliPath } from '../utils/config';
import { Logger } from '../utils/logger';

const execAsync = promisify(exec);
const logger = Logger.getInstance();

export class CardanoCli {
  private config: CardanoCliConfig;
  private env: NodeJS.ProcessEnv;
  private cardanoCliPath: string;

  constructor(config: CardanoCliConfig) {
    this.config = config;
    this.env = {
      ...process.env,
      PATH: process.env.PATH,
      CARDANO_NODE_SOCKET_PATH: process.env.CARDANO_NODE_SOCKET_PATH,
      DYLD_FALLBACK_LIBRARY_PATH: process.env.DYLD_FALLBACK_LIBRARY_PATH,
      CARDANO_NODE_NETWORK_ID: process.env.CARDANO_NODE_NETWORK_ID,
      TESTNET_MAGIC: process.env.TESTNET_MAGIC
    };

    this.cardanoCliPath = getCardanoCliPath();
    logger.info("Using cardano-cli at:", this.cardanoCliPath);
  }

  private async executeCommand(command: string): Promise<string> {
    logger.debug("Executing command:", command);
    try {
      const { stdout, stderr } = await execAsync(command, { env: this.env });
      if (stderr) logger.warn("Command stderr:", stderr);
      return stdout.trim();
    } catch (error) {
      logger.error("Command execution failed:", error);
      throw error;
    }
  }

  async buildTransaction(
    txIn: string,
    txOut: string,
    changeAddress: string,
    changeAmount: number,
    metadataFile: string,
    outputFile: string
  ): Promise<RawTransaction> {
    logger.info("Building transaction...");
    let command = `${this.cardanoCliPath} ${this.config.era} transaction build-raw \
      --tx-in ${txIn} \
      --tx-out ${txOut}`;

    if (changeAmount > 0) {
      command += ` \
      --tx-out ${changeAddress}+${changeAmount}`;
    }

    command += ` \
      --metadata-json-file ${metadataFile} \
      --fee 0 \
      --out-file ${outputFile}`;

    await this.executeCommand(command);
    logger.info("Transaction built and saved to:", outputFile);

    // Read and return the raw transaction
    const rawTx = JSON.parse(fs.readFileSync(outputFile, 'utf8')) as RawTransaction;
    return rawTx;
  }

  async signTransaction(
    txBodyFile: string,
    signingKeyFile: string,
    outputFile: string
  ): Promise<SignedTransaction> {
    logger.info("Signing transaction...");
    const command = `${this.cardanoCliPath} ${this.config.era} transaction sign \
      --tx-body-file ${txBodyFile} \
      --signing-key-file ${signingKeyFile} \
      --out-file ${outputFile}`;

    await this.executeCommand(command);
    logger.info("Transaction signed and saved to:", outputFile);

    // Read and return the signed transaction
    const signedTx = JSON.parse(fs.readFileSync(outputFile, 'utf8')) as SignedTransaction;
    return signedTx;
  }
} 