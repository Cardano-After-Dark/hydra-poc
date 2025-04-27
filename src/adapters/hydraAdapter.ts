import { Address } from "@hyperionbt/helios";
import { Utxos } from '../core/types/utxo';
import { getConfig } from '../utils/config';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance();

/**
 * Get UTXOs for a given address from the Hydra head
 * @param address The address to get UTXOs for
 * @param hydraHeadUrl The URL of the Hydra head (defaults to http://127.0.0.1:4001)
 * @returns Promise containing the UTXOs for the address
 */
export async function getUtxos(address: Address, hydraHeadUrl: string = "http://127.0.0.1:4001"): Promise<Utxos> {
  try {
    logger.debug(`Fetching UTXOs from ${hydraHeadUrl} for address: ${address.toBech32()}`);
    const response = await fetch(`${hydraHeadUrl}/snapshot/utxo`);
    if (!response.ok) {
      throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
    }

    const utxos = await response.json() as Utxos;
    logger.debug(`Received ${Object.keys(utxos).length} UTXOs`);

    // Convert the input address to bech32 format for comparison
    const targetAddress = address.toBech32();
    
    // Filter UTXOs for the given address
    const filteredUtxos = Object.entries(utxos)
      .filter(([_, value]) => {
        const matches = value.address === targetAddress;
        if (matches) {
          logger.debug(`Found matching UTXO for address ${targetAddress}`);
        }
        return matches;
      })
      .reduce((acc: Utxos, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
      
    logger.info(`Found ${Object.keys(filteredUtxos).length} UTXOs for address ${targetAddress}`);
    return filteredUtxos;
  } catch (error) {
    logger.error("Error getting UTXOs:", error);
    throw error;
  }
} 