import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { CardanoCliConfig, RawTransaction, SignedTransaction } from '../core/types/transaction';
import { getConfig, getCardanoCliPath } from '../utils/config';
import logger from '../utils/debugLogger';

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
    logger.info("Using cardano-cli at: " + this.cardanoCliPath);
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
      logger.warning("Failed to cleanup temp file: " + filePath, { error });
    }
  }

  private async executeCommand(args: string[]): Promise<string> {
    logger.critical("Executing: " + this.cardanoCliPath + ' ' + args.join(' '));
    
    return new Promise((resolve, reject) => {
      const process = spawn(this.cardanoCliPath, args, { 
        env: this.env,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('error', (error) => {
        logger.error("Process error:", error);
        reject(error);
      });

      process.on('close', (code) => {
        if (code !== 0) {
          logger.error("Process exited with code: " + code);
          logger.error("Stderr: " + stderr);
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        } else {
          if (stderr) logger.warning("Command stderr: " + stderr);
          resolve(stdout.trim());
        }
      });
    });
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
    
    const args = [
      this.config.era,
      'transaction',
      'build-raw',
      '--tx-in', txIn,
      '--tx-out', txOut
    ];

    if (changeAmount > 0) {
      args.push('--tx-out', `${changeAddress}+${changeAmount}`);
    }

    args.push(
      '--metadata-json-file', metadataFile,
      '--fee', '0',
      '--protocol-params-file', this.config.protocolParamsFile,
      '--out-file', outputFile
    );

    logger.critical("=== CARDANO CLI DEBUG ===");
    logger.critical("Full command: " + this.cardanoCliPath + ' ' + args.join(' '));
    logger.critical("Transaction inputs: " + `--tx-in ${txIn}`);
    logger.critical("Transaction outputs: " + `--tx-out ${txOut}` + (changeAmount > 0 ? ` --tx-out ${changeAddress}+${changeAmount}` : ''));
    logger.critical("========================");

    try {
      await this.executeCommand(args);
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
      
      const args = [
        this.config.era,
        'transaction',
        'sign',
        '--tx-body-file', txBodyFile,
        '--signing-key-file', signingKeyFile,
        '--out-file', outputFile
      ];

      await this.executeCommand(args);
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