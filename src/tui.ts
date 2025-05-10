import { Address } from "@hyperionbt/helios";
import { createTransactionFromUtxo } from "./core/builders/transactionBuilder";
import { getConfig } from "./utils/config";
import logger, { LogLevel } from "./utils/debugLogger";
import * as path from 'path';
import * as readline from 'readline';
import * as fs from 'fs';

// Disable all logging
logger.configure({
  showTimestamp: false,
  showCallStack: false,
  showCpuTime: false,
  showSection: false,
  showAttributes: false,
  saveToFile: false
});
logger.setLevel(LogLevel.CRITICAL); // Only show critical errors (effectively disabling all logging)

interface Message {
  text: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'error';
}

const messages: Message[] = [];

let currentInput = '';

function updateInput(char: string) {
  if (char === '\x7f' || char === '\b') { // Handle both backspace and delete
    if (currentInput.length > 0) {
      currentInput = currentInput.slice(0, -1);
      // Move cursor back, clear character, and move cursor forward
      process.stdout.write('\b \b');
    }
  } else if (char >= ' ' && char <= '~') { // Only handle printable characters
    currentInput += char;
    process.stdout.write(char);
  }
}

function clearInput() {
  // Clear the current line
  process.stdout.write('\r\x1B[K');
  currentInput = '';
}

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
  
  // Draw message history
  const messageContent = messages.length === 0 
    ? ['No messages yet. Start typing to send a message!']
    : messages.map(msg => {
        const statusIcon = msg.status === 'sending' ? '*' : msg.status === 'error' ? 'x' : '✓';
        return `${msg.timestamp} ${statusIcon} ${msg.text}`;
      });
  
  const messageBox = drawBox(width, height - 4, 'Message History', messageContent);
  messageBox.forEach(line => console.log(line));
  
  // Draw input box
  const inputBox = drawBox(width, 3, 'Input', [currentInput]);
  inputBox.forEach(line => console.log(line));
  
  // Draw help
  const helpBox = drawBox(width, 4, 'Help', [
    'Commands:',
    '  - Type your message and press Enter to send',
    '  - Type "exit" to quit',
    '  - Type "clear" to clear message history'
  ]);
  helpBox.forEach(line => console.log(line));
  
  // Position cursor in input box (move up 8 lines and to column 2)
  process.stdout.write('\x1B[10A\x1B[2G> ');
}

async function sendMessage(text: string) {
  const timestamp = new Date().toLocaleTimeString();
  messages.push({ text, timestamp, status: 'sending' });
  displayScreen();

  try {
    const config = getConfig();
    const alice_address = path.join(config.credentialsDir, 'alice/alice-funds.addr');
    const senderAddress = Address.fromBech32(fs.readFileSync(alice_address, 'utf8').trim());
    const recipientAddress = senderAddress.toBech32(); // Use same address for testing
    const amount = 1000000; // 1 ADA in lovelace

    // Create metadata with message
    const metadata = {
      1337: { 
        msg: text,
        msg_id: Date.now().toString(),
        sender: senderAddress.toBech32(),
        timestamp: new Date().toISOString()
      }
    };

    // Create transaction builder
    const builder = await createTransactionFromUtxo(
      senderAddress,
      recipientAddress,
      amount
    );

    // Add metadata to transaction
    builder.setMetadata(metadata);

    // Build raw transaction
    const rawTx = await builder.build();
    logger.debug("Raw transaction built", { transaction: { type: rawTx.type } });

    // Sign transaction
    const signingKeyFile = path.join(config.credentialsDir, 'alice/alice-funds.sk');
    const signedTx = await builder.sign(signingKeyFile);
    logger.debug("Transaction signed", { transaction: { type: signedTx.type } });

    // Submit transaction to Hydra head
    await builder.submit(signedTx);
    logger.info("Message sent successfully!", { message: { text } });

    // Update message status
    const message = messages.find(msg => msg.timestamp === timestamp);
    if (message) {
      message.status = 'sent';
      displayScreen();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error("Error sending message", { error: { message: errorMessage } });
    // Update message status
    const message = messages.find(msg => msg.timestamp === timestamp);
    if (message) {
      message.status = 'error';
      displayScreen();
    }
  }
}

async function main() {
  // Enable raw mode for precise input control
  process.stdin.setRawMode(true);
  process.stdin.resume();
  
  displayScreen();

  process.stdin.on('data', async (data) => {
    const char = data.toString();
    
    // Handle special keys
    if (char === '\r') { // Enter
      const text = currentInput.trim();
      clearInput();
      
      if (text.toLowerCase() === 'exit') {
        console.log('\nGoodbye!');
        process.exit(0);
      }

      if (text.toLowerCase() === 'clear') {
        messages.length = 0;
        displayScreen();
        return;
      }

      if (text) {
        await sendMessage(text);
      }

      displayScreen();
    } else if (char === '\u0003') { // Ctrl+C
      console.log('\nGoodbye!');
      process.exit(0);
    } else {
      updateInput(char);
    }
  });

  // Handle process exit
  process.on('SIGINT', () => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 