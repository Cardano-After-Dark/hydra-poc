import { startStream } from '../core/stream';
import { Transaction } from "@emurgo/cardano-serialization-lib-nodejs";

const metadataKey = '1337';

// Extract metadata from transaction, handling different formats
function extractMetadata(txValue: any): Record<string, any> | null {
  try {
    if (txValue.auxiliary_data) {
      // Check if metadata is in auxiliary_data
      if (txValue.auxiliary_data.metadata) {
        return txValue.auxiliary_data.metadata as Record<string, any>;
      }
      
      // Check if metadata is directly in auxiliary_data
      if (txValue.auxiliary_data['1337']) {
        return txValue.auxiliary_data as Record<string, any>;
      }
    }
    
    // Check if it's directly in the tx
    if (txValue.metadata) {
      return txValue.metadata as Record<string, any>;
    }
    
    // Check for a different format
    if (txValue.transaction && txValue.transaction.metadata) {
      return txValue.transaction.metadata as Record<string, any>;
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return null;
  }
}

// Process metadata value into a standardized format
function processMetadataValue(value: any): any {
  // Handle different formats of metadata
  if (value === null || value === undefined) {
    return value;
  }
  
  // If it's a simple string/number
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  
  // If it's the Cardano format with string/int markers
  if (value.string !== undefined) {
    return value.string;
  }
  if (value.int !== undefined) {
    return parseInt(value.int);
  }
  
  // If it's an array
  if (Array.isArray(value)) {
    return value.map(processMetadataValue);
  }
  
  // If it's a map structure
  if (value.map !== undefined) {
    return value.map.reduce((acc: Record<string, any>, item: any) => {
      acc[processMetadataValue(item.k)] = processMetadataValue(item.v);
      return acc;
    }, {});
  }
  
  // If it's a regular object
  if (typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const key in value) {
      result[key] = processMetadataValue(value[key]);
    }
    return result;
  }
  
  return value;
}

// Handle the special "list" format for chunks
function normalizeChunks(chunks: any): any[] {
  // If it's already an array, return it
  if (Array.isArray(chunks)) {
    return chunks;
  }
  
  // If it has a list property that's an array, return that
  if (chunks && chunks.list && Array.isArray(chunks.list)) {
    return chunks.list;
  }
  
  // If it's an object with only one property that's an array, return that
  if (chunks && typeof chunks === 'object') {
    const keys = Object.keys(chunks);
    if (keys.length === 1 && Array.isArray(chunks[keys[0]])) {
      return chunks[keys[0]];
    }
  }
  
  // If we can't figure it out, return an empty array
  return [];
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
      
      // Extract metadata using the helper function
      const metadata = extractMetadata(txValue);
      
      if (metadata) {
        // Try different ways to access the metadata
        let messageData = null;
        
        // Try accessing by property
        if (metadata[metadataKey]) {
          messageData = processMetadataValue(metadata[metadataKey]);
        } 
        // Try accessing with get() method if it exists
        else if ('get' in metadata && typeof metadata.get === 'function') {
          try {
            const rawData = metadata.get(metadataKey);
            if (rawData) {
              messageData = processMetadataValue(JSON.parse(rawData as string));
            }
          } catch (e) {
            // Silent catch
          }
        }
        // Try looking for the key as a string (some libraries convert numbers to strings)
        else if (metadata[metadataKey.toString()]) {
          messageData = processMetadataValue(metadata[metadataKey.toString()]);
        }
        
        if (messageData) {
          const msgId = messageData.msg_id;
          const sender = messageData.sender;
          const timestamp = messageData.timestamp;
          const totalChunks = parseInt(messageData.total_chunks.toString());
          
          // Check for chunks in various formats and normalize
          if (messageData.chunks) {
            const normalizedChunks = normalizeChunks(messageData.chunks);
            
            if (normalizedChunks.length > 0) {
              // Sort chunks by index
              const sortedChunks = [...normalizedChunks]
                .map(chunk => ({
                  text: chunk.text || '',
                  index: parseInt((chunk.index || '0').toString())
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

              console.log('Received message:', fullMessage);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error decoding transaction:', error);
    }
  }
};

const onError = (error: Error) => {
  console.error('Stream error:', error);
};

// Log when connection is established
const onConnected = () => {
  console.log('Connected to Hydra node');
};

// Start the stream
const stream = startStream(onMessage, onError, onConnected);

// When you're done, close the stream
// stream.close();
