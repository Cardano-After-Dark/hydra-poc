import { Address } from "@hyperionbt/helios";
import { createTransactionFromUtxo } from "./core/builders/transactionBuilder";
import { getConfig } from "./utils/config";
import { Logger } from "./utils/logger";
import * as path from 'path';

const logger = Logger.getInstance();

async function main() {
  try {
    logger.info("Starting Hydra transaction process...");
    
    const config = getConfig();
    const senderAddress = Address.fromBech32("addr_test1vql8mpv20pdcr0pzqwyl23xsdejz5p9umc9rtk0xcha97vsuynzsz");
    const recipientAddress = "addr_test1vql8mpv20pdcr0pzqwyl23xsdejz5p9umc9rtk0xcha97vsuynzsz";
    const amount = 1000000; // 1 ADA in lovelace

    // Create metadata
    const metadata = {
      674: { // Using a random numeric key
        msg: "Hello from TypeScript!"
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
    logger.info("Raw transaction built:", rawTx);

    // Sign transaction
    const signingKeyFile = path.join(config.credentialsDir, 'alice/alice-funds.sk');
    const signedTx = await builder.sign(signingKeyFile);
    logger.info("Transaction signed:", signedTx);

    // Submit transaction to Hydra head
    await builder.submit(signedTx);
    logger.info("Transaction submitted successfully!");

  } catch (error) {
    logger.error("Error in main:", error);
    process.exit(1);
  }
}

main();