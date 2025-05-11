import { Address } from "@hyperionbt/helios";
import { createTransactionFromUtxo } from "../src/core/builders/transactionBuilder";
import { getConfig } from "../src/utils/config";
import { Logger } from "../src/utils/logger";
import logger from "../src/utils/debugLogger";
import * as path from 'path';
import * as fs from 'fs';

// Create an instance of the original logger for compatibility
const appLogger = Logger.getInstance();

// Add this before the test_send_message function
const TEST_MESSAGES = [
  "Hello from Hydra!",
  "Testing message transmission...",
  "Random message #1",
  "Random message #2",
  "Debug message test",
  "Hydra network test",
  "Transaction metadata test",
  "Random test message",
  "Another test message",
  "Final test message"
];

function getRandomMessage(): string {
  const randomIndex = Math.floor(Math.random() * TEST_MESSAGES.length);
  return TEST_MESSAGES[randomIndex];
}

function getMessageByteLength(message: string): number {
  return new TextEncoder().encode(message).length;
}

function validateMessageLength(message: string, maxBytes: number = 64): boolean {
  const byteLength = getMessageByteLength(message);
  logger.debug(`Message length check: ${byteLength} bytes`, {
    validation: { message, byteLength, maxBytes }
  });
  return byteLength <= maxBytes;
}

async function sendMessage(message: string, senderAddress: Address, recipientAddress: string, amount: number, config: any) {
    debugger
    try {
      // Validate message length
      if (!validateMessageLength(message)) {
        throw new Error(`Message exceeds maximum length of 64 bytes. Current length: ${getMessageByteLength(message)} bytes`);
      }

      // Create metadata with message
      const metadata = {
        1337: { 
          msg: message,
          msg_id: Date.now().toString(),
          sender: senderAddress.toBech32(),
          timestamp: new Date().toISOString()
        }
      };
      
      // DEBUG level - only shown in debug mode
      logger.debug(`Creating metadata with message: "${message}"`, {
        metadata: { message, metadata }
      });
  
      // Create transaction builder
      const builder = await createTransactionFromUtxo(
        senderAddress,
        recipientAddress,
        amount
      );
      debugger
      // Add metadata to transaction
      builder.setMetadata(metadata);
      logger.info("Metadata added to transaction", {
        metadata: { message, metadata }
      });
  
      // Build raw transaction
      const rawTx = await builder.build();
      logger.info("Raw transaction built", {
        transaction: { rawTx }
      });
  
      // Sign transaction
      const signingKeyFile = path.join(config.credentialsDir, 'alice/alice-funds.sk');
      const signedTx = await builder.sign(signingKeyFile);
      logger.info("Transaction signed", {
        transaction: { signedTx }
      });
      debugger
      // Submit transaction to Hydra head
      await builder.submit(signedTx);
      logger.info("Message sent successfully!", {
        metadata: { message, metadata }
      });
    } catch (error) {
      logger.error("Error sending message:", {
        error: { message: error.message, stack: error.stack }
      }, error);
      throw error;
    }
  }

  async function test_send_message(message?: string) {
    try {
      // Use provided message or get a random one
      const messageToSend = message || getRandomMessage();
      
      logger.info("Starting Hydra message sender...", {
        test: { message: messageToSend }
      });
      
      const config = getConfig();
      logger.debug(`Config loaded: ${config.credentialsDir ? 'Successfully' : 'Failed'}`, {
        config: { credentialsDir: config.credentialsDir }
      });
      
      debugger
      const alice_address = path.join(config.credentialsDir, 'alice/alice-funds.addr');
      const senderAddress = Address.fromBech32(fs.readFileSync(alice_address, 'utf8').trim());
      const recipientAddress = senderAddress.toBech32(); // Use same address for testing
      const amount = 1000000; // 1 ADA in lovelace
  
      logger.info(`Sending message: "${messageToSend}"`, {
        transaction: { senderAddress, recipientAddress, amount }
      });
      await sendMessage(messageToSend, senderAddress, recipientAddress, amount, config);
      
      logger.info("Test completed successfully", {
        test: { message: messageToSend, status: 'success' }
      });
      
      // Log success but don't exit
      logger.info('\n✅ Test completed successfully!');
      debugger
      return true;
    } catch (error) {
      logger.error("Error in test:", {
        error: { message: error.message, stack: error.stack }
      }, error);
      logger.endSession();
      
      // Log error but don't exit
      console.error('\n❌ Test failed:', error.message);
      return false;
    }
  }

// Handle process termination signals
process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM signal. Cleaning up...');
  logger.endSession();
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT signal. Cleaning up...');
  logger.endSession();
});

// Handle process exit
process.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✨ Process completed successfully');
  } else {
    console.log(`\n⚠️ Process exited with code ${code}`);
  }
});

// Replace the existing message and test call with:
logger.debug("Preparing to send a test message", {
  test: { mode: "random" }
});

// Run the test with a random message
test_send_message()
  .then(success => {
    if (!success) {
      process.exitCode = 1;
    }
  })
  .catch(error => {
    console.error('\n❌ Unhandled error:', error.message);
    process.exitCode = 1;
  });