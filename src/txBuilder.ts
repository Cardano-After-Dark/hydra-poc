import { makeTxOutput } from '@helios-lang/ledger';
import { makeTxInput } from '@helios-lang/ledger';
import { 
  makeTxBuilder,
} from "@helios-lang/tx-utils";
import {
  TxInput,
  TxOutput,
  TxMetadataAttr,
  Address,
  PubKeyHash,
  makeShelleyAddress,
  makePubKeyHash,
  makeValue,
  makeTxId,
} from "@helios-lang/ledger";
import url from 'url';

async function buildTransaction(
  utxo: TxInput,
  output: TxOutput,
  key: number,
  value: TxMetadataAttr,
  changeAddress: Address,
  signer: PubKeyHash
) {

  // Create a new transaction builder
  const txBuilder = makeTxBuilder({
    isMainnet: false,
  });

  // Build your transaction using the builder's methods
  txBuilder
    .spendUnsafe([utxo])
    .addOutput(output)
    .setMetadataAttribute(key, value)
    .addSigners(signer);

  // Build the final transaction
  const tx = await txBuilder.build({
    changeAddress: changeAddress,
  });

  return tx;
}

// Test function that uses real testnet data
async function testTransaction() {
    const senderAddr = makeShelleyAddress("addr_test1vry0h6ld6t05dlql0znc983d83v9rsp9kltxc072c7s3c8g537h3u"); // bob
    const recipientAddr = makeShelleyAddress("addr_test1vql8mpv20pdcr0pzqwyl23xsdejz5p9umc9rtk0xcha97vsuynzsz"); // alice
    const changeAddr = senderAddr;
    const signerPubKeyHash = makePubKeyHash(senderAddr.spendingCredential.toString());

    try {
        // Create input UTXO with more funds to cover fees
        const inputValue = makeValue({ lovelace: 5262767n });
        const outputValue = makeValue({ lovelace: 2000000n });

        const testOutput = makeTxOutput(
            recipientAddr,
            outputValue,
            undefined,  // datum
            undefined   // refScript
        );

        const testUtxo = makeTxInput(
            [makeTxId("04f63fbb9ab093d265a943138afcdcd665da8e6ae3a33b11ce1ce3b902fdfc55"), 0],
            makeTxOutput(senderAddr, inputValue, undefined, undefined)
        );

        const metadataKey = 674;
        const metadataValue = {
          list: [
            "Test transaction",
            Date.now()
          ]
        };

        // Build the transaction
        const transaction = await buildTransaction(
          testUtxo,
          testOutput,
          metadataKey,
          metadataValue,
          changeAddr,
          signerPubKeyHash
        );

        console.log("Transaction built successfully!");
        console.log("Transaction details:", {
          inputs: transaction.body.inputs.length,
          outputs: transaction.body.outputs.length,
          fees: transaction.body.fee?.toString()
        });

        // Convert transaction body to CBOR hex string properly
        const txCbor = Buffer.from(transaction.toCbor()).toString('hex');
        console.log("Transaction CBOR:", txCbor);

        transaction.addSignature

        return transaction;
    } catch (error) {
        console.error("Error building transaction:", error);
        throw error;
    }
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  testTransaction()
    .then(() => console.log("Test completed successfully"))
    .catch((error) => console.error("Test failed:", error));
}

export { buildTransaction, testTransaction };