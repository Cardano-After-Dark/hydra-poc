import { Address } from "@hyperionbt/helios";
import { startStream } from '../core/stream';
import logger, { LogLevel } from "../utils/debugLogger";
import * as readline from 'readline';
import { Transaction } from "@emurgo/cardano-serialization-lib-nodejs";
import { getConfig } from "../utils/config";

// Configure minimal logging
logger.configure({
  showTimestamp: false,
  showCallStack: false,
  showCpuTime: false,
  showSection: false,
  showAttributes: false,
  saveToFile: false
});
logger.setLevel(LogLevel.ERROR); // Only show errors

interface ReceivedMessage {
  sender: string;
  text: string;
  timestamp: string;
  msgId: string;
}

const receivedMessages: ReceivedMessage[] = [];
let streamConnection: any = null;
let username = '';
let connectionStatus = 'Connecting...';

function clearScreen() {
  process.stdout.write('\x1Bc');
}

function drawBox(width: number, height: number, title: string, content: string[]): string[] {
  const box: string[] = [];
  const topBorder = '┌' + '─'.repeat(width - 2) + '┐';
  const bottomBorder = '└' + '─'.repeat(width - 2) + '┘';
  
  box.push(topBorder);
  if (title) {
    const titleLine = '│ ' + title.padEnd(width - 4) + ' │';
    box.push(titleLine);
    box.push('├' + '─'.repeat(width - 2) + '┤');
  }
  
  content.forEach(line => {
    const paddedLine = '│ ' + line.padEnd(width - 4) + ' │';
    box.push(paddedLine);
  });
  
  box.push(bottomBorder);
  return box;
}

function displayScreen() {
  clearScreen();
  
  // Get terminal dimensions
  const width = process.stdout.columns;
  const height = process.stdout.rows;
  
  // Show connection status
  console.log(`Connection Status: ${connectionStatus}`);
  console.log('');
  
  // Draw message history
  const messageContent = receivedMessages.length === 0 
    ? ['No messages received yet. Waiting for incoming messages...']
    : receivedMessages.map(msg => {
        return `${msg.timestamp} From: ${msg.sender.substring(0, 10)}... | ${msg.text}`;
      });
  
  const messageBox = drawBox(width, height - 8, `Message Receiver (${username})`, messageContent);
  messageBox.forEach(line => console.log(line));
  
  // Draw help
  const helpBox = drawBox(width, 3, 'Help', [
    'Commands:',
    '  - Press Ctrl+C to quit',
    '  - Press R to refresh the screen'
  ]);
  helpBox.forEach(line => console.log(line));
}

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
    logger.error('Error extracting metadata:', error);
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

function onMessageReceived(message: any) {
  // Only process TxValid messages with actual transactions
  if (message.tag === 'TxValid') {
    try {
      const txHex = message.transaction.cborHex;
      const tx = Transaction.from_bytes(Buffer.from(txHex, 'hex'));
      const txValue = tx.to_js_value();
      
      // Extract metadata using the helper function
      const metadata = extractMetadata(txValue);
      
      if (metadata) {
        const metadataKey = '1337';
        
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
            // Silent error handling
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
              
              // Add to received messages
              receivedMessages.push({
                sender,
                text: fullMessage,
                timestamp: new Date(timestamp).toLocaleTimeString(),
                msgId
              });
              
              // Update the display
              displayScreen();
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error processing received message:', error);
    }
  } else if (message.tag === 'HeadIsOpen') {
    connectionStatus = 'Connected - Head Open';
    displayScreen();
  }
  // Silently ignore other message types
}

function onStreamError(error: Error) {
  logger.error('Stream error:', error);
  connectionStatus = `Error: ${error.message}`;
  displayScreen();
}

// Added WebSocket connected callback
function onStreamConnected() {
  connectionStatus = 'Connected';
  displayScreen();
}

async function promptForUsername(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Enter your username to start receiving messages (e.g., alice, bob): ', (answer) => {
      rl.close();
      resolve(answer.trim() || 'alice'); // Default to 'alice' if empty
    });
  });
}

export async function main() {
  try {
    // Ask for username before starting
    username = await promptForUsername();
    
    // Display initial screen
    displayScreen();
    
    // Enable raw mode for input handling
    process.stdin.setRawMode(true);
    process.stdin.resume();
    
    // Get config for WebSocket port
    const config = getConfig();
    
    // Start the stream with explicit port - use MY_API_PORT from env if available
    const apiPort = process.env.MY_API_PORT || config.aliceApiPort;
    connectionStatus = `Connecting to port ${apiPort}...`;
    displayScreen();
    
    streamConnection = startStream(
      onMessageReceived, 
      onStreamError,
      onStreamConnected,  
      `ws://127.0.0.1:${apiPort}`
    );
    
    // Handle keyboard input
    process.stdin.on('data', (data) => {
      const key = data.toString();
      
      if (key === '\u0003') { // Ctrl+C
        if (streamConnection) {
          streamConnection.close();
        }
        process.exit(0);
      } else if (key.toLowerCase() === 'r') { // Refresh screen
        displayScreen();
      }
    });
    
    // Handle process exit using the global process object
    process.on('SIGINT', () => {
      if (streamConnection) {
        streamConnection.close();
      }
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// For ES modules, check if this is the main module by looking at import.meta.url
// This is the ES module equivalent of the CommonJS "require.main === module" check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
} 