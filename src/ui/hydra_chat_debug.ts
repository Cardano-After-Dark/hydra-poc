import * as readline from 'readline';
import * as path from 'path';
import { getConfig } from '../utils/config';

// Import both TUI modules directly
import * as senderTui from './tui';
import * as receiverTui from './receiver_tui';

async function promptForTuiSelection(): Promise<'sender' | 'receiver'> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Display current configuration
    const config = getConfig();
    console.log('\nCurrent Hydra Configuration:');
    console.log(`- Alice API Port: ${config.aliceApiPort}`);
    console.log(`- Bob API Port: ${config.bobApiPort}`);
    console.log(`- Alice Port: ${config.alicePort}`);
    console.log(`- Bob Port: ${config.bobPort}`);
    console.log(`- Credentials Directory: ${config.credentialsDir}`);
    console.log('\n');
    
    console.log('Welcome to Hydra Chat (Debug Mode)');
    console.log('================================');
    console.log('1. Start Sender TUI (for sending messages)');
    console.log('2. Start Receiver TUI (for receiving messages)');
    
    rl.question('\nSelect an option (1 or 2): ', (answer) => {
      rl.close();
      if (answer === '2') {
        resolve('receiver');
      } else {
        // Default to sender for any invalid input
        resolve('sender');
      }
    });
  });
}

export async function main() {
  try {
    // Get the user's choice
    const selection = await promptForTuiSelection();
    
    console.log(`\nStarting ${selection} TUI in debug mode...`);
    
    // Instead of spawning a new process, directly invoke the module
    if (selection === 'sender') {
      await senderTui.main().catch((error: Error) => {
        console.error('Fatal error in sender TUI:', error);
        process.exit(1);
      });
    } else {
      await receiverTui.main().catch((error: Error) => {
        console.error('Fatal error in receiver TUI:', error);
        process.exit(1);
      });
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Use ES module approach to check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 