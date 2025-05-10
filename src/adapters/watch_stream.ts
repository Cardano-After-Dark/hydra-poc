import { startStream } from '../core/stream';
import { Transaction } from "@emurgo/cardano-serialization-lib-nodejs";

const metadataKey = '1337';

function parseMetadataToObject(metadata: Record<string, any>, key: string): Record<string, string> {
    // console.log('Metadata before parsing:', metadata);
    const rawData = JSON.parse(metadata.get(key)!);
    // console.log('Raw data after JSON parse:', rawData);
    const result = rawData.map.reduce((acc: Record<string, string>, item: any) => {
        // console.log('Processing item:', item);
        acc[item.k.string] = item.v.string;
        return acc;
    }, {});
    // console.log('Final parsed result:', result);
    return result;
}

// Create callbacks for handling messages and errors
const onMessage = (message: any) => {
  if (message.tag === 'TxValid') {
    try {
      const txHex = message.transaction.cborHex;
      const tx = Transaction.from_bytes(Buffer.from(txHex, 'hex'));
      const txValue = tx.to_js_value();
      
      // Get the transaction input details
      const input = txValue.body.inputs[0];
      const txHash = input.transaction_id;
      const outputIndex = input.index;

      if (txValue.auxiliary_data && txValue.auxiliary_data.metadata) {
        const metadata = txValue.auxiliary_data.metadata as Record<string, any>;
        const cleanObject = parseMetadataToObject(metadata, metadataKey);
        
        const transactionDetails = {
          sender: cleanObject.sender,
          message: cleanObject.msg,
          timestamp: cleanObject.timestamp
        };

        console.log(transactionDetails);
        
      } else {
        console.log('No metadata found in transaction');
      }
    } catch (error) {
      console.error('Error decoding transaction:', error);
    }
  }
};

const onError = (error: Error) => {
  console.error('Stream error:', error);
};

// Start the stream
const stream = startStream(onMessage, onError);


// When you're done, close the stream
// stream.close();
