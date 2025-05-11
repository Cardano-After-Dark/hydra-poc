import { startStream } from '../core/stream';
import { Transaction } from "@emurgo/cardano-serialization-lib-nodejs";

const metadataKey = '1337';

function parseMetadataToObject(metadata: Record<string, any>, key: string): Record<string, any> {
    // console.log('Metadata before parsing:', metadata);
    const rawData = JSON.parse(metadata.get(key)!);
    // console.log('Raw data after JSON parse:', rawData);
    
    // Recursive function to handle nested structures
    const processValue = (value: any): any => {
        if (value.string !== undefined) return value.string;
        if (value.int !== undefined) return parseInt(value.int);
        if (value.list !== undefined) return value.list.map(processValue);
        if (value.map !== undefined) {
            return value.map.reduce((acc: Record<string, any>, item: any) => {
                acc[item.k.string] = processValue(item.v);
                return acc;
            }, {});
        }
        return value;
    };
    
    return processValue(rawData);
}

interface MessageChunk {
  text: string;
  index: number;
}

const onMessage = (message: any) => {
  if (message.tag === 'TxValid') {
    try {
      const txHex = message.transaction.cborHex;
      const tx = Transaction.from_bytes(Buffer.from(txHex, 'hex'));
      const txValue = tx.to_js_value();
      
      if (txValue.auxiliary_data && txValue.auxiliary_data.metadata) {
        const metadata = txValue.auxiliary_data.metadata as Record<string, any>;
        const messageData = parseMetadataToObject(metadata, metadataKey);
        
        const msgId = messageData.msg_id;
        const sender = messageData.sender;
        const timestamp = messageData.timestamp;
        const totalChunks = parseInt(messageData.total_chunks);
        
        // Check if we have chunks array in the new format
        if (messageData.chunks && Array.isArray(messageData.chunks)) {
          // Sort chunks by index
          const sortedChunks = [...messageData.chunks]
            .map(chunk => ({
              text: chunk.text,
              index: parseInt(chunk.index)
            }))
            .sort((a, b) => a.index - b.index);
            
          // Combine chunks into full message
          const fullMessage = sortedChunks.map(chunk => chunk.text).join('');
          
          const transactionDetails = {
            sender: sender,
            message: {
              text: fullMessage,
              timestamp: timestamp,
              chunks: sortedChunks
            },
            msg_id: msgId
          };

          console.log('Received complete message:', transactionDetails);
        } else {
          console.log('No chunks array found in metadata');
        }
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
