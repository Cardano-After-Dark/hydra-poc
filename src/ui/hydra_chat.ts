import * as readline from 'readline';
import { spawn } from 'child_process';
import * as path from 'path';

async function promptForTuiSelection(): Promise<'sender' | 'receiver'> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('Welcome to Hydra Chat');
    console.log('=====================');
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
    
    // Determine which script to run
    const scriptName = selection === 'sender' ? 'tui.ts' : 'receiver_tui.ts';
    const scriptPath = path.join(__dirname, scriptName);
    
    console.log(`\nStarting ${selection} TUI...`);
    
    // Run the selected TUI using ts-node
    const tui = spawn('npx', ['ts-node', scriptPath], {
      stdio: 'inherit',
      shell: true
    });
    
    tui.on('error', (err) => {
      console.error('Failed to start TUI:', err);
      process.exit(1);
    });
    
    tui.on('close', (code) => {
      console.log(`TUI exited with code ${code}`);
      process.exit(code || 0);
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Use ES module approach to check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 