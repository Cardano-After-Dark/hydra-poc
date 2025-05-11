import { spawn } from 'child_process';
import { createInterface } from 'readline';

class GuidedSetup {
  private rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  private steps = [
    {
      name: "Environment Setup",
      command: './scripts/utils/set-env-vars.sh',
      optional: false
    },
    {
      name: "Install Dependencies",
      command: './install.sh',
      optional: true
    },
    {
      name: "Setup Cardano Node",
      command: './setup-cardano-node.sh',
      optional: false
    },
    {
      name: "Setup Funding Wallet",
      command: './scripts/setup/funding/setup-funding-credentials.sh',
      optional: false
    },
    {
      name: "Setup Node Credentials",
      command: './scripts/setup/node/setup-node-credentials.sh',
      optional: false
    },
    {
      name: "Setup Hydra Keys",
      command: './scripts/setup/node/setup-hydra-keys.sh',
      optional: false
    },
    {
      name: "Start Hydra Nodes",
      command: './start-alice-node.sh',
      note: "This will start Alice's node. You'll need to open another terminal to start Bob's node with './start-bob-node.sh'",
      optional: false
    },
    {
      name: "Initialize Hydra Head",
      command: './scripts/transactions/commit-funds.sh',
      optional: false
    }
  ];

  async ask(question: string): Promise<string> {
    return new Promise(resolve => {
      this.rl.question(question, answer => resolve(answer));
    });
  }

  async runCommand(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`\nExecuting: ${command}\n`);
      
      const process = spawn(command, [], { 
        shell: true, 
        stdio: 'inherit'  // Show output in real-time
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log(`\n✅ Command completed successfully`);
          resolve(true);
        } else {
          console.log(`\n❌ Command failed with code ${code}`);
          resolve(false);
        }
      });
    });
  }

  async showMenu() {
    console.log("\n=== Hydra Node Setup Menu ===\n");
    
    for (let i = 0; i < this.steps.length; i++) {
      console.log(`${i+1}. ${this.steps[i].name} ${this.steps[i].optional ? '(optional)' : ''}`);
    }
    
    console.log("\nA. Run all steps");
    console.log("Q. Quit\n");
    
    const choice = await this.ask("Enter choice: ");
    
    if (choice.toLowerCase() === 'q') {
      return false;
    } else if (choice.toLowerCase() === 'a') {
      for (const step of this.steps) {
        console.log(`\n>>> ${step.name} <<<`);
        if (step.note) console.log(`Note: ${step.note}`);
        
        const proceed = await this.ask("Press Enter to continue or S to skip...");
        if (proceed.toLowerCase() !== 's') {
          const success = await this.runCommand(step.command);
          if (!success && !step.optional) {
            console.log("Required step failed. Stopping setup.");
            return false;
          }
        } else {
          console.log("Skipping step...");
        }
      }
    } else {
      const stepIndex = parseInt(choice) - 1;
      if (stepIndex >= 0 && stepIndex < this.steps.length) {
        const step = this.steps[stepIndex];
        console.log(`\n>>> ${step.name} <<<`);
        if (step.note) console.log(`Note: ${step.note}`);
        await this.runCommand(step.command);
      } else {
        console.log("Invalid choice. Please try again.");
      }
    }
    
    return true;
  }

  async start() {
    console.log("Welcome to the Hydra Node Guided Setup!");
    
    let running = true;
    while (running) {
      running = await this.showMenu();
    }
    
    console.log("\nThank you for using the Hydra Node Guided Setup!");
    this.rl.close();
  }
}

// Start the guided setup
new GuidedSetup().start(); 