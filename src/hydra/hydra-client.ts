/**
 * Hydra Client Wrapper
 * Reusable Hydra client functionality extracted from hydra-utxo-test.ts
 */

import { makeHydraClient } from '@helios-lang/tx-utils';
import { config } from 'dotenv';
import WebSocket from 'ws';

// Load environment variables
config();

export interface HydraClientConfig {
  hostname: string;
  httpPort: number;
  wsPort: number;
  secure: boolean;
  isForMainnet: boolean;
}

export interface UtxoSummary {
  id: string;
  address: string;
  lovelace: bigint;
  assets: Record<string, any>;
  hasDatum: boolean;
  hasRefScript: boolean;
}

export class HydraClientWrapper {
  private config: HydraClientConfig;
  private client: any;

  constructor(config?: Partial<HydraClientConfig>) {
    this.config = {
      hostname: process.env.HYDRA_HOSTNAME || '127.0.0.1',
      httpPort: parseInt(process.env.HYDRA_HTTP_PORT || '4001', 10),
      wsPort: parseInt(process.env.HYDRA_WS_PORT || '4001', 10),
      secure: process.env.HYDRA_SECURE === 'true',
      isForMainnet: process.env.HYDRA_IS_MAINNET === 'true',
      ...config
    };

    this.client = makeHydraClient(WebSocket as any, this.config);
  }

  public getConfig(): HydraClientConfig {
    return { ...this.config };
  }

  public async fetchUTXOs(): Promise<any[]> {
    try {
      return await this.client.fetchUTXOs();
    } catch (clientError) {
      // Fallback to direct HTTP
      try {
        const response = await fetch(`http://${this.config.hostname}:${this.config.httpPort}/snapshot/utxo`);
        const data = await response.json() as Record<string, any>;
        return Object.keys(data).map(key => ({ id: key, ...data[key] }));
      } catch (httpError) {
        throw new Error(`Both client and HTTP methods failed: ${clientError}, ${httpError}`);
      }
    }
  }

  public async getNetworkParameters(): Promise<any> {
    const rawParams = await this.client.parameters;

    // Transform Hydra parameters to Helios-compatible format
    const heliosCompatibleParams = {
      ...rawParams,
      // Add the executionUnitPrices format that Helios expects
      // Map Hydra's exMemFeePerUnit/exCpuFeePerUnit to Helios' expected format
      executionUnitPrices: {
        priceMemory: rawParams.exMemFeePerUnit || 0,
        priceSteps: rawParams.exCpuFeePerUnit || 0
      }
    };

    return heliosCompatibleParams;
  }

  /**
   * Get raw Hydra parameters without Helios compatibility transformation
   * Useful for debugging and understanding the original Hydra format
   */
  public async getRawNetworkParameters(): Promise<any> {
    return await this.client.parameters;
  }

  public isMainnet(): boolean {
    return this.client.isMainnet();
  }

  public async submitTransaction(tx: any, description?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let websocket: any = null;
      let txId: string = '';
      let timeoutId: NodeJS.Timeout;
      let resolved = false;
      let submitted = false;

      // Store original console methods
      const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
      };

      // Silent console during transaction submission
      const silenceConsole = () => {
        console.log = () => { };
        console.error = () => { };
        console.warn = () => { };
        console.info = () => { };
      };

      // Restore console
      const restoreConsole = () => {
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
        console.info = originalConsole.info;
      };

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (websocket) {
          try {
            websocket.close();
          } catch (e) {
            // Ignore close errors
          }
        }
        restoreConsole(); // Always restore console
      };

      const resolveOnce = (result: string) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(result);
        }
      };

      const rejectOnce = (error: any) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(error);
        }
      };

      try {
        // Silence console output during transaction processing
        silenceConsole();

        txId = tx.id().toHex();

        // Set up timeout (60 seconds to allow for full confirmation cycle)
        timeoutId = setTimeout(() => {
          if (submitted) {
            // If we submitted successfully but didn't get final confirmation, assume success
            resolveOnce(txId);
          } else {
            rejectOnce(new Error('Transaction submission timed out'));
          }
        }, 60000);

        // Create WebSocket connection to monitor events
        const wsUrl = `ws${this.config.secure ? 's' : ''}://${this.config.hostname}:${this.config.wsPort}`;
        websocket = new WebSocket(wsUrl);

        websocket.on('open', async () => {
          try {
            // Submit transaction using Helios client (don't await since it doesn't resolve)
            this.client.submitTx(tx, description || 'Transaction submission');
            submitted = true;
          } catch (submitError) {
            rejectOnce(new Error(`Transaction submission failed: ${submitError}`));
          }
        });

        websocket.on('message', (data: any) => {
          try {
            const event = JSON.parse(data.toString());

            // Look for our transaction ID in TxValid events
            if (submitted && event.transactionId === txId) {
              if (event.tag === 'TxValid') {
                // Don't resolve yet - wait for SnapshotConfirmed
              } else if (event.tag === 'TxInvalid') {
                rejectOnce(new Error(`Transaction invalid: ${JSON.stringify(event.validationError)}`));
              }
            }

            // Look for our transaction in SnapshotConfirmed events (final confirmation)
            if (submitted && event.tag === 'SnapshotConfirmed' && event.snapshot && event.snapshot.utxo) {
              const utxoKeys = Object.keys(event.snapshot.utxo);
              const txFoundInSnapshot = utxoKeys.some(key => key.startsWith(txId));

              if (txFoundInSnapshot) {
                resolveOnce(txId);
              }
            }

          } catch (parseError) {
            // Ignore JSON parse errors for non-JSON messages
          }
        });

        websocket.on('error', (error: any) => {
          rejectOnce(new Error(`WebSocket error: ${error.message}`));
        });

        websocket.on('close', () => {
          if (!resolved) {
            if (submitted) {
              // If we submitted successfully but connection closed, assume success
              resolveOnce(txId);
            } else {
              rejectOnce(new Error('WebSocket connection closed before confirmation'));
            }
          }
        });

      } catch (error) {
        rejectOnce(error);
      }
    });
  }

  public async analyzeUTXOs(): Promise<{
    count: number;
    totalLovelace: bigint;
    uniqueAddresses: number;
    totalAssets: number;
    withDatum: number;
    withRefScript: number;
    summary: UtxoSummary[];
  }> {
    const utxos = await this.fetchUTXOs();

    let totalLovelace = BigInt(0);
    const addressSet = new Set<string>();
    let totalAssets = 0;
    let withDatum = 0;
    let withRefScript = 0;

    const summary: UtxoSummary[] = utxos.map(utxo => {
      const lovelace = utxo.output.value.lovelace;
      const address = utxo.address.toString();
      const assets = utxo.output.value.assets || {};
      const hasDatum = !!utxo.output.datum;
      const hasRefScript = !!utxo.output.refScript;

      totalLovelace += lovelace;
      addressSet.add(address);
      totalAssets += Object.keys(assets).length;
      if (hasDatum) withDatum++;
      if (hasRefScript) withRefScript++;

      return {
        id: utxo.id.toString(),
        address,
        lovelace,
        assets,
        hasDatum,
        hasRefScript
      };
    });

    return {
      count: utxos.length,
      totalLovelace,
      uniqueAddresses: addressSet.size,
      totalAssets,
      withDatum,
      withRefScript,
      summary
    };
  }

  public async testConnectivity(): Promise<{
    success: boolean;
    client: boolean;
    http: boolean;
    error?: string;
  }> {
    const result: {
      success: boolean;
      client: boolean;
      http: boolean;
      error?: string;
    } = {
      success: false,
      client: false,
      http: false
    };

    // Test client method
    try {
      await this.client.fetchUTXOs();
      result.client = true;
    } catch (error) {
      // Client failed, that's ok
    }

    // Test HTTP method
    try {
      const response = await fetch(`http://${this.config.hostname}:${this.config.httpPort}/snapshot/utxo`);
      if (response.ok) {
        result.http = true;
      }
    } catch (error) {
      // HTTP failed
    }

    result.success = result.client || result.http;
    if (!result.success) {
      result.error = `Could not connect to Hydra node at ${this.config.hostname}:${this.config.httpPort}`;
    }

    return result;
  }
}

// Export default instance
export const defaultHydraClient = new HydraClientWrapper(); 