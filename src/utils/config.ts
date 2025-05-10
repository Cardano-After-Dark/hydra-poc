import * as dotenv from 'dotenv';
import * as path from 'path';
import logger from './debugLogger';

// Load environment variables
dotenv.config();

export interface Config {
  projectRoot: string;
  nodeDir: string;
  credentialsDir: string;
  persistenceDir: string;
  paramsDir: string;
  txsDir: string;
  cardanoNodeSocketPath: string;
  testnetMagic: string;
  aliceApiPort: string;
  bobApiPort: string;
  alicePort: string;
  bobPort: string;
}

export function getConfig(): Config {
  // Replace console.log with debug-level log
  logger.debug(`Loading config with PROJECT_ROOT: ${process.env.PROJECT_ROOT}`);

  return {
    projectRoot: process.env.PROJECT_ROOT || '',
    nodeDir: process.env.NODE_DIR || '',
    credentialsDir: process.env.CREDENTIALS_DIR || '',
    persistenceDir: process.env.PERSISTENCE_DIR || '',
    paramsDir: process.env.PARAMS_DIR || '',
    txsDir: process.env.TXS_DIR || '',
    cardanoNodeSocketPath: process.env.CARDANO_NODE_SOCKET_PATH || '',
    testnetMagic: process.env.TESTNET_MAGIC || '',
    aliceApiPort: process.env.ALICE_API_PORT || '4001',
    bobApiPort: process.env.BOB_API_PORT || '4002',
    alicePort: process.env.ALICE_PORT || '5001',
    bobPort: process.env.BOB_PORT || '5002'
  };
}

export function getCardanoCliPath(): string {
  return path.join(getConfig().nodeDir, 'bin/cardano-cli');
} 