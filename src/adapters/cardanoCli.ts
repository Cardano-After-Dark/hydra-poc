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
  private tempDir: string;

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
    this.tempDir = path.join(getConfig().txsDir, 'temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
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

  private getTempFilePath(prefix: string): string {
    return path.join(this.tempDir, `${prefix}-${Date.now()}.json`);
  }

  private cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      logger.warn("Failed to cleanup temp file:", filePath, error);
    }
  }

  async buildTransaction(
    txIn: string,
    txOut: string,
    changeAddress: string,
    changeAmount: number,
    metadata: Record<string, any>
  ): Promise<RawTransaction> {
    logger.info("Building transaction...");
    
    // Create temporary metadata file
    const metadataFile = this.getTempFilePath('metadata');
    fs.writeFileSync(metadataFile, JSON.stringify(metadata));
    
    // Create temporary output file
    const outputFile = this.getTempFilePath('tx-raw');
    
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

    try {
      await this.executeCommand(command);
      logger.info("Transaction built successfully");
      
      // Read the raw transaction
      const rawTx = JSON.parse(fs.readFileSync(outputFile, 'utf8')) as RawTransaction;
      return rawTx;
    } finally {
      // Cleanup temporary files
      this.cleanupTempFile(metadataFile);
      this.cleanupTempFile(outputFile);
    }
  }

  async signTransaction(
    txBody: RawTransaction,
    signingKeyFile: string
  ): Promise<SignedTransaction> {
    logger.info("Signing transaction...");
    
    // Create temporary files
    const txBodyFile = this.getTempFilePath('tx-body');
    const outputFile = this.getTempFilePath('tx-signed');
    
    try {
      // Write transaction body to temp file
      fs.writeFileSync(txBodyFile, JSON.stringify(txBody));
      
      const command = `${this.cardanoCliPath} ${this.config.era} transaction sign \
        --tx-body-file ${txBodyFile} \
        --signing-key-file ${signingKeyFile} \
        --out-file ${outputFile}`;

      await this.executeCommand(command);
      logger.info("Transaction signed successfully");
      
      // Read the signed transaction
      const signedTx = JSON.parse(fs.readFileSync(outputFile, 'utf8')) as SignedTransaction;
      return signedTx;
    } finally {
      // Cleanup temporary files
      this.cleanupTempFile(txBodyFile);
      this.cleanupTempFile(outputFile);
    }
  }
} 