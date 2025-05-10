import { Address } from "@hyperionbt/helios";
import { createTransactionFromUtxo } from "../src/core/builders/transactionBuilder";
import { getConfig } from "../src/utils/config";
import { Logger } from "../src/utils/logger";
import logger from "../src/utils/debugLogger";
import * as path from 'path';

// Create an instance of the original logger for compatibility
const appLogger = Logger.getInstance();
debugger
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
      logger.debug(`Creating metadata with message: "${message}"`);
  
      // Create transaction builder
      const builder = await createTransactionFromUtxo(
        senderAddress,
        recipientAddress,
        amount
      );
      debugger
      // Add metadata to transaction
      builder.setMetadata(metadata);
      logger.info("Metadata added to transaction");
  
      // Build raw transaction
      const rawTx = await builder.build();
      logger.info("Raw transaction built");
  
      // Sign transaction
      const signingKeyFile = path.join(config.credentialsDir, 'alice/alice-funds.sk');
      const signedTx = await builder.sign(signingKeyFile);
      logger.info("Transaction signed");
      debugger
      // Submit transaction to Hydra head
      await builder.submit(signedTx);
      logger.info("Message sent successfully!");
    } catch (error) {
      logger.error("Error sending message:", error);
    }
  }

  async function test_send_message(message: string) {
    try {
      logger.info("Starting Hydra message sender...");
      
      const config = getConfig();
      logger.debug(`Config loaded: ${config.credentialsDir ? 'Successfully' : 'Failed'}`);
      
      const senderAddress = Address.fromBech32("addr_test1vql8mpv20pdcr0pzqwyl23xsdejz5p9umc9rtk0xcha97vsuynzsz");
      const recipientAddress = "addr_test1vql8mpv20pdcr0pzqwyl23xsdejz5p9umc9rtk0xcha97vsuynzsz";
      const amount = 1000000; // 1 ADA in lovelace
  
      logger.info(`Sending message: "${message}"`);
      await sendMessage(message, senderAddress, recipientAddress, amount, config);
      debugger
      logger.info("Test completed");
      appLogger.close();
    } catch (error) {
      logger.error("Error in test:", error);
      appLogger.close();
    }
  }



// The message to send
const message = "Now i am sending another message. "
logger.debug(`Message "${message}" is being prepared for sending`);
debugger
// Run the test with the specified message
test_send_message(message);
debugger