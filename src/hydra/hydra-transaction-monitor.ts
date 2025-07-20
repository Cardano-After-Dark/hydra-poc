/**
 * Hydra Transaction Monitor for In-Game Communication
 * 
 * This module monitors the Hydra Head via WebSocket for new transactions
 * and extracts metadata for real-time in-game communication.
 * 
 * Features:
 * 1. Real-time WebSocket monitoring of Hydra Head
 * 2. Transaction parsing and metadata extraction
 * 3. Message filtering and routing
 * 4. Event-driven communication system
 * 5. Message queue for reliable delivery
 */

import { hexToBytes } from '@helios-lang/codec-utils';
import { decodeTx } from '@helios-lang/ledger';
import { config } from 'dotenv';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from '../../tools/debug/logger.js';

// Load environment variables
config();

export interface HydraTransactionEvent {
  type: 'NewTx' | 'TxValid' | 'TxInvalid' | 'SnapshotConfirmed';
  timestamp: number;
  transaction?: any;
  snapshot?: any;
  tag?: string;
}

export interface GameMessage {
  id: string;
  timestamp: number;
  sender: string;
  messageType: 'chat' | 'action' | 'event' | 'data' | 'custom';
  channel?: string;
  metadata: {
    label: number;
    content: any;
    rawMetadata: { [key: number]: any };
  };
  transactionId: string;
  processed: boolean;
}

export interface MonitorConfig {
  hostname: string;
  wsPort: number;
  secure: boolean;
  reconnectInterval: number;
  messageQueueSize: number;
  enableLogging: boolean;
}

export class HydraTransactionMonitor extends EventEmitter {
  private config: MonitorConfig;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private messageQueue: GameMessage[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, (message: GameMessage) => void> = new Map();

  constructor(config: MonitorConfig) {
    super();
    this.config = config;

    if (this.config.enableLogging) {
      logger.info('Hydra Transaction Monitor initialized', {
        hostname: config.hostname,
        wsPort: config.wsPort,
        secure: config.secure
      });
    }
  }

  /**
   * Start monitoring Hydra Head transactions
   */
  async startMonitoring(): Promise<void> {
    if (this.config.enableLogging) {
      console.log('\n🔍 Starting Hydra Transaction Monitor');
      console.log('═══════════════════════════════════════');
      console.log(`WebSocket URL: ${this.getWebSocketUrl()}`);
      console.log(`Message Queue Size: ${this.config.messageQueueSize}`);
      console.log(`Reconnect Interval: ${this.config.reconnectInterval}ms`);
    }

    await this.connectWebSocket();

    // Set up event handlers
    this.setupEventHandlers();

    if (this.config.enableLogging) {
      console.log('✅ Transaction monitoring started');
      console.log('🎮 Ready for in-game communication!');
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.config.enableLogging) {
      console.log('\n🛑 Stopping Hydra Transaction Monitor');
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    if (this.config.enableLogging) {
      console.log('✅ Transaction monitoring stopped');
    }
  }

  /**
   * Get WebSocket URL
   */
  private getWebSocketUrl(): string {
    const protocol = this.config.secure ? 'wss' : 'ws';
    return `${protocol}://${this.config.hostname}:${this.config.wsPort}`;
  }

  /**
   * Connect to Hydra WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.getWebSocketUrl();
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          this.isConnected = true;

          if (this.config.enableLogging) {
            console.log('🔗 WebSocket connected to Hydra Head');
            logger.info('WebSocket connected to Hydra Head', { url: wsUrl });
          }

          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.RawData) => {
          this.handleWebSocketMessage(data);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.isConnected = false;
          if (this.config.enableLogging) {
            console.log(`🔌 WebSocket disconnected: ${code} - ${reason.toString()}`);
            logger.warn('WebSocket disconnected', { code, reason: reason.toString() });
          }

          this.emit('disconnected', { code, reason: reason.toString() });
          this.scheduleReconnect();
        });

        this.ws.on('error', (error: Error) => {
          if (this.config.enableLogging) {
            console.error('❌ WebSocket error:', error.message);
            logger.error('WebSocket error', { error: error.message });
          }

          this.emit('error', error);

          if (!this.isConnected) {
            reject(error);
          }
        });

        // Connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(data: WebSocket.RawData): void {
    try {
      const message = JSON.parse(data.toString());

      if (this.config.enableLogging) {
        logger.debug('Received WebSocket message', {
          type: message.tag || message.type || 'unknown',
          timestamp: Date.now()
        });
      }

      // Parse as Hydra transaction event
      const event: HydraTransactionEvent = {
        type: message.tag || message.type || 'unknown',
        timestamp: Date.now(),
        transaction: message.transaction,
        snapshot: message.snapshot,
        tag: message.tag
      };

      // Process transaction events
      if (event.type === 'NewTx' && event.transaction) {
        this.processNewTransaction(event.transaction, event.timestamp);
      } else if (event.type === 'TxValid' && event.transaction) {
        this.processValidTransaction(event.transaction, event.timestamp);
      } else if (event.type === 'SnapshotConfirmed' && event.snapshot) {
        this.processSnapshotConfirmed(event.snapshot, event.timestamp);
      }

      // Emit raw event
      this.emit('hydra-event', event);

    } catch (error) {
      if (this.config.enableLogging) {
        console.error('❌ Failed to parse WebSocket message:', error);
        logger.error('Failed to parse WebSocket message', {
          error: error instanceof Error ? error.message : 'Unknown error',
          rawData: data.toString().substring(0, 200)
        });
      }
    }
  }

  /**
   * Process new transaction
   */
  private processNewTransaction(transaction: any, timestamp: number): void {
    if (this.config.enableLogging) {
      console.log('\n📥 New Transaction Detected');
      console.log('═══════════════════════════');
    }

    const txId = this.extractTransactionId(transaction);
    if (this.config.enableLogging) {
      console.log(`Transaction ID: ${txId}`);
    }

    // Extract metadata
    const metadata = this.extractMetadata(transaction);

    if (metadata && Object.keys(metadata).length > 0) {
      if (this.config.enableLogging) {
        console.log('📋 Metadata found in transaction!');
        console.log(`Metadata keys: ${Object.keys(metadata).join(', ')}`);
      }

      // Convert to game message and add to queue, but DON'T emit yet
      // Only emit after validation and snapshot confirmation
      const gameMessage = this.createGameMessage(transaction, metadata, timestamp);

      if (gameMessage) {
        // Mark as unprocessed (pending validation)
        gameMessage.processed = false;
        this.addMessageToQueue(gameMessage);

        if (this.config.enableLogging) {
          console.log(`🎮 Game message queued (pending validation): ${gameMessage.messageType} from ${gameMessage.sender}`);
        }

        // ❌ REMOVED: Do NOT emit game-message for unvalidated transactions
        // this.emit('game-message', gameMessage);
      }
    } else {
      if (this.config.enableLogging) {
        console.log('📋 No metadata found in transaction');
      }
    }

    // Emit transaction event (for monitoring purposes only)
    this.emit('new-transaction', {
      transactionId: txId,
      transaction,
      metadata,
      timestamp
    });
  }

  /**
   * Process valid transaction
   */
  private processValidTransaction(transaction: any, timestamp: number): void {
    const txId = this.extractTransactionId(transaction);
    if (this.config.enableLogging) {
      console.log(`✅ Transaction validated: ${txId}`);
    }

    // Find existing queued message for this transaction
    let existingMessage = this.messageQueue.find(msg => msg.transactionId === txId);

    if (!existingMessage) {
      // Extract metadata from this transaction (in case it wasn't caught in NewTx)
      const metadata = this.extractMetadata(transaction);

      if (metadata && Object.keys(metadata).length > 0) {
        if (this.config.enableLogging) {
          console.log('📋 Metadata found in validated transaction!');
          console.log(`Metadata keys: ${Object.keys(metadata).join(', ')}`);
        }

        // Convert to game message
        const gameMessage = this.createGameMessage(transaction, metadata, timestamp);

        if (gameMessage) {
          this.addMessageToQueue(gameMessage);
          existingMessage = gameMessage;
          if (this.config.enableLogging) {
            console.log(`🎮 Game message created from validated transaction: ${gameMessage.messageType} from ${gameMessage.sender}`);
          }
        }
      }
    }

    // Update message status to validated (but not yet final)
    if (existingMessage) {
      existingMessage.processed = false; // Still waiting for snapshot confirmation
      if (this.config.enableLogging) {
        console.log(`🎮 Game message validated (awaiting snapshot): ${existingMessage.id}`);
      }

      // ❌ REMOVED: Do NOT emit game message yet - wait for snapshot confirmation
      // Only emit after SnapshotConfirmed to ensure finality
    }

    this.emit('transaction-confirmed', {
      transactionId: txId,
      transaction,
      timestamp
    });
  }

  /**
   * Process snapshot confirmed
   */
  private processSnapshotConfirmed(snapshot: any, timestamp: number): void {
    if (this.config.enableLogging) {
      console.log('📸 Snapshot confirmed - transactions finalized');
    }

    // Only now emit game messages for transactions that are in the confirmed snapshot
    if (snapshot && snapshot.utxo) {
      const confirmedUtxoKeys = Object.keys(snapshot.utxo);

      // Find messages that correspond to transactions in this snapshot
      this.messageQueue.forEach(message => {
        if (!message.processed) {
          // Check if this transaction is in the confirmed snapshot using EXACT matching
          const txFoundInSnapshot = confirmedUtxoKeys.some(key => {
            // Extract the transaction ID from the UTXO key (format: txId#outputIndex)
            const utxoTxId = key.split('#')[0];
            return utxoTxId === message.transactionId;
          });

          if (txFoundInSnapshot) {
            // Mark as processed (final confirmation)
            message.processed = true;

            if (this.config.enableLogging) {
              console.log(`🎮 Game message FINAL confirmation: ${message.id} (TX: ${message.transactionId})`);
            }

            // ✅ NOW it's safe to emit the game message - transaction is validated AND confirmed
            this.emit('game-message', message);
          } else {
            if (this.config.enableLogging) {
              console.log(`🔍 Transaction ${message.transactionId} not found in snapshot UTXOs`);
            }
          }
        }
      });
    }

    // Mark all remaining messages as processed (fallback)
    this.messageQueue.forEach(message => {
      if (!message.processed) {
        message.processed = true;
      }
    });

    this.emit('snapshot-confirmed', {
      snapshot,
      timestamp,
      messageCount: this.messageQueue.length
    });
  }

  /**
   * Extract transaction ID
   */
  private extractTransactionId(transaction: any): string {
    // Try different possible locations for transaction ID
    return transaction.id ||
      transaction.hash ||
      transaction.txId ||
      (transaction.body && transaction.body.id) ||
      `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract metadata from transaction using proper Helios transaction decoding
   */
  private extractMetadata(transaction: any): { [key: number]: any } | null {
    try {
      let metadata = null;

      // First try direct metadata access
      if (transaction.auxiliaryData && transaction.auxiliaryData.metadata) {
        metadata = transaction.auxiliaryData.metadata;
      } else if (transaction.metadata) {
        metadata = transaction.metadata;
      } else if (transaction.cborHex) {
        // Use proper Helios transaction decoding instead of manual CBOR parsing
        try {
          // Convert hex to bytes for Helios decodeTx
          const cborBytes = hexToBytes(transaction.cborHex);

          // Use Helios decodeTx to properly decode the transaction
          const decodedTx = decodeTx(cborBytes);

          // Extract metadata from the properly decoded transaction
          if (decodedTx.metadata) {
            metadata = this.extractMetadataFromHeliosTx(decodedTx);
          }
        } catch (heliosError) {
          // Helios decodeTx failed - return null instead of falling back to manual parsing
          return null;
        }
      } else if (transaction.body && transaction.body.auxiliaryDataHash) {
        // Metadata hash present but need to get actual metadata
        console.log('🔍 Metadata hash detected, but actual metadata not included');
        return null;
      }

      if (!metadata) {
        return null;
      }

      // Convert to number-keyed object if needed
      const processedMetadata: { [key: number]: any } = {};

      for (const [key, value] of Object.entries(metadata)) {
        const numKey = parseInt(key, 10);
        if (!isNaN(numKey)) {
          processedMetadata[numKey] = value;
        }
      }

      return Object.keys(processedMetadata).length > 0 ? processedMetadata : null;

    } catch (error) {
      console.error('❌ Failed to extract metadata:', error);
      return null;
    }
  }

  /**
 * Extract metadata from a properly decoded Helios transaction
 */
  private extractMetadataFromHeliosTx(decodedTx: any): { [key: number]: any } | null {
    try {
      if (!decodedTx.metadata) {
        return null;
      }

      // The Helios metadata should already be properly decoded
      // We need to convert it to the expected format
      const heliosMetadata = decodedTx.metadata;

      // Helios metadata structure logging removed for cleaner output

      // Convert Helios metadata format to our expected format
      const processedMetadata: { [key: number]: any } = {};

      // Helios metadata might be in a different format, so we need to handle it properly
      if (typeof heliosMetadata === 'object' && heliosMetadata !== null) {
        // Check if it has an 'attributes' property
        if (heliosMetadata.attributes && typeof heliosMetadata.attributes === 'object') {

          // Process the attributes object
          for (const [key, value] of Object.entries(heliosMetadata.attributes)) {
            const numKey = parseInt(key, 10);
            if (!isNaN(numKey)) {
              // Handle Helios list format
              if (value && typeof value === 'object' && 'list' in value && Array.isArray((value as any).list)) {
                // Helios returns metadata as a list of strings that need to be joined
                const jsonString = (value as any).list.join('');

                try {
                  const parsed = JSON.parse(jsonString);
                  processedMetadata[numKey] = parsed;
                } catch (parseError) {
                  // Fallback: store the raw list
                  processedMetadata[numKey] = value;
                }
              } else if (typeof value === 'string') {
                // Try to parse as JSON if it's a string
                try {
                  processedMetadata[numKey] = JSON.parse(value);
                } catch {
                  processedMetadata[numKey] = value;
                }
              } else {
                processedMetadata[numKey] = value;
              }
            }
          }
        } else {
          // Fallback: try direct iteration
          for (const [key, value] of Object.entries(heliosMetadata)) {
            const numKey = parseInt(key, 10);
            if (!isNaN(numKey)) {
              // Handle different value types that Helios might return
              if (typeof value === 'string') {
                // Try to parse as JSON if it's a string
                try {
                  processedMetadata[numKey] = JSON.parse(value);
                } catch {
                  processedMetadata[numKey] = value;
                }
              } else {
                processedMetadata[numKey] = value;
              }
            }
          }
        }
      }

      // Helios metadata processing completed silently

      return Object.keys(processedMetadata).length > 0 ? processedMetadata : null;

    } catch (error) {
      if (this.config.enableLogging) {
        console.error('❌ Failed to extract metadata from Helios transaction:', error);
      }
      return null;
    }
  }

  // Manual CBOR parsing methods removed - only Helios decodeTx is used

  /**
   * Create game message from transaction
   */
  private createGameMessage(
    transaction: any,
    metadata: { [key: number]: any },
    timestamp: number
  ): GameMessage | null {
    try {
      const txId = this.extractTransactionId(transaction);
      const messageId = `msg_${txId}_${timestamp}`;

      // Determine message type and content based on metadata labels
      let messageType: GameMessage['messageType'] = 'custom';
      let channel: string | undefined;
      let sender = 'unknown';
      let content: any = {};

      // Extract sender from transaction inputs if possible
      if (transaction.body && transaction.body.inputs && transaction.body.inputs[0]) {
        // This is a simplified sender extraction - in reality you'd need to map UTXOs to addresses
        sender = transaction.body.inputs[0].address || 'anonymous';
      }

      // Process metadata - focus on label 1337 for custom game data
      for (const [label, value] of Object.entries(metadata)) {
        const numLabel = parseInt(label, 10);

        if (numLabel === 1337) {
          // Custom game data - this is what we want!
          messageType = 'data'; // Default, but will be overridden

          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              content = parsed;

              // Extract game-specific fields
              if (parsed.messageType) messageType = parsed.messageType;
              if (parsed.channel) channel = parsed.channel;
              if (parsed.player && parsed.player.name) sender = parsed.player.name;

            } catch {
              content = { data: value };
            }
          } else if (typeof value === 'object') {
            content = value;

            // Extract game-specific fields from object
            if (value.messageType) messageType = value.messageType;
            if (value.channel) channel = value.channel;
            if (value.player && value.player.name) sender = value.player.name;
          } else {
            content = { data: value };
          }
        } else {
          // Other labels - handle them silently
          switch (numLabel) {
            case 674: // CIP-20 Text Message (if someone uses this)
              messageType = 'chat';
              if (typeof value === 'object' && value.msg) {
                content = { message: Array.isArray(value.msg) ? value.msg.join(' ') : value.msg };
              } else {
                content = { message: value };
              }
              break;

            case 721: // CIP-25 NFT Metadata (if someone uses this)
              messageType = 'event';
              content = { nft: value, eventType: 'nft_transfer' };
              break;

            default:
              // Unknown label - store as custom data silently
              content[`label_${numLabel}`] = value;
          }
        }
      }

      const gameMessage: GameMessage = {
        id: messageId,
        timestamp,
        sender,
        messageType,
        channel,
        metadata: {
          label: Object.keys(metadata)[0] ? parseInt(Object.keys(metadata)[0], 10) : 0,
          content,
          rawMetadata: metadata
        },
        transactionId: txId,
        processed: false
      };

      return gameMessage;

    } catch (error) {
      console.error('❌ Failed to create game message:', error);
      return null;
    }
  }

  /**
   * Add message to queue
   */
  private addMessageToQueue(message: GameMessage): void {
    // Add to queue
    this.messageQueue.push(message);

    // Maintain queue size limit
    while (this.messageQueue.length > this.config.messageQueueSize) {
      const removed = this.messageQueue.shift();
      if (removed && this.config.enableLogging) {
        logger.warn('Message queue full, removed oldest message', { removedId: removed.id });
      }
    }

    if (this.config.enableLogging) {
      logger.info('Game message added to queue', {
        messageId: message.id,
        messageType: message.messageType,
        sender: message.sender,
        queueSize: this.messageQueue.length
      });
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    console.log(`🔄 Scheduling reconnection in ${this.config.reconnectInterval}ms`);

    this.reconnectTimer = setTimeout(async () => {
      console.log('🔄 Attempting to reconnect...');
      try {
        await this.connectWebSocket();
      } catch (error) {
        console.error('❌ Reconnection failed:', error);
      }
    }, this.config.reconnectInterval);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('game-message', (message: GameMessage) => {
      // Route message to appropriate handler
      const handlerKey = `${message.messageType}:${message.channel || 'default'}`;
      const handler = this.messageHandlers.get(handlerKey) || this.messageHandlers.get(message.messageType);

      if (handler) {
        try {
          handler(message);
        } catch (error) {
          console.error('❌ Message handler error:', error);
        }
      }
    });
  }

  /**
   * Register message handler
   */
  registerMessageHandler(
    messageType: string,
    handler: (message: GameMessage) => void,
    channel?: string
  ): void {
    const key = channel ? `${messageType}:${channel}` : messageType;
    this.messageHandlers.set(key, handler);

    console.log(`📝 Registered handler for ${key}`);
  }

  /**
   * Get message queue
   */
  getMessageQueue(): GameMessage[] {
    return [...this.messageQueue];
  }

  /**
   * Get messages by type
   */
  getMessagesByType(messageType: string, channel?: string): GameMessage[] {
    return this.messageQueue.filter(msg => {
      const typeMatch = msg.messageType === messageType;
      const channelMatch = channel ? msg.channel === channel : true;
      return typeMatch && channelMatch;
    });
  }

  /**
   * Clear processed messages
   */
  clearProcessedMessages(): number {
    const initialLength = this.messageQueue.length;
    this.messageQueue = this.messageQueue.filter(msg => !msg.processed);
    const removedCount = initialLength - this.messageQueue.length;

    console.log(`🧹 Cleared ${removedCount} processed messages`);
    return removedCount;
  }

  /**
   * Get connection status
   */
  isMonitoringActive(): boolean {
    return this.isConnected && this.ws !== null;
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    connected: boolean;
    messageCount: number;
    processedCount: number;
    unprocessedCount: number;
    messageTypes: { [key: string]: number };
  } {
    const messageTypes: { [key: string]: number } = {};
    let processedCount = 0;

    this.messageQueue.forEach(msg => {
      messageTypes[msg.messageType] = (messageTypes[msg.messageType] || 0) + 1;
      if (msg.processed) processedCount++;
    });

    return {
      connected: this.isConnected,
      messageCount: this.messageQueue.length,
      processedCount,
      unprocessedCount: this.messageQueue.length - processedCount,
      messageTypes
    };
  }
}

export default HydraTransactionMonitor; 