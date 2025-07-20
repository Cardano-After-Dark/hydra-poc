/**
 * Enhanced Raw Message Receiver for Hydra Transaction Analysis
 * 
 * Comprehensive inspection of all Hydra transactions with detailed metadata decoding
 * Shows raw CBOR data, timing analysis, and complete message structure breakdown
 * Based on the message handling patterns from enhanced-crypto-demo.ts
 */

import { config } from 'dotenv';
import { logger, LogLevel } from '../tools/debug/logger.js';
import { HydraClientWrapper } from './hydra/hydra-client.js';
import { GameMessage, HydraTransactionMonitor } from './hydra/hydra-transaction-monitor.js';

// Load environment variables
config();

// Set detailed logging for comprehensive analysis
logger.setLevel(LogLevel.DEBUG);

interface RawMessageAnalysis {
  timestamp: string;
  messageNumber: number;
  transactionDetails: {
    txId: string;
    sender: string;
    size: number;
    confirmationTime?: number;
  };
  metadataAnalysis: {
    rawCBOR?: string;
    decodedJSON?: any;
    parsingMethod: string;
    parseSuccess: boolean;
    errorDetails?: string;
    heliosDecoded: boolean;
  };
  contentStructure: {
    hasContent: boolean;
    contentType: string;
    gameDataPresent: boolean;
    playerDataPresent: boolean;
    customFieldsCount: number;
  };
  timingAnalysis: {
    messageAge: number;
    processingTime: number;
    isRecent: boolean;
  };
  validationResults: {
    hasValidStructure: boolean;
    hasRequiredFields: boolean;
    isGameMessage: boolean;
    messageCategory: string;
  };
}

class EnhancedRawMessageReceiver {
  private monitor: HydraTransactionMonitor;
  private hydraClient: HydraClientWrapper;
  private messageCount = 0;
  private startTime: number;
  private processingStats = {
    totalMessages: 0,
    successfulParses: 0,
    failedParses: 0,
    gameMessages: 0,
    systemMessages: 0
  };

  constructor() {
    this.startTime = Date.now();

    // Initialize Hydra client for additional transaction details
    this.hydraClient = new HydraClientWrapper({
      hostname: process.env.HYDRA_HOSTNAME || '127.0.0.1',
      httpPort: parseInt(process.env.HYDRA_HTTP_PORT || '4001', 10),
      wsPort: parseInt(process.env.HYDRA_WS_PORT || '4001', 10),
      secure: process.env.HYDRA_SECURE === 'true',
      isForMainnet: process.env.HYDRA_IS_MAINNET === 'true'
    });

    // Configure monitor with clean output
    this.monitor = new HydraTransactionMonitor({
      hostname: process.env.HYDRA_HOSTNAME || '127.0.0.1',
      wsPort: parseInt(process.env.HYDRA_WS_PORT || '4001'),
      secure: process.env.HYDRA_SECURE === 'true',
      enableLogging: false,  // Disable verbose logging for clean analysis display
      messageQueueSize: 1000, // Large queue to capture all messages
      reconnectInterval: 5000
    });

    this.setupComprehensiveHandlers();
  }

  private setupComprehensiveHandlers(): void {
    // Handle ALL message types with detailed analysis
    this.monitor.registerMessageHandler('custom', (message: GameMessage) => {
      this.analyzeRawMessage(message, 'custom');
    });

    this.monitor.registerMessageHandler('game', (message: GameMessage) => {
      this.analyzeRawMessage(message, 'game');
    });

    this.monitor.registerMessageHandler('system', (message: GameMessage) => {
      this.analyzeRawMessage(message, 'system');
    });

    // Connection events with detailed information
    this.monitor.on('connected', () => {
      console.log('🔗 CONNECTED to Hydra Head');
      console.log(`📡 Monitoring started at: ${new Date().toLocaleString()}`);
      console.log(`🌐 Network: ${process.env.HYDRA_IS_MAINNET === 'true' ? 'MAINNET' : 'TESTNET'}`);
    });

    this.monitor.on('disconnected', () => {
      console.log('❌ DISCONNECTED from Hydra Head');
      this.showProcessingStats();
    });

    this.monitor.on('error', (error) => {
      console.log('⚠️  CONNECTION ERROR:', error.message);
      console.log('🔍 Error Details:', error);
    });

    // Enhanced transaction events
    this.monitor.on('transaction-seen', (txData) => {
      console.log(`\n🔍 RAW TRANSACTION DETECTED:`);
      console.log(`   TX ID: ${this.extractTransactionId(txData)}`);
      console.log(`   Timestamp: ${new Date().toLocaleString()}`);
    });

    this.monitor.on('transaction-confirmed', (txData) => {
      console.log(`\n✅ TRANSACTION CONFIRMED:`);
      console.log(`   TX ID: ${this.extractTransactionId(txData)}`);
      console.log(`   Confirmation Time: ${new Date().toLocaleString()}`);
    });
  }

  private analyzeRawMessage(message: GameMessage, category: string): void {
    const processingStartTime = Date.now();
    this.messageCount++;
    this.processingStats.totalMessages++;

    try {
      // Comprehensive message analysis - similar to enhanced-crypto-demo.ts approach
      const analysis = this.performDetailedAnalysis(message, category, processingStartTime);

      // Update statistics
      if (analysis.metadataAnalysis.parseSuccess) {
        this.processingStats.successfulParses++;
      } else {
        this.processingStats.failedParses++;
      }

      if (analysis.validationResults.isGameMessage) {
        this.processingStats.gameMessages++;
      } else {
        this.processingStats.systemMessages++;
      }

      // Display comprehensive analysis
      this.displayRawMessageAnalysis(analysis, message);

    } catch (error) {
      console.log(`\n❌ CRITICAL ERROR processing message #${this.messageCount}:`);
      console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log(`   Category: ${category}`);
      console.log(`   Raw Message:`, message);
      this.processingStats.failedParses++;
    }
  }

  private performDetailedAnalysis(message: GameMessage, category: string, processingStartTime: number): RawMessageAnalysis {
    // Timing analysis - similar to enhanced-crypto-demo.ts timing checks
    const currentTime = Date.now();
    const messageAge = currentTime - this.startTime;
    const processingTime = currentTime - processingStartTime;
    const isRecent = messageAge < 300000; // 5 minutes buffer like enhanced-crypto-demo

    // Metadata parsing analysis
    let metadataAnalysis = {
      rawCBOR: undefined as string | undefined,
      decodedJSON: undefined as any,
      parsingMethod: 'none',
      parseSuccess: false,
      errorDetails: undefined as string | undefined,
      heliosDecoded: false
    };

    // Try multiple parsing approaches - comprehensive like enhanced-crypto-demo
    try {
      if (message.metadata && message.metadata.content) {
        metadataAnalysis.decodedJSON = message.metadata.content;
        metadataAnalysis.parsingMethod = 'pre-parsed';
        metadataAnalysis.parseSuccess = true;
        // Check if this was decoded by Helios (look for the list format we saw in logs)
        if (message.metadata.rawMetadata && message.metadata.rawMetadata[1337] &&
          message.metadata.rawMetadata[1337].list && Array.isArray(message.metadata.rawMetadata[1337].list)) {
          metadataAnalysis.heliosDecoded = true;
        }
      } else if (message.metadata && message.metadata.rawMetadata) {
        metadataAnalysis.decodedJSON = message.metadata.rawMetadata;
        metadataAnalysis.parsingMethod = 'raw-metadata';
        metadataAnalysis.parseSuccess = true;
        // Check if this was decoded by Helios
        if (message.metadata.rawMetadata[1337] &&
          message.metadata.rawMetadata[1337].list && Array.isArray(message.metadata.rawMetadata[1337].list)) {
          metadataAnalysis.heliosDecoded = true;
        }
      } else if (message.metadata) {
        metadataAnalysis.decodedJSON = message.metadata;
        metadataAnalysis.parsingMethod = 'metadata-direct';
        metadataAnalysis.parseSuccess = true;
      } else {
        // Fallback to the message itself
        metadataAnalysis.decodedJSON = message;
        metadataAnalysis.parsingMethod = 'message-fallback';
        metadataAnalysis.parseSuccess = true;
      }

    } catch (parseError) {
      metadataAnalysis.parseSuccess = false;
      metadataAnalysis.errorDetails = parseError instanceof Error ? parseError.message : 'Unknown parse error';
      metadataAnalysis.decodedJSON = message; // Fallback to raw message
      metadataAnalysis.parsingMethod = 'fallback';
    }

    // Content structure analysis
    const content = metadataAnalysis.decodedJSON || {};
    const contentStructure = {
      hasContent: !!(content.content || content.message),
      contentType: typeof content,
      gameDataPresent: !!(content.gameData),
      playerDataPresent: !!(content.player),
      customFieldsCount: Object.keys(content).length
    };

    // Validation analysis - similar to enhanced-crypto-demo validation logic
    const validationResults = {
      hasValidStructure: !!(content && typeof content === 'object'),
      hasRequiredFields: !!(content.timestamp || content.messageType || content.player),
      isGameMessage: !!(content.gameData || content.messageType === 'game'),
      messageCategory: this.categorizeMessage(content, category)
    };

    return {
      timestamp: new Date().toLocaleString(),
      messageNumber: this.messageCount,
      transactionDetails: {
        txId: this.extractTransactionId(message) || message.transactionId || message.id || 'unknown',
        sender: message.sender || content.player?.address || content.player?.name || 'unknown',
        size: JSON.stringify(message).length,
        confirmationTime: undefined
      },
      metadataAnalysis,
      contentStructure,
      timingAnalysis: {
        messageAge,
        processingTime,
        isRecent
      },
      validationResults
    };
  }

  private categorizeMessage(content: any, originalCategory: string): string {
    if (content.gameData) {
      if (content.gameData.systemType === 'crypto') {
        return `crypto-${content.gameData.cryptoOperation || 'unknown'}`;
      }
      return 'game-data';
    }

    if (content.messageType) {
      return content.messageType;
    }

    if (content.player && content.content) {
      return 'player-message';
    }

    return originalCategory || 'unknown';
  }

  /**
   * Extract transaction ID from various possible transaction data formats
   */
  private extractTransactionId(txData: any): string {
    // Try multiple possible property names for transaction ID
    if (txData.id) return txData.id;
    if (txData.txId) return txData.txId;
    if (txData.transactionId) return txData.transactionId;
    if (txData.hash) return txData.hash;
    if (txData.txHash) return txData.txHash;
    if (txData.transaction?.id) return txData.transaction.id;
    if (txData.transaction?.hash) return txData.transaction.hash;

    // If it's a string, it might be the ID itself
    if (typeof txData === 'string') return txData;

    // Last resort: try to find any hex-like string in the object
    const stringified = JSON.stringify(txData);
    const hexMatch = stringified.match(/[a-f0-9]{64}/i);
    if (hexMatch) return hexMatch[0];

    return 'unknown';
  }

  private displayRawMessageAnalysis(analysis: RawMessageAnalysis, rawMessage: GameMessage): void {
    // Clear screen and show header for first message
    if (this.messageCount === 1) {
      console.clear();
      this.showEnhancedHeader();
    }

    // console.log('\n' + '█'.repeat(100));
    // console.log(`🔍 RAW MESSAGE ANALYSIS #${this.messageCount} - ${analysis.timestamp}`);
    // console.log('█'.repeat(100));

    // if (analysis.transactionDetails.confirmationTime) {
    //   console.log(`✅ Confirmed: ${new Date(analysis.transactionDetails.confirmationTime).toLocaleString()}`);
    // }

    // // Timing Analysis Section
    // console.log(`\n⏰ TIMING ANALYSIS:`);
    // console.log('─'.repeat(50));
    // console.log(`🕐 Message Age: ${(analysis.timingAnalysis.messageAge / 1000).toFixed(2)}s`);
    // console.log(`⚡ Processing Time: ${analysis.timingAnalysis.processingTime}ms`);
    // console.log(`📅 Is Recent: ${analysis.timingAnalysis.isRecent ? '✅ YES' : '❌ NO'}`);

    // Metadata Analysis Section
    console.log(`\n🔬 METADATA ANALYSIS:`);
    console.log('─'.repeat(50));
    console.log(`🎯 Parsing Success: ${analysis.metadataAnalysis.parseSuccess ? '✅ SUCCESS' : '❌ FAILED'}`);
    // console.log(`🔧 Parsing Method: ${analysis.metadataAnalysis.parsingMethod.toUpperCase()}`);
    // console.log(`🚀 Helios Decoded: ${analysis.metadataAnalysis.heliosDecoded ? '✅ YES' : '❌ NO'}`);

    if (analysis.metadataAnalysis.errorDetails) {
      console.log(`❌ Parse Error: ${analysis.metadataAnalysis.errorDetails}`);
    }

    if (analysis.metadataAnalysis.rawCBOR) {
      console.log(`📦 Raw CBOR: ${analysis.metadataAnalysis.rawCBOR.substring(0, 60)}...`);
    }

    // Content Structure Analysis
    console.log(`\n🏗️  CONTENT STRUCTURE:`);
    console.log('─'.repeat(50));
    console.log(`📝 Has Content: ${analysis.contentStructure.hasContent ? '✅ YES' : '❌ NO'}`);
    console.log(`🎮 Game Data: ${analysis.contentStructure.gameDataPresent ? '✅ PRESENT' : '❌ MISSING'}`);
    console.log(`👤 Player Data: ${analysis.contentStructure.playerDataPresent ? '✅ PRESENT' : '❌ MISSING'}`);
    console.log(`🔢 Custom Fields: ${analysis.contentStructure.customFieldsCount}`);
    console.log(`📋 Content Type: ${analysis.contentStructure.contentType.toUpperCase()}`);

    // Validation Results
    console.log(`\n✅ VALIDATION RESULTS:`);
    console.log('─'.repeat(50));
    console.log(`🏗️  Valid Structure: ${analysis.validationResults.hasValidStructure ? '✅ YES' : '❌ NO'}`);
    console.log(`📋 Required Fields: ${analysis.validationResults.hasRequiredFields ? '✅ PRESENT' : '❌ MISSING'}`);
    console.log(`🎮 Is Game Message: ${analysis.validationResults.isGameMessage ? '✅ YES' : '❌ NO'}`);

    // Decoded JSON Section (Full Metadata)
    console.log(`\n📄 DECODED METADATA JSON:`);
    console.log('─'.repeat(50));
    if (analysis.metadataAnalysis.decodedJSON) {
      console.log(JSON.stringify(analysis.metadataAnalysis.decodedJSON, null, 2));
    } else {
      console.log('❌ No decoded metadata available');
    }

    // Raw Message Object (for complete debugging)
    // console.log(`\n🔍 RAW MESSAGE OBJECT:`);
    // console.log('─'.repeat(50));
    // console.log(JSON.stringify(rawMessage, null, 2));

    // Analysis Summary
    // console.log(`\n📊 ANALYSIS SUMMARY:`);
    // console.log('─'.repeat(50));
    // console.log(`🎯 Message Type: ${analysis.validationResults.messageCategory}`);
    // console.log(`✅ Parse Status: ${analysis.metadataAnalysis.parseSuccess ? 'SUCCESS' : 'FAILED'}`);
    // console.log(`🎮 Game Related: ${analysis.validationResults.isGameMessage ? 'YES' : 'NO'}`);
    // console.log(`⏰ Processing: ${analysis.timingAnalysis.processingTime}ms`);

    // Transaction Details Section
    console.log(`\n📡 TRANSACTION DETAILS:`);
    console.log('─'.repeat(50));
    console.log(`🆔 TX ID: ${analysis.transactionDetails.txId}`);
    console.log(`👤 Sender: ${analysis.transactionDetails.sender.substring(0, 30)}...`);
    console.log(`📏 Message Size: ${analysis.transactionDetails.size} bytes`);
    console.log(`📊 Category: ${analysis.validationResults.messageCategory.toUpperCase()}`);

    console.log('\n' + '─'.repeat(50));
    // console.log(`✅ Message #${this.messageCount} analysis completed`);

    // Show running statistics every 5 messages
    if (this.messageCount % 5 === 0) {
      this.showProcessingStats();
    }
  }

  private showEnhancedHeader(): void {
    console.log('\n🔬 ENHANCED RAW MESSAGE ANALYZER');
    console.log('█'.repeat(100));
    console.log('📡 Comprehensive Hydra Transaction & Metadata Analysis');
    console.log('🔍 Raw CBOR decoding • Timing analysis • Structure validation');
    console.log('🎯 Based on enhanced-crypto-demo.ts message handling patterns');
    console.log('█'.repeat(100));
    console.log(`🌐 Network: ${process.env.HYDRA_IS_MAINNET === 'true' ? 'MAINNET' : 'TESTNET'}`);
    console.log(`📍 Hydra Node: ${process.env.HYDRA_HOSTNAME || '127.0.0.1'}:${process.env.HYDRA_WS_PORT || '4001'}`);
    console.log(`⏰ Session Started: ${new Date(this.startTime).toLocaleString()}`);
    console.log('█'.repeat(100));
  }

  private showProcessingStats(): void {

    return;
    console.log('\n📊 PROCESSING STATISTICS:');
    console.log('═'.repeat(60));
    console.log(`📨 Total Messages: ${this.processingStats.totalMessages}`);
    console.log(`✅ Successful Parses: ${this.processingStats.successfulParses}`);
    console.log(`❌ Failed Parses: ${this.processingStats.failedParses}`);
    console.log(`🎮 Game Messages: ${this.processingStats.gameMessages}`);
    console.log(`⚙️  System Messages: ${this.processingStats.systemMessages}`);

    const successRate = this.processingStats.totalMessages > 0
      ? ((this.processingStats.successfulParses / this.processingStats.totalMessages) * 100).toFixed(1)
      : '0.0';
    console.log(`📈 Parse Success Rate: ${successRate}%`);

    const uptime = ((Date.now() - this.startTime) / 1000 / 60).toFixed(1);
    console.log(`⏱️  Session Uptime: ${uptime} minutes`);
    console.log('═'.repeat(60));
  }

  public async start(): Promise<void> {
    try {
      console.log('🚀 Starting Enhanced Raw Message Receiver...');
      console.log('🔗 Testing Hydra connectivity...');

      // Test connectivity first
      const connectivity = await this.hydraClient.testConnectivity();
      if (!connectivity.success) {
        throw new Error(`Hydra connectivity failed: ${connectivity.error}`);
      }
      console.log('✅ Hydra connection verified');

      console.log('📡 Starting transaction monitoring...');
      await this.monitor.startMonitoring();

      this.showEnhancedHeader();
      console.log('\n💚 ENHANCED RECEIVER ACTIVE - Analyzing all raw messages...');
      console.log('🎯 Comprehensive metadata decoding and structure analysis');
      console.log('📨 Send transactions from other terminals to see detailed analysis');
      console.log('🛑 Press Ctrl+C to stop and see final statistics\n');

    } catch (error) {
      console.error('❌ Failed to start enhanced message receiver:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    console.log('\n🛑 Stopping enhanced message receiver...');
    await this.monitor.stopMonitoring();

    // Show final statistics
    console.log('\n📊 FINAL SESSION STATISTICS:');
    this.showProcessingStats();

    console.log('\n👋 Enhanced message receiver stopped');
  }
}

// Handle graceful shutdown with statistics
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down enhanced receiver...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down enhanced receiver...');
  process.exit(0);
});

// Run the enhanced raw message receiver
async function runEnhancedReceiver(): Promise<void> {
  const receiver = new EnhancedRawMessageReceiver();
  await receiver.start();
}

// Start if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEnhancedReceiver().catch(console.error);
}

export { EnhancedRawMessageReceiver };
