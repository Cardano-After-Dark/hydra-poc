import { Address } from "@hyperionbt/helios";
import { createTransactionFromUtxo } from "./core/builders/transactionBuilder";
import { getConfig } from "./utils/config";
import { Logger } from "./utils/logger";
import * as path from 'path';
import * as readline from 'readline';

const logger = Logger.getInstance();

async function promptForMessage(rl: readline.Interface): Promise<string> {
  return new Promise((resolve) => {
    rl.question('\nEnter your message (or type "exit" to quit): ', (message) => {
      resolve(message);
    });
  });
}

async function sendMessage(message: string, senderAddress: Address, recipientAddress: string, amount: number, config: any) {
  try {
    // Create metadata with message
    const metadata = {
      1337: { 
        msg: message,
        msg_id: Date.now().toString()
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
    logger.debug("Raw transaction built");

    // Sign transaction
    const signingKeyFile = path.join(config.credentialsDir, 'alice/alice-funds.sk');
    const signedTx = await builder.sign(signingKeyFile);
    logger.debug("Transaction signed");

    // Submit transaction to Hydra head
    await builder.submit(signedTx);
    logger.info("Message sent successfully!");
  } catch (error) {
    logger.error("Error sending message:", error);
  }
}

async function main() {
  try {
    logger.info("Starting Hydra message sender...");
    
    const config = getConfig();
    const senderAddress = Address.fromBech32("addr_test1vql8mpv20pdcr0pzqwyl23xsdejz5p9umc9rtk0xcha97vsuynzsz");
    const recipientAddress = "addr_test1vql8mpv20pdcr0pzqwyl23xsdejz5p9umc9rtk0xcha97vsuynzsz";
    const amount = 1000000; // 1 ADA in lovelace

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log("\nWelcome to Hydra Message Sender!");
    console.log("Type your message and press Enter to send.");
    console.log("Type 'exit' to quit the program.\n");

    while (true) {
      const message = await promptForMessage(rl);
      
      if (message.toLowerCase() === 'exit') {
        console.log("\nGoodbye!");
        break;
      }

      if (!message.trim()) {
        console.log("Message cannot be empty. Please try again.");
        continue;
      }

      await sendMessage(message, senderAddress, recipientAddress, amount, config);
    }

    rl.close();
    logger.close();
  } catch (error) {
    logger.error("Error in main:", error);
    logger.close();
  }
}

main();