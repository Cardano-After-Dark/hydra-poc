import { config } from 'dotenv';
import * as readline from 'readline';
import { HydraClientWrapper } from './hydra/hydra-client.js';
import { heliosWallet, HeliosWallet } from './wallets/helios-wallet.js';
import { logger, LogLevel } from '../tools/debug/logger.js';
import { makeTxBuilder } from '@helios-lang/tx-utils';

config();
logger.setLevel(LogLevel.INFO);

class UtxoConsolidator {
  private hydraClient: HydraClientWrapper;
  private rl: readline.Interface;
  private wallet?: HeliosWallet;

  constructor() {
    this.hydraClient = new HydraClientWrapper({
      hostname: process.env.HYDRA_HOSTNAME || '127.0.0.1',
      httpPort: parseInt(process.env.HYDRA_HTTP_PORT || '4001', 10),
      wsPort: parseInt(process.env.HYDRA_WS_PORT || '4001', 10),
      secure: process.env.HYDRA_SECURE === 'true',
      isForMainnet: process.env.HYDRA_IS_MAINNET === 'true'
    });
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }

  async run(): Promise<void> {
    console.log('🔄 Connecting to Hydra head...');
    const connectivity = await this.hydraClient.testConnectivity();
    if (!connectivity.success) {
      console.error('❌ Failed to connect to Hydra. Check HYDRA_* env vars.');
      process.exit(1);
    }
    console.log('✅ Connected to Hydra');

    await this.selectWallet();

    const walletInfo = this.wallet!.getWalletInfo();
    console.log(`\n👛 Selected wallet: ${walletInfo.name}`);
    console.log(`   🆔 ${walletInfo.id}`);
    console.log(`   📍 ${walletInfo.address}`);

    console.log('\n🔍 Fetching UTXOs from Hydra snapshot...');
    const allUtxos = await this.hydraClient.fetchUTXOs();
    const address = walletInfo.address.trim();
    const utxos = allUtxos.filter(utxo => {
      const utxoAddress = utxo.address || utxo.output?.address;
      const addressStr = typeof utxoAddress === 'string' ? utxoAddress :
        (utxoAddress?.toString ? utxoAddress.toString() :
          utxoAddress?.toBech32 ? utxoAddress.toBech32() : String(utxoAddress));
      return addressStr.trim() === address;
    });

    if (utxos.length === 0) {
      console.log('ℹ️ No UTXOs found for this wallet on the Hydra head.');
      this.shutdown(0);
      return;
    }

    const totalInput = utxos.reduce((sum: number, u: any) => sum + Number(u.output?.value?.lovelace || u.lovelace || 0), 0);
    console.log(`📦 UTXO count: ${utxos.length}`);
    console.log(`💰 Total lovelace: ${totalInput} (${(totalInput / 1_000_000).toFixed(6)} ADA)`);

    if (utxos.length === 1) {
      console.log('✅ Already consolidated (only one UTXO). Submitting a self-send is unnecessary.');
      this.shutdown(0);
      return;
    }

    console.log('\n🧮 Building consolidation transaction (prefer change-only -> 1 output)...');

    let tx: any | undefined;
    try {
      // Attempt 1: Change-only consolidation (spend all, no explicit outputs)
      const hydraParams = await this.hydraClient.getNetworkParameters();
      const txBuilder = makeTxBuilder({ isMainnet: false });
      for (const utxo of utxos) {
        txBuilder.spendWithoutRedeemer(utxo);
      }
      txBuilder.validToTime(Date.now() + 3600000);
      tx = await txBuilder.build({
        changeAddress: walletInfo.address,
        networkParams: hydraParams,
        spareUtxos: [],
        allowDirtyChangeOutput: true,
        throwBuildPhaseScriptErrors: false
      });
      console.log('🔁 Change-only build succeeded');
    } catch (changeOnlyErr) {
      console.log('⚠️ Change-only build failed, attempting complete consumption...');
      try {
        // Attempt 2: Exact consumption (one explicit output equal total input)
        tx = await this.wallet!.buildCompleteUtxoConsumption({
          utxos,
          outputs: [
            { address, amount: totalInput }
          ]
        });
      } catch (err) {
        console.log('⚠️ Complete consumption build failed, retrying with Hydra params and safe amount...');
        // Attempt 3: Hydra params with buffer (may yield 2 outputs)
        const safeAmount = Math.max(0, totalInput - 1_000_000); // 1 ADA buffer tends to succeed
        tx = await this.wallet!.buildTransactionWithHydraParams({
          utxos,
          outputs: [
            { address, amount: safeAmount }
          ]
        });
      }
    }

    // Log output count pre-sign to verify consolidation intent
    try {
      const outCount = tx?.body?.outputs?.length ?? 'unknown';
      console.log(`🧾 Consolidation tx outputs: ${outCount} (aiming for 1)`);
    } catch {}

    console.log('✍️  Signing transaction...');
    const signed = await this.wallet!.signTransaction(tx);

    console.log('📤 Submitting to Hydra...');
    const txId = await this.wallet!.submitTransaction(signed);
    console.log(`✅ Consolidation submitted. TxId: ${txId}`);
    console.log('⏱️ It may take a moment for the consolidated UTXO to appear in the snapshot.');

    this.shutdown(0);
  }

  private async selectWallet(): Promise<void> {
    const wallets = await this.getAvailableWallets();
    if (wallets.length === 0) {
      throw new Error('No wallets found in ./helios-wallets');
    }
    console.log('\n👤 Available Wallets:');
    wallets.forEach((w, i) => console.log(`   ${i + 1}. ${w}`));
    const choice = await this.ask('\n🔹 Select wallet: ');
    const idx = parseInt(choice) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= wallets.length) {
      throw new Error('Invalid selection');
    }
    const selectedWalletId = wallets[idx];

    // Suppress wallet internals during load
    const originalConsoleLog = console.log;
    const originalConsoleInfo = console.info;
    console.log = () => { };
    console.info = () => { };
    try {
      this.wallet = await heliosWallet.load(selectedWalletId, {
        name: 'UTXOManager',
        network: 'testnet',
        storageDir: './helios-wallets',
        hydraClient: this.hydraClient
      });
    } finally {
      console.log = originalConsoleLog;
      console.info = originalConsoleInfo;
    }
  }

  private async getAvailableWallets(): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    try {
      const files = await fs.readdir('./helios-wallets');
      return files.filter(f => f.endsWith('.json')).map(f => path.basename(f, '.json'));
    } catch (e) {
      return [];
    }
  }

  private ask(question: string): Promise<string> {
    return new Promise(resolve => this.rl.question(question, resolve));
  }

  private shutdown(code: number): void {
    this.rl.close();
    process.exit(code);
  }
}

async function main(): Promise<void> {
  const consolidator = new UtxoConsolidator();
  await consolidator.run();
}

main().catch(err => {
  console.error('❌ Consolidation failed:', err);
  process.exit(1);
});


