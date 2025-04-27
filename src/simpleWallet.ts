import {
    Address,
    Assets,
    TxOutput,
    UTxO,
    Value,
    Wallet
  } from "@hyperionbt/helios";
import { makeSimpleWallet, makeBip32PrivateKey, CardanoClient } from '@helios-lang/tx-utils';
import { NetworkParams, TxInput, TxId } from '@helios-lang/ledger';
import { readFileSync } from 'fs';
import { PrivateKey } from '@emurgo/cardano-serialization-lib-nodejs';
  
  // Function to get UTXOs for a specific address
  async function getAddressUTXOs(addressString: string): Promise<TxInput[]> {
    try {
      // Parse the Cardano address string to get an Address object
      const address = Address.fromBech32(addressString);
      console.log(address);
      // Create a network parameters object to specify which network to use
      const networkParams = {
        networkId: 0,
        slotLength: 1,
        epochLength: 432000,
        maxTxSize: 16384,
        maxValueSize: 5000,
        maxCollateralInputs: 3,
        coinsPerUtxoWord: 34482,
        coinsPerUtxoByte: 4310,
        costModels: {},
        prices: {
          memory: 0,
          steps: 0
        },
        maxExUnits: {
          memory: 14000000,
          steps: 10000000000
        },
        collateralPercentage: 150,
        txFeeFixed: 0,
        txFeePerByte: 0,
        exMemFeePerUnit: 0,
        exCpuFeePerUnit: 0,
        maxBlockExUnits: {
          memory: 14000000,
          steps: 10000000000
        },
        maxBlockHeaderSize: 1100,
        maxBlockBodySize: 90112,
        maxTxExUnits: {
          memory: 14000000,
          steps: 10000000000
        },
        maxValSize: 5000,
        minFeeA: 0,
        minFeeB: 0,
        minUTxOValue: 1000000,
        poolDeposit: 500000000,
        keyDeposit: 2000000,
        utxoDepositPerByte: 4310,
        refScriptsFeePerByte: 0,
        maxTxExMem: 14000000,
        maxTxExCpu: 10000000000,
        maxBlockExMem: 14000000,
        maxBlockExCpu: 10000000000,
        secondsPerSlot: 1,
        stakeAddrDeposit: 2000000,
        refTipSlot: 0,
        refTipTime: Date.now(),
        costModelParamsV1: [],
        costModelParamsV2: [],
        costModelParamsV3: []
      };
      
      // Use the Wallet API to fetch UTXOs for the address
      const skJson = JSON.parse(readFileSync('infra/credentials/alice/alice-funds.sk', 'utf8'));
      console.log('skJson', skJson);
      const skBytes = Buffer.from(skJson.cborHex, 'hex');
      console.log('skBytes', skBytes);
      
      // Extract just the key bytes (skip the CBOR prefix 58 20)
      const keyBytes = skBytes.slice(2); // Remove the CBOR prefix (58 20)
      console.log('keyBytes', keyBytes);
      
      // Create private key from bytes
      const privateKey = PrivateKey.from_normal_bytes(keyBytes);
      console.log('Private key created successfully');
      
      // Create a BIP32 private key from the Ed25519 key
      // We need to pad the key to 96 bytes as expected by BIP32
      const paddedKey = new Uint8Array(96);
      paddedKey.set(keyBytes, 0); // Copy the 32 bytes of the Ed25519 key
      // The rest of the bytes will be zeros, which is fine for our use case
      
      const spendingPrivateKey = makeBip32PrivateKey(Array.from(paddedKey));
      console.log('BIP32 private key created successfully');
      
      const cardanoClient = {
        network: "preprod",
        socketPath: process.env.CARDANO_NODE_SOCKET_PATH || "/path/to/node.socket",
        isMainnet: () => false,
        now: Date.now(),
        parameters: Promise.resolve(networkParams),
        getUtxo: async (): Promise<TxInput> => {
          throw new Error("Not implemented");
        },
        getUtxos: async (): Promise<TxInput[]> => {
          // Return empty array for now
          return [];
        },
        submitTx: async (): Promise<TxId> => {
          throw new Error("Not implemented");
        }
      };
      const wallet = makeSimpleWallet(spendingPrivateKey, undefined, cardanoClient);
      console.log('Wallet created successfully');
      
      const utxos = await cardanoClient.getUtxos();
      console.log(`Found ${utxos.length} UTXOs for address ${addressString}`);
      
      // Log some basic information about each UTXO
      utxos.forEach((utxo: TxInput, i: number) => {
        console.log(`UTXO #${i + 1}:`);
        console.log(`  TxId: ${utxo.id}`);
        console.log(`  Output: ${utxo.output}`);
        console.log(`  Value: ${utxo.value.lovelace} lovelace`);
        
        // Log any native tokens in this UTXO
        const assets = utxo.value.assets;
        if (assets && Object.keys(assets).length > 0) {
          console.log("  Assets:");
          Object.entries(assets).forEach(([policyId, tokens]) => {
            Object.entries(tokens).forEach(([assetName, amount]) => {
              console.log(`    ${amount} ${assetName} (Policy: ${policyId})`);
            });
          });
        }
      });
      
      return utxos;
    } catch (error) {
      console.error("Error fetching UTXOs:", error);
      throw error;
    }
  }
  
  // Example usage
  async function main() {
    // Replace with your Cardano address
    const addressToQuery = "addr_test1vr22nfdy3zwxptu4yzd4ec8wutwsajh92dn5n39aqegut5qmehxjs";
    
    try {
      const utxos = await getAddressUTXOs(addressToQuery);
      
      // You can now use these UTXOs to build transactions
      console.log(`Total lovelace in all UTXOs: ${utxos.reduce((sum, utxo) => sum + utxo.value.lovelace, 0n)}`);
    } catch (error) {
      console.error("Failed to get UTXOs:", error);
    }
  }
  
  main();