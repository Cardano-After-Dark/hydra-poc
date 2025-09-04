/**
 * Helios Wallet Creator and Backup Utility
 * 
 * This script provides comprehensive wallet creation, backup, and management:
 * 1. Creating new Helios wallets with secure key generation
 * 2. Generating comprehensive backup files (encrypted and plain text)
 * 3. Wallet recovery and restoration capabilities
 * 4. Interactive wallet management interface
 * 5. Secure backup verification and validation
 */

import crypto from 'crypto';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { logger } from '../tools/debug/logger';
import { HydraClientWrapper } from './hydra/hydra-client';
import { HeliosWallet, heliosWallet, HeliosWalletInfo } from './wallets/helios-wallet';

// Load environment variables
config();

interface WalletCreatorConfig {
  network: 'mainnet' | 'testnet';
  hydraNode: {
    hostname: string;
    httpPort: number;
    wsPort: number;
    secure: boolean;
  };
  walletStorage: string;
  backupStorage: string;
  encryptionKey?: string; // Optional encryption key for backups
}

interface WalletBackup {
  version: string;
  createdAt: string;
  walletInfo: HeliosWalletInfo;
  backupMetadata: {
    backupId: string;
    checksum: string;
    encrypted: boolean;
    encryptionMethod?: string;
  };
  recoveryInstructions: string[];
  securityNotes: string[];
}

interface LoadedWallet extends HeliosWalletInfo {
  wallet: HeliosWallet;
  balance: number;
  utxoCount: number;
  lastBackup?: string;
}

class HeliosWalletCreator {
  private config: WalletCreatorConfig;
  private hydraClient: HydraClientWrapper;
  private loadedWallets: LoadedWallet[] = [];
  private rl: readline.Interface;

  constructor(config: WalletCreatorConfig) {
    this.config = config;
    this.hydraClient = new HydraClientWrapper({
      hostname: config.hydraNode.hostname,
      httpPort: config.hydraNode.httpPort,
      wsPort: config.hydraNode.wsPort,
      secure: config.hydraNode.secure,
      isForMainnet: config.network === 'mainnet'
    });

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Ensure backup directory exists
    if (!fs.existsSync(this.config.backupStorage)) {
      fs.mkdirSync(this.config.backupStorage, { recursive: true });
    }

    logger.info('Helios Wallet Creator initialized', {
      network: config.network,
      hydraNode: `${config.hydraNode.hostname}:${config.hydraNode.httpPort}`,
      walletStorage: config.walletStorage,
      backupStorage: config.backupStorage
    });
  }

  /**
   * Create a new wallet with comprehensive backup generation
   */
  async createWalletWithBackup(): Promise<LoadedWallet> {
    console.log('\n🏦 Creating New Helios Wallet with Backup');
    console.log('═══════════════════════════════════════════');

    // Get wallet name from user
    const walletName = await new Promise<string>((resolve) => {
      this.rl.question('Enter name for new wallet: ', (name) => {
        resolve(name.trim() || `Wallet_${Date.now()}`);
      });
    });

    console.log(`\n🔄 Creating wallet: ${walletName}`);

    try {
      // Create wallet using Helios
      const wallet = heliosWallet.create({
        name: walletName,
        network: this.config.network,
        storageDir: this.config.walletStorage,
        hydraClient: this.hydraClient
      });

      const walletInfo = await wallet.createWallet();

      console.log('✅ Wallet created successfully!');
      console.log(`   Name: ${walletInfo.name}`);
      console.log(`   ID: ${walletInfo.id}`);
      console.log(`   Address: ${walletInfo.address}`);
      console.log(`   Network: ${walletInfo.network}`);

      // Create comprehensive backup
      const backup = await this.createComprehensiveBackup(walletInfo, wallet);

      // Add to loaded wallets
      const loadedWallet: LoadedWallet = {
        ...walletInfo,
        wallet,
        balance: 0,
        utxoCount: 0,
        lastBackup: backup.backupMetadata.backupId
      };

      this.loadedWallets.push(loadedWallet);

      // Display backup information
      await this.displayBackupInformation(backup);

      logger.info('Wallet created with backup', {
        name: walletInfo.name,
        address: walletInfo.address,
        backupId: backup.backupMetadata.backupId
      });

      return loadedWallet;

    } catch (error) {
      console.error('❌ Failed to create wallet:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Create comprehensive backup with multiple formats
   */
  async createComprehensiveBackup(walletInfo: HeliosWalletInfo, wallet: HeliosWallet): Promise<WalletBackup> {
    console.log('\n💾 Creating Comprehensive Backup');
    console.log('═══════════════════════════════');

    const backupId = `backup_${walletInfo.id}_${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Create backup object
    const backup: WalletBackup = {
      version: '1.0.0',
      createdAt: timestamp,
      walletInfo,
      backupMetadata: {
        backupId,
        checksum: '',
        encrypted: false,
        encryptionMethod: undefined
      },
      recoveryInstructions: [
        '1. Import this backup file into your wallet recovery tool',
        '2. Enter your mnemonic phrase when prompted',
        '3. Verify the wallet address matches the original',
        '4. Test with a small transaction before using large amounts',
        '5. Store this backup in multiple secure locations'
      ],
      securityNotes: [
        '⚠️  Keep your mnemonic phrase secure and never share it',
        '⚠️  Store backups in multiple secure locations',
        '⚠️  Consider using a hardware wallet for large amounts',
        '⚠️  Regularly verify your backup is accessible',
        '⚠️  Test recovery process periodically'
      ]
    };

    // Generate checksum
    const backupString = JSON.stringify(backup, null, 2);
    backup.backupMetadata.checksum = crypto.createHash('sha256').update(backupString).digest('hex');

    // Create multiple backup formats
    await this.createBackupFiles(backup, backupString);

    console.log('✅ Comprehensive backup created successfully!');
    console.log(`   Backup ID: ${backup.backupMetadata.backupId}`);
    console.log(`   Checksum: ${backup.backupMetadata.checksum.substring(0, 16)}...`);
    console.log(`   Files created: 3 backup formats`);

    return backup;
  }

  /**
   * Create multiple backup file formats
   */
  private async createBackupFiles(backup: WalletBackup, backupString: string): Promise<void> {
    const backupId = backup.backupMetadata.backupId;

    // 1. JSON backup (complete)
    const jsonBackupPath = path.join(this.config.backupStorage, `${backupId}.json`);
    fs.writeFileSync(jsonBackupPath, backupString);
    console.log(`   📄 JSON backup: ${jsonBackupPath}`);

    // 2. Plain text backup (mnemonic only - for emergency recovery)
    const plainTextBackup = this.createPlainTextBackup(backup);
    const plainTextPath = path.join(this.config.backupStorage, `${backupId}_mnemonic.txt`);
    fs.writeFileSync(plainTextPath, plainTextBackup);
    console.log(`   📝 Plain text backup: ${plainTextPath}`);

    // 3. Encrypted backup (if encryption key provided)
    if (this.config.encryptionKey) {
      const encryptedBackup = this.encryptBackup(backupString, this.config.encryptionKey);
      const encryptedPath = path.join(this.config.backupStorage, `${backupId}_encrypted.bak`);
      fs.writeFileSync(encryptedPath, encryptedBackup);
      backup.backupMetadata.encrypted = true;
      backup.backupMetadata.encryptionMethod = 'AES-256-GCM';
      console.log(`   🔐 Encrypted backup: ${encryptedPath}`);
    }

    // 4. QR code backup (for mobile wallets)
    await this.createQRCodeBackup(backup, backupId);
  }

  /**
   * Create plain text backup for emergency recovery
   */
  private createPlainTextBackup(backup: WalletBackup): string {
    const wallet = backup.walletInfo;

    return `HELIOS WALLET BACKUP - EMERGENCY RECOVERY
═══════════════════════════════════════════════════════════════

WALLET INFORMATION:
Name: ${wallet.name}
Network: ${wallet.network}
Address: ${wallet.address}
Created: ${wallet.createdAt.toLocaleString()}

MNEMONIC PHRASE (24 WORDS):
${wallet.mnemonic.join(' ')}

RECOVERY INSTRUCTIONS:
1. Use a Helios-compatible wallet recovery tool
2. Enter the 24-word mnemonic phrase above
3. Select network: ${wallet.network}
4. Verify the generated address matches: ${wallet.address}

SECURITY WARNINGS:
⚠️  Keep this file secure and private
⚠️  Never share your mnemonic phrase
⚠️  Store in multiple secure locations
⚠️  Consider using a hardware wallet for large amounts

Backup created: ${backup.createdAt}
Backup ID: ${backup.backupMetadata.backupId}
Checksum: ${backup.backupMetadata.checksum}

═══════════════════════════════════════════════════════════════
END OF BACKUP
`;
  }

  /**
   * Encrypt backup data
   */
  private encryptBackup(data: string, key: string): string {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(12); // recommended IV size for GCM
    const keyBuf = crypto.createHash('sha256').update(key, 'utf8').digest(); // 32 bytes

    const cipher = crypto.createCipheriv(algorithm, keyBuf, iv);
    const encryptedBuf = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Return IV + AuthTag + EncryptedData (hex encoded)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedBuf.toString('hex')}`;
  }

  /**
   * Create QR code backup for mobile wallets
   */
  private async createQRCodeBackup(backup: WalletBackup, backupId: string): Promise<void> {
    try {
      // Create a simplified backup for QR codes
      const qrData = {
        type: 'helios-wallet-backup',
        version: backup.version,
        wallet: {
          name: backup.walletInfo.name,
          network: backup.walletInfo.network,
          address: backup.walletInfo.address
        },
        mnemonic: backup.walletInfo.mnemonic,
        backupId: backup.backupMetadata.backupId,
        checksum: backup.backupMetadata.checksum
      };

      const qrBackupPath = path.join(this.config.backupStorage, `${backupId}_qr.json`);
      fs.writeFileSync(qrBackupPath, JSON.stringify(qrData, null, 2));
      console.log(`   📱 QR backup data: ${qrBackupPath}`);

      // Note: Actual QR code generation would require additional libraries
      console.log(`   💡 To generate QR codes, use: npm install qrcode`);
      console.log(`   💡 Then import and use: QRCode.toFile('${backupId}_qr.png', JSON.stringify(qrData))`);

    } catch (error) {
      console.log(`   ⚠️  QR backup creation skipped: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Display comprehensive backup information
   */
  private async displayBackupInformation(backup: WalletBackup): Promise<void> {
    console.log('\n📋 Backup Information');
    console.log('═══════════════════');
    console.log(`Backup ID: ${backup.backupMetadata.backupId}`);
    console.log(`Created: ${backup.createdAt}`);
    console.log(`Checksum: ${backup.backupMetadata.checksum}`);
    console.log(`Encrypted: ${backup.backupMetadata.encrypted ? 'Yes' : 'No'}`);

    console.log('\n🔑 Wallet Details:');
    console.log(`   Name: ${backup.walletInfo.name}`);
    console.log(`   Network: ${backup.walletInfo.network}`);
    console.log(`   Address: ${backup.walletInfo.address}`);
    console.log(`   Mnemonic: ${backup.walletInfo.mnemonic.length} words`);

    console.log('\n📁 Backup Files Created:');
    const backupFiles = fs.readdirSync(this.config.backupStorage)
      .filter(file => file.includes(backup.backupMetadata.backupId));

    backupFiles.forEach(file => {
      const filePath = path.join(this.config.backupStorage, file);
      const stats = fs.statSync(filePath);
      console.log(`   📄 ${file} (${stats.size} bytes)`);
    });

    console.log('\n⚠️  Security Reminders:');
    backup.securityNotes.forEach(note => {
      console.log(`   ${note}`);
    });

    // Ask user to confirm backup storage
    const confirmBackup = await new Promise<boolean>((resolve) => {
      this.rl.question('\n✅ Have you securely stored your backup files? (y/N): ', (answer) => {
        resolve(answer.trim().toLowerCase() === 'y');
      });
    });

    if (!confirmBackup) {
      console.log('\n⚠️  Please ensure you have securely stored your backup files before proceeding!');
      console.log('   Backup location:', this.config.backupStorage);
    } else {
      console.log('\n✅ Backup confirmation received. Your wallet is ready for use!');
    }
  }

  /**
   * Restore wallet from backup
   */
  async restoreWalletFromBackup(): Promise<LoadedWallet | null> {
    console.log('\n🔄 Restoring Wallet from Backup');
    console.log('═══════════════════════════════');

    // List available backup files
    const backupFiles = fs.readdirSync(this.config.backupStorage)
      .filter(file => file.endsWith('.json') && !file.includes('_qr.json'));

    if (backupFiles.length === 0) {
      console.log('❌ No backup files found');
      return null;
    }

    console.log('\n📁 Available Backup Files:');
    backupFiles.forEach((file, index) => {
      const filePath = path.join(this.config.backupStorage, file);
      const stats = fs.statSync(filePath);
      console.log(`   ${index + 1}. ${file} (${stats.size} bytes)`);
    });

    // Let user select backup file
    const selection = await new Promise<number>((resolve) => {
      this.rl.question('\nSelect backup file number (or 0 to cancel): ', (answer) => {
        const num = parseInt(answer.trim(), 10);
        resolve(isNaN(num) ? 0 : num);
      });
    });

    if (selection === 0 || selection > backupFiles.length) {
      console.log('❌ Invalid selection');
      return null;
    }

    const selectedFile = backupFiles[selection - 1];
    const backupPath = path.join(this.config.backupStorage, selectedFile);

    try {
      console.log(`\n🔄 Loading backup: ${selectedFile}`);

      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as WalletBackup;

      // Verify backup integrity
      const backupString = JSON.stringify(backupData, null, 2);
      const calculatedChecksum = crypto.createHash('sha256').update(backupString).digest('hex');

      if (calculatedChecksum !== backupData.backupMetadata.checksum) {
        throw new Error('Backup checksum verification failed');
      }

      console.log('✅ Backup integrity verified');

      // Restore wallet from mnemonic
      const wallet = heliosWallet.create({
        name: backupData.walletInfo.name,
        network: backupData.walletInfo.network,
        storageDir: this.config.walletStorage,
        hydraClient: this.hydraClient
      });

      const restoredWalletInfo = await wallet.restoreFromMnemonic(backupData.walletInfo.mnemonic);

      // Verify address matches
      if (restoredWalletInfo.address !== backupData.walletInfo.address) {
        throw new Error('Restored wallet address does not match backup');
      }

      console.log('✅ Wallet restored successfully!');
      console.log(`   Name: ${restoredWalletInfo.name}`);
      console.log(`   Address: ${restoredWalletInfo.address}`);
      console.log(`   Network: ${restoredWalletInfo.network}`);

      // Add to loaded wallets
      const loadedWallet: LoadedWallet = {
        ...restoredWalletInfo,
        wallet,
        balance: 0,
        utxoCount: 0,
        lastBackup: backupData.backupMetadata.backupId
      };

      this.loadedWallets.push(loadedWallet);

      logger.info('Wallet restored from backup', {
        name: restoredWalletInfo.name,
        address: restoredWalletInfo.address,
        backupId: backupData.backupMetadata.backupId
      });

      return loadedWallet;

    } catch (error) {
      console.error('❌ Failed to restore wallet:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * List all available backups
   */
  listBackups(): void {
    console.log('\n📁 Available Backups');
    console.log('═══════════════════');

    if (!fs.existsSync(this.config.backupStorage)) {
      console.log('❌ Backup directory does not exist');
      return;
    }

    const backupFiles = fs.readdirSync(this.config.backupStorage)
      .filter(file => file.endsWith('.json') && !file.includes('_qr.json'));

    if (backupFiles.length === 0) {
      console.log('⭕ No backup files found');
      return;
    }

    backupFiles.forEach((file, index) => {
      const filePath = path.join(this.config.backupStorage, file);
      const stats = fs.statSync(filePath);

      try {
        const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8')) as WalletBackup;
        console.log(`\n${index + 1}. 📄 ${file}`);
        console.log(`   Wallet: ${backupData.walletInfo.name}`);
        console.log(`   Network: ${backupData.walletInfo.network}`);
        console.log(`   Address: ${backupData.walletInfo.address}`);
        console.log(`   Created: ${backupData.createdAt}`);
        console.log(`   Size: ${stats.size} bytes`);
        console.log(`   Checksum: ${backupData.backupMetadata.checksum.substring(0, 16)}...`);
      } catch (error) {
        console.log(`\n${index + 1}. 📄 ${file} (corrupted)`);
        console.log(`   Size: ${stats.size} bytes`);
      }
    });
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId?: string): Promise<void> {
    console.log('\n🔍 Verifying Backup Integrity');
    console.log('═════════════════════════════');

    const backupFiles = fs.readdirSync(this.config.backupStorage)
      .filter(file => file.endsWith('.json') && !file.includes('_qr.json'));

    if (backupFiles.length === 0) {
      console.log('❌ No backup files found');
      return;
    }

    let verifiedCount = 0;
    let totalCount = 0;

    for (const file of backupFiles) {
      if (backupId && !file.includes(backupId)) {
        continue;
      }

      totalCount++;
      const filePath = path.join(this.config.backupStorage, file);

      try {
        const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8')) as WalletBackup;
        const backupString = JSON.stringify(backupData, null, 2);
        const calculatedChecksum = crypto.createHash('sha256').update(backupString).digest('hex');

        if (calculatedChecksum === backupData.backupMetadata.checksum) {
          console.log(`✅ ${file} - Integrity verified`);
          verifiedCount++;
        } else {
          console.log(`❌ ${file} - Checksum mismatch`);
        }
      } catch (error) {
        console.log(`❌ ${file} - Corrupted or invalid format`);
      }
    }

    console.log(`\n📊 Verification Results:`);
    console.log(`   Verified: ${verifiedCount}/${totalCount} backups`);
    console.log(`   Success Rate: ${((verifiedCount / totalCount) * 100).toFixed(1)}%`);
  }

  /**
   * Main interactive menu
   */
  async showMainMenu(): Promise<void> {
    console.log('\n🎛️  Helios Wallet Creator & Backup Manager');
    console.log('═══════════════════════════════════════════');
    console.log('1. 🏦 Create new wallet with backup');
    console.log('2. 🔄 Restore wallet from backup');
    console.log('3. 📁 List available backups');
    console.log('4. 🔍 Verify backup integrity');
    console.log('5. 📊 Show loaded wallets');
    console.log('6. 💰 Check wallet balances');
    console.log('0. 🚪 Exit');

    const choice = await new Promise<string>((resolve) => {
      this.rl.question('\nSelect option: ', (answer) => {
        resolve(answer.trim());
      });
    });

    switch (choice) {
      case '1':
        await this.createWalletWithBackup();
        break;
      case '2':
        await this.restoreWalletFromBackup();
        break;
      case '3':
        this.listBackups();
        break;
      case '4':
        await this.verifyBackup();
        break;
      case '5':
        this.displayLoadedWallets();
        break;
      case '6':
        await this.checkWalletBalances();
        break;
      case '0':
        console.log('👋 Goodbye!');
        return;
      default:
        console.log('❌ Invalid option');
    }

    // Show menu again
    await this.showMainMenu();
  }

  /**
   * Display loaded wallets
   */
  displayLoadedWallets(): void {
    console.log('\n📊 Loaded Wallets');
    console.log('═══════════════════');

    if (this.loadedWallets.length === 0) {
      console.log('⭕ No wallets are currently loaded');
      return;
    }

    this.loadedWallets.forEach((wallet, index) => {
      console.log(`\n${index + 1}. 📛 ${wallet.name}`);
      console.log(`   🏠 Address: ${wallet.address}`);
      console.log(`   💰 Balance: ${wallet.balance.toFixed(6)} ADA`);
      console.log(`   📦 UTXOs: ${wallet.utxoCount}`);
      console.log(`   📅 Created: ${wallet.createdAt.toLocaleString()}`);
      if (wallet.lastBackup) {
        console.log(`   💾 Last Backup: ${wallet.lastBackup}`);
      }
    });

    const totalBalance = this.loadedWallets.reduce((sum, w) => sum + w.balance, 0);
    console.log(`\n📈 Total Balance: ${totalBalance.toFixed(6)} ADA`);
  }

  /**
   * Check wallet balances from Hydra
   */
  async checkWalletBalances(): Promise<void> {
    console.log('\n💰 Checking Wallet Balances');
    console.log('═══════════════════════════');

    if (this.loadedWallets.length === 0) {
      console.log('⭕ No wallets loaded');
      return;
    }

    try {
      const connectivity = await this.hydraClient.testConnectivity();
      if (!connectivity.success) {
        console.log('⚠️  Cannot connect to Hydra node - balances may be outdated');
      }

      const allUtxos = await this.hydraClient.fetchUTXOs();

      for (const wallet of this.loadedWallets) {
        const walletUtxos = allUtxos.filter(utxo => {
          const utxoAddress = utxo.address || utxo.output?.address;
          const addressStr = typeof utxoAddress === 'string' ? utxoAddress :
            (utxoAddress && utxoAddress.toString ? utxoAddress.toString() : '');
          return addressStr === wallet.address;
        });

        let balance = 0;
        walletUtxos.forEach(utxo => {
          const lovelace = utxo.lovelace || utxo.output?.value?.lovelace || 0;
          balance += Number(lovelace);
        });

        wallet.balance = balance / 1_000_000;
        wallet.utxoCount = walletUtxos.length;

        console.log(`   💰 ${wallet.name}: ${wallet.balance.toFixed(6)} ADA (${wallet.utxoCount} UTXOs)`);
      }

      console.log('✅ All wallet balances updated');
    } catch (error) {
      console.error('❌ Failed to check balances:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Run the complete wallet creator demo
   */
  async runDemo(): Promise<void> {
    console.log('\n🔧 Helios Wallet Creator & Backup Manager');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Network: ${this.config.network}`);
    console.log(`Hydra Node: ${this.config.hydraNode.hostname}:${this.config.hydraNode.httpPort}`);
    console.log(`Wallet Storage: ${this.config.walletStorage}`);
    console.log(`Backup Storage: ${this.config.backupStorage}`);
    console.log('═══════════════════════════════════════════════════════════════');

    try {
      await this.showMainMenu();
    } catch (error) {
      console.error('\n💥 Demo failed:', error);
      logger.error('Wallet creator demo execution failed', { error });
    } finally {
      this.rl.close();
    }
  }
}

/**
 * Demo configuration
 */
const walletCreatorConfig: WalletCreatorConfig = {
  network: 'testnet',
  hydraNode: {
    hostname: process.env.HYDRA_HOSTNAME || '192.168.1.11',
    httpPort: parseInt(process.env.HYDRA_HTTP_PORT || '4001', 10),
    wsPort: parseInt(process.env.HYDRA_WS_PORT || '4001', 10),
    secure: process.env.HYDRA_SECURE === 'true'
  },
  walletStorage: './helios-wallets',
  backupStorage: './wallet-backups',
  encryptionKey: process.env.BACKUP_ENCRYPTION_KEY // Optional encryption key
};

/**
 * Run the wallet creator demo
 */
async function runWalletCreatorDemo(): Promise<void> {
  const demo = new HeliosWalletCreator(walletCreatorConfig);
  await demo.runDemo();
}

// Export for use in other files
export { HeliosWalletCreator, WalletBackup, WalletCreatorConfig };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runWalletCreatorDemo().catch(console.error);
} 