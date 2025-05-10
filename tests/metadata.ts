import { Address } from "@hyperionbt/helios";
import { createTransactionFromUtxo } from "../src/core/builders/transactionBuilder";
import { getConfig } from "../src/utils/config";
import { Logger } from "../src/utils/logger";
import logger from "../src/utils/debugLogger";
import * as path from 'path';

// Create an instance of the original logger for compatibility
const appLogger = Logger.getInstance();

async function sendMessage(message: string, senderAddress: Address, recipientAddress: string, amount: number, config: any) {
    debugger
    try {
      // Create metadata with message
      const metadata = {
        1337: { 
          msg: message,
          msg_id: Date.now().toString()
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
    }
  }

  async function test_send_message(message: string) {
    try {
      logger.info("Starting Hydra message sender...", {
        test: { message }
      });
      
      const config = getConfig();
      logger.debug(`Config loaded: ${config.credentialsDir ? 'Successfully' : 'Failed'}`, {
        config: { credentialsDir: config.credentialsDir }
      });
      
      const senderAddress = Address.fromBech32("addr_test1vql8mpv20pdcr0pzqwyl23xsdejz5p9umc9rtk0xcha97vsuynzsz");
      const recipientAddress = "addr_test1vql8mpv20pdcr0pzqwyl23xsdejz5p9umc9rtk0xcha97vsuynzsz";
      const amount = 1000000; // 1 ADA in lovelace
  
      logger.info(`Sending message: "${message}"`, {
        transaction: { senderAddress, recipientAddress, amount }
      });
      await sendMessage(message, senderAddress, recipientAddress, amount, config);
      debugger
      logger.info("Test completed", {
        test: { message, status: 'success' }
      });
      logger.endSession();
    } catch (error) {
      logger.error("Error in test:", {
        error: { message: error.message, stack: error.stack }
      }, error);
      logger.endSession();
    }
  }

// The message to send
const message = "Debugger is working better now... "
logger.debug(`Message "${message}" is being prepared for sending`, {
  test: { message }
});
debugger
// Run the test with the specified message
test_send_message(message);
debugger