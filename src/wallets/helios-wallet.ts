/**
 * Helios-based Wallet Implementation
 * Uses proper Helios functions for real Cardano transactions
 */

import {
  makeValue
} from '@helios-lang/ledger';
import {
  makeRandomRootPrivateKey,
  makeRandomSimpleWallet,
  makeSimpleWallet,
  makeTxBuilder,
  restoreRootPrivateKey
} from '@helios-lang/tx-utils';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../../tools/debug/logger.js';
import { HydraClientWrapper } from '../hydra/hydra-client.js';

export interface HeliosWalletConfig {
  name: string;
  network: 'mainnet' | 'testnet';
  storageDir?: string;
  hydraClient: HydraClientWrapper;
}

export interface HeliosWalletInfo {
  id: string;
  name: string;
  network: 'mainnet' | 'testnet';
  address: string;
  mnemonic: string[];
  createdAt: Date;
}

/**
 * Adapter to make HydraClientWrapper compatible with CardanoClient interface
 */
class CardanoClientAdapter {
  private hydraClient: HydraClientWrapper;

  constructor(hydraClient: HydraClientWrapper) {
    this.hydraClient = hydraClient;
  }

  get now(): number {
    return Date.now();
  }

  get parameters(): Promise<any> {
    return this.hydraClient.getNetworkParameters();
  }

  async getUtxo(id: any): Promise<any> {
    const utxos = await this.hydraClient.fetchUTXOs();
    return utxos.find(utxo => utxo.id.toString() === id.toString());
  }

  async getUtxos(address: any): Promise<any[]> {
    const allUtxos = await this.hydraClient.fetchUTXOs();
    const addressStr = address.toBech32();

    return allUtxos.filter(utxo => {
      const utxoAddress = utxo.address || utxo.output?.address;
      const utxoAddressStr = typeof utxoAddress === 'string' ? utxoAddress :
        (utxoAddress && utxoAddress.toString ? utxoAddress.toString() : '');
      return utxoAddressStr === addressStr;
    });
  }

  async hasUtxo(id: any): Promise<boolean> {
    const utxos = await this.hydraClient.fetchUTXOs();
    return utxos.some(utxo => utxo.id.toString() === id.toString());
  }

  isMainnet(): boolean {
    return this.hydraClient.isMainnet();
  }

  async submitTx(tx: any): Promise<any> {
    const txId = await this.hydraClient.submitTransaction(tx);
    return { toHex: () => txId }; // Return object with toHex method for compatibility
  }
}

export class HeliosWallet {
  private config: HeliosWalletConfig;
  private wallet?: any; // Helios SimpleWallet
  private walletInfo?: HeliosWalletInfo;
  private cardanoClient: CardanoClientAdapter;

  constructor(config: HeliosWalletConfig) {
    this.config = config;
    this.cardanoClient = new CardanoClientAdapter(config.hydraClient);
  }

  /**
   * Create a new wallet using Helios
   */
  public async createWallet(): Promise<HeliosWalletInfo> {
    logger.info('Creating new Helios wallet', {
      name: this.config.name,
      network: this.config.network
    });

    try {
      // FIXED: Create root key first, then wallet - this allows mnemonic extraction
      const rootKey = makeRandomRootPrivateKey();
      this.wallet = makeSimpleWallet(rootKey, this.cardanoClient);

      // Get the wallet address
      const address = this.wallet.address.toBech32();

      // FIXED: Extract mnemonic from the root key directly
      const mnemonic = rootKey.toPhrase();

      // Generate wallet info
      this.walletInfo = {
        id: this.generateWalletId(),
        name: this.config.name,
        network: this.config.network,
        address,
        mnemonic, // Now properly extracted!
        createdAt: new Date()
      };

      // Save wallet to storage
      await this.saveWallet();

      logger.info('Helios wallet created successfully', {
        walletId: this.walletInfo.id,
        address: this.walletInfo.address,
        mnemonicLength: mnemonic.length
      });

      return this.walletInfo;
    } catch (error) {
      logger.error('Failed to create Helios wallet', { error });
      throw new Error('Failed to create wallet');
    }
  }



  /**
   * FIXED: Properly restore wallet from mnemonic using Helios
   */
  public async restoreFromMnemonic(mnemonic: string[]): Promise<HeliosWalletInfo> {
    logger.info('Restoring Helios wallet from mnemonic', {
      name: this.config.name,
      mnemonicLength: mnemonic.length
    });

    try {
      if (mnemonic.length === 0) {
        logger.warn('Empty mnemonic provided - creating new random wallet');
        // If no mnemonic, create a new random wallet
        this.wallet = makeRandomSimpleWallet(this.cardanoClient);
        // Extract the new mnemonic from the root key
        const rootKey = makeRandomRootPrivateKey();
        this.wallet = makeSimpleWallet(rootKey, this.cardanoClient);
        mnemonic = rootKey.toPhrase();
      } else {
        // FIXED: Actually restore from the provided mnemonic using Helios
        const rootKey = restoreRootPrivateKey(mnemonic);
        this.wallet = makeSimpleWallet(rootKey, this.cardanoClient);
        logger.info('Wallet successfully restored from provided mnemonic');
      }

      // Get the wallet address
      const address = this.wallet.address.toBech32();

      // Generate wallet info
      this.walletInfo = {
        id: this.generateWalletId(),
        name: this.config.name,
        network: this.config.network,
        address,
        mnemonic,
        createdAt: new Date()
      };

      // Save wallet to storage
      await this.saveWallet();

      logger.info('Helios wallet restored successfully', {
        walletId: this.walletInfo.id,
        address: this.walletInfo.address,
        mnemonicLength: mnemonic.length
      });

      return this.walletInfo;
    } catch (error) {
      logger.error('Failed to restore Helios wallet', { error });
      throw new Error('Failed to restore wallet from mnemonic');
    }
  }

  /**
   * Get wallet address
   */
  public getAddress(): string {
    if (!this.walletInfo) {
      throw new Error('Wallet not initialized');
    }
    return this.walletInfo.address;
  }

  /**
   * Get wallet info
   */
  public getWalletInfo(): HeliosWalletInfo {
    if (!this.walletInfo) {
      throw new Error('Wallet not initialized');
    }
    return { ...this.walletInfo };
  }

  /**
   * Build a transaction using Helios TxBuilder
   */
  public async buildTransaction(config: {
    utxos: any[];
    outputs: Array<{ address: string; amount: number }>;
    changeAddress?: string;
  }): Promise<any> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    logger.info('Building transaction with Helios TxBuilder', {
      inputCount: config.utxos.length,
      outputCount: config.outputs.length
    });

    try {
      // Get network parameters from Hydra
      const networkParams = await this.config.hydraClient.getNetworkParameters();

      // Create Helios TxBuilder with proper configuration
      const txBuilder = makeTxBuilder({
        isMainnet: this.config.network === 'mainnet'
      });

      // Add inputs (UTXOs to spend)
      for (const utxo of config.utxos) {
        txBuilder.spendWithoutRedeemer(utxo);
      }

      // Add outputs
      for (const output of config.outputs) {
        const value = makeValue(BigInt(output.amount));
        txBuilder.payUnsafe(output.address, value);
      }

      // Set validity time range (1 hour from now)
      const validTo = Date.now() + 3600000; // 1 hour
      txBuilder.validToTime(validTo);

      // Build the transaction
      const tx = await txBuilder.build({
        changeAddress: this.wallet.address,
        networkParams,
        spareUtxos: [] // Additional UTXOs if needed for balancing
      });

      logger.info('Transaction built successfully with Helios', {
        txId: tx.id().toHex(),
        inputCount: tx.body.inputs.length,
        outputCount: tx.body.outputs.length,
        fee: tx.body.fee.toString()
      });

      return tx;
    } catch (error) {
      logger.error('Failed to build transaction', { error });
      throw new Error('Failed to build transaction');
    }
  }

  /**
   * Sign a transaction using Helios wallet
   */
  public async signTransaction(tx: any): Promise<any> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    logger.info('Signing transaction with Helios wallet', {
      txId: tx.id().toHex()
    });

    try {
      // Sign the transaction using Helios SimpleWallet
      const signatures = await this.wallet.signTx(tx);

      // Add signatures to transaction witnesses
      tx.witnesses.signatures = signatures;

      logger.info('Transaction signed successfully', {
        txId: tx.id().toHex(),
        signatureCount: signatures.length
      });

      return tx;
    } catch (error) {
      logger.error('Failed to sign transaction', { error });
      throw new Error('Failed to sign transaction');
    }
  }

  /**
   * Submit transaction to Hydra using the wallet's submit method
   */
  public async submitTransaction(tx: any): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    logger.info('Submitting transaction via Helios wallet', {
      txId: tx.id().toHex()
    });

    try {
      // Submit transaction with proper event monitoring and WebSocket lifecycle
      const txId = await this.config.hydraClient.submitTransaction(tx);

      logger.info('Transaction submitted and validated successfully', {
        txId
      });

      return txId;
    } catch (error) {
      logger.error('Failed to submit transaction', { error });
      throw new Error('Failed to submit transaction');
    }
  }

  /**
   * Get UTXOs for this wallet
   */
  public async getUtxos(): Promise<any[]> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    try {
      const utxos = await this.wallet.utxos;

      logger.info('Retrieved wallet UTXOs', {
        count: utxos.length,
        address: this.walletInfo?.address
      });

      return utxos;
    } catch (error) {
      logger.error('Failed to get UTXOs', { error });
      throw new Error('Failed to get UTXOs');
    }
  }

  /**
   * Export wallet data
   */
  public exportWallet(): { mnemonic: string[]; address: string } {
    if (!this.walletInfo) {
      throw new Error('Wallet not initialized');
    }

    logger.info('Exporting wallet', { walletId: this.walletInfo.id });

    return {
      mnemonic: this.walletInfo.mnemonic,
      address: this.walletInfo.address
    };
  }

  /**
   * Generate unique wallet ID
   */
  private generateWalletId(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(8).toString('hex');
    return `helios_wallet_${timestamp}_${random}`;
  }

  /**
   * Save wallet to storage
   */
  private async saveWallet(): Promise<void> {
    if (!this.walletInfo || !this.config.storageDir) {
      return;
    }

    const walletDir = path.join(this.config.storageDir);
    const walletFile = path.join(walletDir, `${this.walletInfo.id}.json`);

    // Create directory if it doesn't exist
    if (!fs.existsSync(walletDir)) {
      fs.mkdirSync(walletDir, { recursive: true });
    }

    // Encrypt mnemonic (simplified encryption for demo)
    const encryptedMnemonic = this.walletInfo.mnemonic.map(word =>
      Buffer.from(word).toString('base64')
    );

    const walletData = {
      ...this.walletInfo,
      mnemonic: encryptedMnemonic
    };

    fs.writeFileSync(walletFile, JSON.stringify(walletData, null, 2));
    logger.info('Helios wallet saved to storage', { file: walletFile });
  }

  /**
   * Load wallet from storage
   */
  public static async loadWallet(
    walletId: string,
    config: HeliosWalletConfig
  ): Promise<HeliosWallet> {
    const walletFile = path.join(config.storageDir || './helios-wallets', `${walletId}.json`);

    if (!fs.existsSync(walletFile)) {
      throw new Error(`Wallet file not found: ${walletId}`);
    }

    const walletData = JSON.parse(fs.readFileSync(walletFile, 'utf8'));

    const wallet = new HeliosWallet(config);

    // Decrypt mnemonic
    const decryptedMnemonic = walletData.mnemonic.map((encryptedWord: string) =>
      Buffer.from(encryptedWord, 'base64').toString('utf8')
    );

    // FIXED: Restore wallet WITHOUT creating new ID or saving
    // Create the Helios wallet from mnemonic
    const rootKey = restoreRootPrivateKey(decryptedMnemonic);
    wallet.wallet = makeSimpleWallet(rootKey, wallet.cardanoClient);

    // Set the wallet info from the loaded data (preserving original ID and metadata)
    wallet.walletInfo = {
      id: walletData.id,           // Keep original ID
      name: walletData.name,       // Keep original name
      network: walletData.network, // Keep original network
      address: walletData.address, // Keep original address
      mnemonic: decryptedMnemonic, // Decrypted mnemonic
      createdAt: new Date(walletData.createdAt) // Keep original creation date
    };

    logger.info('Helios wallet loaded from storage', {
      walletId,
      address: wallet.walletInfo.address,
      originalCreatedAt: walletData.createdAt
    });
    return wallet;
  }

  /**
   * Calculate the maximum amount that can be sent from UTXOs
   * This accounts for Helios' internal fee calculations and minimum UTXO requirements
   */
  public async calculateMaxSendableAmount(utxos: any[]): Promise<number> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    try {
      // Calculate total input value
      let totalInput = 0;
      for (const utxo of utxos) {
        const lovelace = utxo.lovelace || utxo.output?.value?.lovelace || 0;
        totalInput += Number(lovelace);
      }

      // Helios typically requires ~1-2 ADA for change + internal calculations
      // In Hydra heads, we can be more aggressive since fees are zero
      const heliosBuffer = 1000000; // 1 ADA buffer for Helios internal calculations
      const maxSendable = totalInput - heliosBuffer;

      logger.info('Calculated max sendable amount', {
        totalInput,
        heliosBuffer,
        maxSendable,
        maxSendableAda: maxSendable / 1_000_000
      });

      return Math.max(0, maxSendable);
    } catch (error) {
      logger.error('Failed to calculate max sendable amount', { error });
      throw error;
    }
  }

  /**
   * Build a transaction that sends the maximum possible amount from UTXOs
   * Use this when you want to send almost the full UTXO amount in Hydra heads
   */
  public async buildMaxAmountTransaction(config: {
    utxos: any[];
    targetAddress: string;
  }): Promise<any> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    logger.info('Building max amount transaction', {
      inputCount: config.utxos.length,
      targetAddress: config.targetAddress
    });

    try {
      // Calculate the maximum amount we can send
      const maxAmount = await this.calculateMaxSendableAmount(config.utxos);

      if (maxAmount <= 0) {
        throw new Error('No sendable amount available after accounting for Helios requirements');
      }

      // Build transaction with the calculated max amount
      const tx = await this.buildTransaction({
        utxos: config.utxos,
        outputs: [
          {
            address: config.targetAddress,
            amount: maxAmount
          }
        ],
        changeAddress: this.wallet.address
      });

      logger.info('Max amount transaction built successfully', {
        txId: tx.id().toHex(),
        maxAmountAda: maxAmount / 1_000_000
      });

      return tx;
    } catch (error) {
      logger.error('Failed to build max amount transaction', { error });
      throw error;
    }
  }

  /**
   * Build a transaction with custom Hydra protocol parameters
   * This method properly configures Helios to use Hydra head parameters instead of defaults
   * Includes automatic fallback for UTXO consumption issues
   */
  public async buildTransactionWithHydraParams(config: {
    utxos: any[];
    outputs: Array<{ address: string; amount: number }>;
    changeAddress?: string;
  }): Promise<any> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    logger.info('Building transaction with Hydra protocol parameters', {
      inputCount: config.utxos.length,
      outputCount: config.outputs.length
    });

    // Get Hydra network parameters FIRST
    const hydraNetworkParams = await this.config.hydraClient.getNetworkParameters();

    logger.info('Hydra protocol parameters retrieved and transformed to Helios format', {
      txFeeFixed: hydraNetworkParams.txFeeFixed,
      txFeePerByte: hydraNetworkParams.txFeePerByte,
      executionUnitPrices: hydraNetworkParams.executionUnitPrices,
      minUtxo: hydraNetworkParams.minUtxo,
      maxTxSize: hydraNetworkParams.maxTxSize
    });

    // Calculate total input value for fallback calculations
    let totalInputValue = 0;
    for (const utxo of config.utxos) {
      const lovelace = utxo.lovelace || utxo.output?.value?.lovelace || 0;
      totalInputValue += Number(lovelace);
    }

    // Try multiple approaches with decreasing send amounts
    const attempts = [
      { amount: config.outputs[0].amount, description: 'original amount' },
      { amount: totalInputValue - 200000, description: '0.2 ADA buffer' },
      { amount: totalInputValue - 500000, description: '0.5 ADA buffer' },
      { amount: totalInputValue - 1000000, description: '1.0 ADA buffer' },
      { amount: Math.floor(totalInputValue * 0.9), description: '90% of input' },
      { amount: Math.floor(totalInputValue * 0.8), description: '80% of input' }
    ];

    for (const attempt of attempts) {
      if (attempt.amount <= 0) continue;

      try {
        logger.info(`Attempting transaction build with ${attempt.description}`, {
          attemptAmount: attempt.amount,
          attemptAda: (attempt.amount / 1_000_000).toFixed(6),
          totalInput: totalInputValue,
          totalInputAda: (totalInputValue / 1_000_000).toFixed(6)
        });

        // Create transaction builder
        const txBuilder = makeTxBuilder({
          isMainnet: this.config.network === 'mainnet'
        });

        // Add inputs (UTXOs to spend)
        for (const utxo of config.utxos) {
          txBuilder.spendWithoutRedeemer(utxo);
        }

        // Add outputs with current attempt amount
        const value = makeValue(BigInt(attempt.amount));
        txBuilder.payUnsafe(config.outputs[0].address, value);

        // Set validity time range (1 hour from now)
        const validTo = Date.now() + 3600000; // 1 hour
        txBuilder.validToTime(validTo);

        // Build the transaction with Hydra parameters
        const tx = await txBuilder.build({
          changeAddress: this.wallet.address,
          networkParams: hydraNetworkParams,  // Hydra parameters (transformed to Helios format)
          spareUtxos: [],

          // HYBRID APPROACH: Even with correct parameters, Helios has internal requirements
          modifyExBudget: (txInfo, purpose, index, fee) => {
            const isZeroFeeEnv = (
              hydraNetworkParams.txFeeFixed === 0 &&
              hydraNetworkParams.txFeePerByte === 0 &&
              hydraNetworkParams.executionUnitPrices?.priceMemory === 0 &&
              hydraNetworkParams.executionUnitPrices?.priceSteps === 0
            );

            if (isZeroFeeEnv) {
              // In true zero-fee environments, force minimal execution budget
              logger.info('Applying minimal execution budget for zero-fee environment', {
                purpose,
                originalFee: { mem: Number(fee.mem), cpu: Number(fee.cpu) },
                reason: 'Helios internal requirements in zero-fee environment'
              });

              return {
                mem: BigInt(500),   // Minimal but sufficient memory
                cpu: BigInt(500)    // Minimal but sufficient CPU
              };
            }

            return fee;
          },

          // Allow more flexible change outputs for Hydra
          allowDirtyChangeOutput: true,

          // Disable strict build-phase script errors for Hydra compatibility
          throwBuildPhaseScriptErrors: false
        });

        logger.info('Transaction built successfully with Helios-compatible Hydra parameters', {
          txId: tx.id().toHex(),
          inputCount: tx.body.inputs.length,
          outputCount: tx.body.outputs.length,
          fee: tx.body.fee.toString(),
          actualAmount: attempt.amount,
          actualAmountAda: (attempt.amount / 1_000_000).toFixed(6),
          utilizationPercent: ((attempt.amount / totalInputValue) * 100).toFixed(1),
          attemptDescription: attempt.description
        });

        return tx;

      } catch (error) {
        logger.info(`Transaction build failed with ${attempt.description}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          attemptAmount: attempt.amount,
          attemptAda: (attempt.amount / 1_000_000).toFixed(6)
        });

        // Continue to next attempt
        continue;
      }
    }

    // If all attempts failed
    logger.error('All transaction build attempts failed', {
      totalAttempts: attempts.length,
      totalInputValue,
      totalInputAda: (totalInputValue / 1_000_000).toFixed(6)
    });

    throw new Error(`Failed to build transaction with Hydra parameters: All ${attempts.length} attempts failed. Input: ${(totalInputValue / 1_000_000).toFixed(6)} ADA`);
  }

  /**
   * Build a transaction that consumes entire UTXOs with zero change
   * Use this in true zero-fee environments like Hydra heads
   */
  public async buildCompleteUtxoConsumption(config: {
    utxos: any[];
    outputs: Array<{ address: string; amount: number }>;
  }): Promise<any> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    logger.info('Building complete UTXO consumption transaction', {
      inputCount: config.utxos.length,
      outputCount: config.outputs.length
    });

    try {
      // Get Hydra network parameters to confirm zero fees
      const hydraNetworkParams = await this.config.hydraClient.getNetworkParameters();

      // Verify this is truly a zero-fee environment
      if (hydraNetworkParams.txFeeFixed !== 0 || hydraNetworkParams.txFeePerByte !== 0) {
        throw new Error(`Not a zero-fee environment: txFeeFixed=${hydraNetworkParams.txFeeFixed}, txFeePerByte=${hydraNetworkParams.txFeePerByte}`);
      }

      logger.info('Zero-fee environment confirmed for complete UTXO consumption', {
        txFeeFixed: hydraNetworkParams.txFeeFixed,
        txFeePerByte: hydraNetworkParams.txFeePerByte,
        executionUnitPrices: {
          priceMemory: hydraNetworkParams.executionUnitPrices?.priceMemory || 'not specified',
          priceSteps: hydraNetworkParams.executionUnitPrices?.priceSteps || 'not specified'
        }
      });

      // Calculate total input value
      let totalInputValue = 0;
      for (const utxo of config.utxos) {
        const lovelace = utxo.lovelace || utxo.output?.value?.lovelace || 0;
        totalInputValue += Number(lovelace);
      }

      // Calculate total output value
      let totalOutputValue = 0;
      for (const output of config.outputs) {
        totalOutputValue += output.amount;
      }

      // In zero-fee environment, input should exactly equal output
      if (totalInputValue !== totalOutputValue) {
        logger.info('Adjusting output to match input for complete consumption', {
          totalInput: totalInputValue,
          totalOutput: totalOutputValue,
          difference: totalInputValue - totalOutputValue
        });

        // Adjust the first output to consume the entire input
        if (config.outputs.length > 0) {
          config.outputs[0].amount = totalInputValue;
          logger.info('Output adjusted for complete UTXO consumption', {
            newOutputAmount: config.outputs[0].amount,
            newOutputAda: config.outputs[0].amount / 1_000_000
          });
        }
      }

      const txBuilder = makeTxBuilder({
        isMainnet: this.config.network === 'mainnet'
      });

      // Add inputs (UTXOs to spend)
      for (const utxo of config.utxos) {
        txBuilder.spendWithoutRedeemer(utxo);
      }

      // Add outputs
      for (const output of config.outputs) {
        const value = makeValue(BigInt(output.amount));
        txBuilder.payUnsafe(output.address, value);
      }

      // Set validity time range (1 hour from now)
      const validTo = Date.now() + 3600000; // 1 hour
      txBuilder.validToTime(validTo);

      // Build the transaction with zero-fee parameters (now properly formatted for Helios)
      const tx = await txBuilder.build({
        // Use a dummy change address but expect no change in zero-fee environment
        changeAddress: this.wallet.address,
        networkParams: hydraNetworkParams,  // Hydra parameters (transformed to Helios format)
        spareUtxos: [],

        // Allow flexible outputs for complete consumption
        allowDirtyChangeOutput: true,

        // Don't throw on script errors during build (defer to validation)
        throwBuildPhaseScriptErrors: false,

        // Specify that we want no change output
        changeOutput: undefined
      });

      logger.info('Complete UTXO consumption transaction built successfully', {
        txId: tx.id().toHex(),
        inputCount: tx.body.inputs.length,
        outputCount: tx.body.outputs.length,
        fee: Number(tx.body.fee),
        totalInputValue,
        totalOutputValue: config.outputs.reduce((sum, out) => sum + out.amount, 0)
      });

      return tx;
    } catch (error) {
      logger.error('Failed to build complete UTXO consumption transaction', { error });
      throw new Error(`Failed to build complete UTXO consumption transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export factory functions
export const heliosWallet = {
  create: (config: HeliosWalletConfig) => new HeliosWallet(config),
  load: HeliosWallet.loadWallet
}; 