import { Address } from "@hyperionbt/helios";

interface UtxoValue {
  address: string;
  datum: null;
  datumhash: null;
  inlineDatum: null;
  inlineDatumRaw: null;
  referenceScript: null;
  value: {
    lovelace: number;
    assets?: Record<string, number>;
  };
}

interface Utxos {
  [key: string]: UtxoValue;
}

/**
 * Get UTXOs for a given address from the Hydra head
 * @param address The address to get UTXOs for
 * @param hydraHeadUrl The URL of the Hydra head (defaults to http://127.0.0.1:4001)
 * @returns Promise containing the UTXOs for the address
 */
export async function getUtxos(address: Address, hydraHeadUrl: string = "http://127.0.0.1:4001"): Promise<Utxos> {
  try {
    const response = await fetch(`${hydraHeadUrl}/snapshot/utxo`);
    if (!response.ok) {
      throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
    }

    const utxos = await response.json() as Utxos;

    // Convert the input address to bech32 format for comparison
    const targetAddress = address.toBech32();
    
    // Filter UTXOs for the given address
    const filteredUtxos = Object.entries(utxos)
      .filter(([_, value]) => {
        const matches = value.address === targetAddress;
        console.log(`Comparing ${value.address} with ${targetAddress}: ${matches}`);
        return matches;
      })
      .reduce((acc: Utxos, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
      
    return filteredUtxos;
  } catch (error) {
    console.error("Error getting UTXOs:", error);
    throw error;
  }
}

async function main() {
  // Using an address that we know has UTXOs in the Hydra head
  const address = Address.fromBech32("addr_test1vql8mpv20pdcr0pzqwyl23xsdejz5p9umc9rtk0xcha97vsuynzsz");
  const utxos = await getUtxos(address);
  console.log("Final result:", utxos);
}

main();
