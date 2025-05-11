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

interface MessageChunk {
  text: string;
  index: number;
  total: number;
}

// Keep track of message chunks
const messageChunks = new Map<string, MessageChunk[]>();

const onMessage = (message: any) => {
  if (message.tag === 'TxValid') {
    try {
      const txHex = message.transaction.cborHex;
      const tx = Transaction.from_bytes(Buffer.from(txHex, 'hex'));
      const txValue = tx.to_js_value();
      
      if (txValue.auxiliary_data && txValue.auxiliary_data.metadata) {
        const metadata = txValue.auxiliary_data.metadata as Record<string, any>;
        const cleanObject = parseMetadataToObject(metadata, metadataKey);
        
        const msgId = cleanObject.msg_id;
        const chunkIndex = parseInt(cleanObject.chunk_index);
        const totalChunks = parseInt(cleanObject.total_chunks);

        // Validate chunk data
        if (isNaN(chunkIndex) || isNaN(totalChunks) || totalChunks <= 0 || chunkIndex < 0 || chunkIndex >= totalChunks) {
          console.error('Invalid chunk data:', { chunkIndex, totalChunks, msgId });
          return;
        }
        
        // Create or update chunk array for this message
        if (!messageChunks.has(msgId)) {
          try {
            messageChunks.set(msgId, new Array(totalChunks).fill(null));
          } catch (error) {
            console.error('Failed to create chunks array:', { totalChunks, msgId, error });
            return;
          }
        }
        const chunks = messageChunks.get(msgId)!;
        
        // Add this chunk
        chunks[chunkIndex] = {
          text: cleanObject.msg,
          index: chunkIndex,
          total: totalChunks
        };
        
        // Check if we have all chunks
        if (chunks.every(chunk => chunk !== null)) {
          // Sort and combine chunks
          const sortedChunks = chunks.sort((a, b) => a.index - b.index);
          const fullMessage = sortedChunks.map(chunk => chunk.text).join('');
          
          const transactionDetails = {
            sender: cleanObject.sender,
            message: {
              text: fullMessage,
              timestamp: cleanObject.timestamp,
              chunks: sortedChunks
            },
            msg_id: msgId
          };

          console.log('Received complete message:', transactionDetails);
          
          // Clean up
          messageChunks.delete(msgId);
        } else {
          console.log(`Received chunk ${chunkIndex + 1}/${totalChunks} of message ${msgId}`);
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
