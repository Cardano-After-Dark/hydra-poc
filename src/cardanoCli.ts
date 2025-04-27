import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

interface CardanoCliConfig {
  network: string;
  era: string;
  protocolParamsFile: string;
}

export class CardanoCli {
  private config: CardanoCliConfig;
  private env: NodeJS.ProcessEnv;
  private cardanoCliPath: string;

  constructor(config: CardanoCliConfig) {
    this.config = config;
    // Set environment variables from .env
    this.env = {
      ...process.env,
      PATH: process.env.PATH,
      CARDANO_NODE_SOCKET_PATH: process.env.CARDANO_NODE_SOCKET_PATH,
      DYLD_FALLBACK_LIBRARY_PATH: process.env.DYLD_FALLBACK_LIBRARY_PATH,
      CARDANO_NODE_NETWORK_ID: process.env.CARDANO_NODE_NETWORK_ID,
      TESTNET_MAGIC: process.env.TESTNET_MAGIC
    };

    // Set the full path to cardano-cli
    this.cardanoCliPath = path.join(process.env.NODE_DIR || '', 'bin/cardano-cli');
    console.log("Using cardano-cli at:", this.cardanoCliPath);
  }

  private async executeCommand(command: string): Promise<string> {
    console.log("Executing command:", command);
    try {
      const { stdout, stderr } = await execAsync(command, { env: this.env });
      if (stderr) console.warn("Command stderr:", stderr);
      return stdout.trim();
    } catch (error) {
      console.error("Command execution failed:", error);
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
  ): Promise<void> {
    console.log("Building transaction...");
    let command = `${this.cardanoCliPath} ${this.config.era} transaction build-raw \
      --tx-in ${txIn} \
      --tx-out ${txOut}`;

    // Only add change output if amount is greater than zero
    if (changeAmount > 0) {
      command += ` \
      --tx-out ${changeAddress}+${changeAmount}`;
    }

    command += ` \
      --metadata-json-file ${metadataFile} \
      --fee 0 \
      --out-file ${outputFile}`;

    await this.executeCommand(command);
    console.log("Transaction built and saved to:", outputFile);
  }

  async signTransaction(
    txBodyFile: string,
    signingKeyFile: string,
    outputFile: string
  ): Promise<void> {
    console.log("Signing transaction...");
    const command = `${this.cardanoCliPath} ${this.config.era} transaction sign \
      --tx-body-file ${txBodyFile} \
      --signing-key-file ${signingKeyFile} \
      --out-file ${outputFile}`;

    await this.executeCommand(command);
    console.log("Transaction signed and saved to:", outputFile);
  }
} 