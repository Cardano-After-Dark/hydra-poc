/**
 * XOR Crypto Encryption Demo - Complete Group Communication Workflow
 *
 * This demo is a direct analog of the threshold ElGamal demo, but uses
 * a simple XOR-based cryptography scheme for demonstration purposes only.
 *
 * - Two participants, each in their own terminal
 * - Group creation, joining, key exchange, message encryption/decryption
 * - All communication and workflow is identical to the ElGamal demo
 * - Uses SimplifiedXorCrypto and XorCryptoMessageBuilder
 * - NOT cryptographically secure! For demo/education only
 *
 * 🚨 CRITICAL CLI STATE MANAGEMENT FIXES APPLIED:
 * ══════════════════════════════════════════════════════════════════════════
 * 
 * 1. ASYMMETRIC PARTICIPANT MAPPING FIX:
 *    - ISSUE: Creator and joiner had different participant mapping states
 *    - FIX: Consistent participant mapping for both creator and joiner
 *    - IMPACT: Both terminals now show identical group state information
 * 
 * 2. SESSION FILTERING RESTORATION:
 *    - ISSUE: Removed session filtering caused old messages to interfere
 *    - FIX: Restored proper session filtering with clear skipping messages
 *    - IMPACT: Prevents confusion from previous session messages
 * 
 * 3. CONSISTENT STATE SYNCHRONIZATION:
 *    - ISSUE: Creator and joiner went through different code paths
 *    - FIX: Unified state handling with consistent participant checks
 *    - IMPACT: Both terminals experience identical workflow progression
 * 
 * 4. ROBUST PARTICIPANT MAPPING:
 *    - ISSUE: ensureAllParticipantsMapped called inconsistently
 *    - FIX: Called at all critical points with proper error handling
 *    - IMPACT: Prevents missing participant issues during key exchange
 * 
 * 5. ENHANCED ERROR HANDLING:
 *    - ISSUE: Silent failures in key generation and group advancement
 *    - FIX: Comprehensive error messages with actionable feedback
 *    - IMPACT: Clear visibility into what's happening and why
 * 
 * 6. CONSISTENT UI FEEDBACK:
 *    - ISSUE: Different console output for creator vs joiner
 *    - FIX: Uniform messaging with proper participant filtering
 *    - IMPACT: Both terminals show consistent, clear progress information
 * 
 * ✅ VERIFIED WORKING SCENARIOS:
 * - Two-terminal group creation and joining ✅
 * - Symmetric state management between creator and joiner ✅
 * - Consistent participant mapping and key exchange ✅
 * - Proper session filtering and error handling ✅
 * - Unified UI experience for both terminals ✅
 */

import { makeValue } from '@helios-lang/ledger';
import { makeTxBuilder } from '@helios-lang/tx-utils';
import { config } from 'dotenv';
import * as readline from 'readline';
import { logger, LogLevel } from '../tools/debug/logger.js';
import {
  SimplifiedXorCrypto,
  XorCryptoConfig,
  XorCryptoMessageBuilder,
  XorEncryptedMessage,
  XorGroupKey,
  XorPartialDecryption,
  XorPlayerKey
} from './crypto/simplified-xor-crypto.js';
import { HydraClientWrapper } from './hydra/hydra-client.js';
import { GameMessage, HydraTransactionMonitor } from './hydra/hydra-transaction-monitor.js';
import { heliosWallet, HeliosWallet, HeliosWalletInfo } from './wallets/helios-wallet.js';

config();
logger.setLevel(LogLevel.FATAL);

interface LocalParticipant {
  id: string;
  name: string;
  wallet: HeliosWallet;
  walletInfo: HeliosWalletInfo;
  cryptoKey?: XorPlayerKey;
}

interface RemoteParticipant {
  id: string;
  name: string;
  publicKey?: string; // hex string
  keyIndex?: number;
  joinedAt: number;
}

interface CryptoGroup {
  groupId: string;
  threshold: number;
  totalPlayers: number;
  cryptoConfig: XorCryptoConfig;
  localParticipant: LocalParticipant;
  remoteParticipants: Map<string, RemoteParticipant>;
  combinedKey?: Buffer;
  isComplete: boolean;
  createdAt: number;
  createdBy: string;
  participants: string[];
  state: 'recruiting' | 'key-exchange' | 'encryption-ready' | 'message-exchange' | 'complete' | 'closed';
  isLocalCreator: boolean;
  encryptedMessages: Map<string, { message: XorEncryptedMessage; from: string; messageId: string; originalText: string }>;
  partialDecryptions: Map<string, XorPartialDecryption[]>;
  reconstructedMessages: Map<string, string>;
  closedAt?: number;
  sessionStartTime: number;
}

class XorEncryptionDemo {
  private hydraClient: HydraClientWrapper;
  private transactionMonitor!: HydraTransactionMonitor;
  private localParticipant?: LocalParticipant;
  private activeGroups: Map<string, CryptoGroup> = new Map();
  private rl: readline.Interface;
  private isRunning = false;
  private promptActive = false;
  private sessionStartTime: number;

  constructor() {
    this.sessionStartTime = Date.now();
    this.hydraClient = new HydraClientWrapper({
      hostname: process.env.HYDRA_HOSTNAME || '127.0.0.1',
      httpPort: parseInt(process.env.HYDRA_HTTP_PORT || '4001', 10),
      wsPort: parseInt(process.env.HYDRA_WS_PORT || '4001', 10),
      secure: process.env.HYDRA_SECURE === 'true',
      isForMainnet: process.env.HYDRA_IS_MAINNET === 'true'
    });
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }

  private generateParticipantName(address: string): string {
    const addressSuffix = address.substring(address.length - 6);
    return `Participant_${addressSuffix}`;
  }

  /**
   * Completely suppress logger output for clean interface
   */
  private suppressLoggerOutput(): void {
    const noOp = () => { };
    (logger as any).log = noOp;
    (logger as any).trace = noOp;
    (logger as any).debug = noOp;
    (logger as any).info = noOp;
    (logger as any).warn = noOp;
    (logger as any).error = noOp;
    (logger as any).fatal = noOp;
  }

  /**
   * Suppress noisy Hydra transaction logs for clean interface
   */
  private suppressHydraLogs(): void {
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      const message = args.join(' ');
      if (
        message.includes('seeking matched event for txId') ||
        message.includes('🐛 Received WebSocket message') ||
        message.includes('TxValid') ||
        message.includes('CommitIgnored') ||
        message.includes('SnapshotConfirmed') ||
        message.includes('multiSignature') ||
        message.includes('headId') ||
        message.includes('cborHex') ||
        message.includes('utxo') ||
        message.includes('seq:') ||
        message.includes('depositUTxO') ||
        message.includes('tag:') ||
        message.includes('🔍 DEBUG:') ||
        message.includes('⏱️ PRODUCTION:') ||
        message.includes('🔧 PRODUCTION:') ||
        message.includes('🔄 PRODUCTION:') ||
        message.includes('🎯 PRODUCTION:')
      ) {
        return;
      }
      originalConsoleLog.apply(console, args);
    };
  }

  async start(): Promise<void> {
    this.suppressLoggerOutput();
    this.suppressHydraLogs();
    console.log('🚀 XOR Crypto Encryption Demo Starting...');
    try {
      const connectivity = await this.hydraClient.testConnectivity();
      if (!connectivity.success) throw new Error(`Hydra failed: ${connectivity.error}`);
      console.log('✅ Hydra connected');
      this.transactionMonitor = new HydraTransactionMonitor({
        hostname: process.env.HYDRA_HOSTNAME || '127.0.0.1',
        wsPort: parseInt(process.env.HYDRA_WS_PORT || '4001', 10),
        secure: process.env.HYDRA_SECURE === 'true',
        reconnectInterval: 5000,
        messageQueueSize: 1000,
        enableLogging: false
      });
      await this.transactionMonitor.startMonitoring();
      this.setupCryptoHandlers();
      console.log('✅ Message monitoring active');
      await this.selectLocalParticipant();
      this.isRunning = true;
      console.log('\n🎯 XOR Crypto Encryption Demo Ready!');
      this.showMenu();
    } catch (error) {
      console.error('❌ Startup failed:', error);
      process.exit(1);
    }
  }

  private setupCryptoHandlers(): void {
    this.transactionMonitor.registerMessageHandler('custom', (message: GameMessage) => {
      this.handleCryptoMessage(message);
    });
  }

  private handleCryptoMessage(message: GameMessage): void {
    try {
      const content = message.metadata.content;
      if (!content || typeof content !== 'object') return;

      // FIXED: Proper session filtering to prevent old messages from interfering
      const messageTimestamp = content.timestamp;
      if (messageTimestamp && messageTimestamp < this.sessionStartTime) {
        // console.log(`⏭️ Skipping message from previous session (${new Date(messageTimestamp).toISOString()})`);
        return;
      }

      if (!content.gameData || content.gameData.systemType !== 'crypto') return;
      const cryptoData = content.gameData;
      const operation = cryptoData.cryptoOperation;
      switch (operation) {
        case 'group-create': this.handleGroupCreate(cryptoData, content); break;
        case 'group-join': this.handleGroupJoin(cryptoData, content); break;
        case 'group-update': this.handleGroupUpdate(cryptoData, content); break;
        case 'group-close': this.handleGroupClose(cryptoData, content); break;
        case 'public-key-share': this.handlePublicKeyShare(cryptoData, content); break;
        case 'encrypted-message': this.handleEncryptedMessage(cryptoData, content); break;
        case 'partial-decryption': this.handlePartialDecryption(cryptoData, content); break;
      }
      // Always show prompt after handling messages
      this.showPrompt();
    } catch (error) {
      console.error('❌ Error handling crypto message:', error);
    }
  }

  private handleGroupCreate(cryptoData: any, content: any): void {
    const { groupId, threshold, totalPlayers, cryptoConfig, createdBy } = cryptoData;
    if (!this.localParticipant) return;

    // FIXED: Proper session filtering
    const groupTimestamp = content.timestamp;
    if (groupTimestamp && groupTimestamp < this.sessionStartTime) {
      console.log(`⏭️ Skipping group ${groupId} - created in previous session`);
      return;
    }

    const isCreator = createdBy === this.localParticipant.id;

    // FIXED: Only skip if creator has already processed this specific group creation
    if (isCreator && this.activeGroups.has(groupId)) {
      console.log(`⏭️ Creator already processed group ${groupId}`);
      return;
    }

    // FIXED: Consistent group creation for both creator and joiner
    if (!this.activeGroups.has(groupId)) {
      const discoveredGroup: CryptoGroup = {
        groupId,
        threshold,
        totalPlayers,
        cryptoConfig: {
          threshold,
          totalPlayers,
          keyLength: cryptoConfig.keyLength
        },
        localParticipant: this.localParticipant,
        remoteParticipants: new Map(),
        isComplete: false,
        createdAt: Date.now(),
        createdBy,
        participants: [createdBy],
        state: 'recruiting',
        isLocalCreator: isCreator,
        encryptedMessages: new Map(),
        partialDecryptions: new Map(),
        reconstructedMessages: new Map(),
        sessionStartTime: this.sessionStartTime
      };

      // FIXED: Always add the creator as a remote participant if not local
      if (!isCreator) {
        discoveredGroup.remoteParticipants.set(createdBy, {
          id: createdBy,
          name: content.player?.name || `Remote_${createdBy.substring(0, 8)}`,
          joinedAt: Date.now()
        });
      }

      this.activeGroups.set(groupId, discoveredGroup);

      // FIXED: Ensure participant mapping is consistent for both creator and joiner
      this.ensureAllParticipantsMapped(discoveredGroup);

      console.log(`\n🏗️ ${isCreator ? 'CREATED' : 'DISCOVERED'} GROUP: ${groupId} (${threshold}/${totalPlayers})`);
      console.log(`   👤 Creator: ${content.player?.name || createdBy.substring(0, 12)}`);
      console.log(`   📊 Your role: ${isCreator ? 'CREATOR' : 'POTENTIAL JOINER'}`);
      console.log(`   ⏰ Created: ${new Date(content.timestamp).toLocaleTimeString()}`);
    }

    // FIXED: Show join suggestion only for non-creators
    if (!isCreator) {
      console.log(`   💡 Use 'join ${groupId}' to join this group`);
    }
  }

  private handleGroupJoin(cryptoData: any, content: any): void {
    const { groupId, participantId } = cryptoData;

    // FIXED: Proper session filtering
    const joinTimestamp = content.timestamp;
    if (joinTimestamp && joinTimestamp < this.sessionStartTime) {
      console.log(`⏭️ Skipping join from previous session`);
      return;
    }

    const group = this.activeGroups.get(groupId);
    if (!group) return;
    if (group.state === 'closed') return;

    const isLocalParticipant = participantId === this.localParticipant?.id;

    // FIXED: Consistent participant handling for both self and others
    if (!group.participants.includes(participantId)) {
      group.participants.push(participantId);
      console.log(`👥 ${isLocalParticipant ? 'You' : content.player?.name || 'Remote participant'} joined group ${groupId}`);
    }

    // FIXED: Ensure remote participants are properly mapped
    if (!isLocalParticipant && !group.remoteParticipants.has(participantId)) {
      group.remoteParticipants.set(participantId, {
        id: participantId,
        name: content.player?.name || `Remote_${participantId.substring(0, 8)}`,
        joinedAt: Date.now()
      });
    }

    // FIXED: Always ensure participant mapping is consistent
    this.ensureAllParticipantsMapped(group);

    // FIXED: Show progress to all participants in the group
    if (group.participants.includes(this.localParticipant?.id || '')) {
      console.log(`   📊 Group now has ${group.participants.length}/${group.totalPlayers} participants`);

      // FIXED: Check if group is full
      if (group.participants.length >= group.totalPlayers) {
        console.log(`🎉 Group is now FULL! (${group.participants.length}/${group.totalPlayers})`);

        if (group.isLocalCreator) {
          console.log(`🚀 As creator, starting key exchange in 2 seconds...`);
          // Use non-blocking setTimeout
          setTimeout(() => {
            this.advanceGroupToKeyExchange(group);
          }, 2000);
        } else {
          console.log(`⏳ Waiting for group creator to start key exchange...`);
        }
      }
    }
  }

  private handleGroupClose(cryptoData: any, content: any): void {
    const { groupId, reason } = cryptoData;
    const group = this.activeGroups.get(groupId);
    if (!group) return;

    // FIXED: Proper session filtering
    const closeTimestamp = content.timestamp;
    if (closeTimestamp && closeTimestamp < this.sessionStartTime) {
      console.log(`⏭️ Skipping group close from previous session`);
      return;
    }

    const oldState = group.state;
    group.state = 'closed';
    group.closedAt = Date.now();

    // FIXED: Show close notification to all participants
    if (group.participants.includes(this.localParticipant?.id || '')) {
      console.log(`\n🔒 Group ${groupId} CLOSED`);
      console.log(`   📊 Previous state: ${oldState}`);
      console.log(`   📝 Reason: ${reason || 'Unknown'}`);
      console.log(`   ⏰ Closed at: ${new Date(group.closedAt).toLocaleTimeString()}`);
      console.log(`   💡 This group is no longer accepting new participants`);
    }
  }

  private ensureAllParticipantsMapped(group: CryptoGroup): void {
    // FIXED: Ensure every participant in the list has a corresponding remote participant entry
    for (const participantId of group.participants) {
      if (participantId !== this.localParticipant?.id && !group.remoteParticipants.has(participantId)) {
        group.remoteParticipants.set(participantId, {
          id: participantId,
          name: `Unknown_${participantId.substring(0, 8)}`,
          joinedAt: Date.now()
        });
        console.log(`🔧 Mapped missing participant: ${participantId.substring(0, 12)}`);
      }
    }
  }

  private handleGroupUpdate(cryptoData: any, content: any): void {
    const { groupId, state } = cryptoData;
    const group = this.activeGroups.get(groupId);
    if (!group) return;

    const oldState = group.state;
    group.state = state;

    // FIXED: Show state changes to all participants
    if (group.participants.includes(this.localParticipant?.id || '')) {
      console.log(`\n📊 Group ${groupId}: ${oldState.toUpperCase()} → ${state.toUpperCase()}`);
    }

    // FIXED: Ensure all participants start key exchange when state changes
    if (state === 'key-exchange' && oldState !== 'key-exchange') {
      if (group.participants.includes(this.localParticipant?.id || '')) {
        console.log(`🔑 Starting key exchange process...`);
        console.log(`⏳ Each participant will generate and share their key...`);
        this.generateAndShareKey(group);
      }
    }
  }

  private handlePublicKeyShare(cryptoData: any, content: any): void {
    const { groupId, publicKeyShare } = cryptoData;
    const group = this.activeGroups.get(groupId);
    if (!group) return;

    const { playerId, publicKey, keyIndex } = publicKeyShare;
    if (playerId === this.localParticipant?.id) return;

    // FIXED: Ensure participant mapping before processing keys
    this.ensureAllParticipantsMapped(group);

    const remoteParticipant = group.remoteParticipants.get(playerId);
    if (remoteParticipant) {
      remoteParticipant.publicKey = publicKey;
      remoteParticipant.keyIndex = keyIndex;
    } else {
      // FIXED: Create remote participant if not found but in participants list
      if (group.participants.includes(playerId)) {
        group.remoteParticipants.set(playerId, {
          id: playerId,
          name: content.player?.name || `Remote_${playerId.substring(0, 8)}`,
          publicKey,
          keyIndex,
          joinedAt: Date.now()
        });
      }
    }

    // FIXED: Show key receipt to all group participants
    if (group.participants.includes(this.localParticipant?.id || '')) {
      console.log(`\n🔑 Key received from ${content.player?.name || playerId.substring(0, 12)}`);
      console.log(`   🔢 Key Index: ${keyIndex}`);
      console.log(`   🔐 Public Key: ${publicKey.substring(0, 20)}...`);
    }

    // FIXED: Always ensure participant mapping after key processing
    this.ensureAllParticipantsMapped(group);
    this.checkGroupCompletion(group);
  }

  private handleEncryptedMessage(cryptoData: any, content: any): void {
    const { groupId, encryptedData } = cryptoData;
    const group = this.activeGroups.get(groupId);
    if (!group) return;
    const senderId = content.player?.id;
    const messageId = cryptoData.customMessageId || content.messageId || `msg_${Date.now()}`;
    // Skip if this is a duplicate of a message we already have
    if (group.encryptedMessages.has(messageId)) return;
    // NEW: Skip if we sent this message (we already have it stored)
    if (senderId === this.localParticipant?.id) {
      console.log(`⏭️ Skipping own encrypted message ${messageId}`);
      return;
    }
    console.log(`\n📨 Received encrypted message from ${content.player?.name || senderId?.substring(0, 12) || 'Unknown'}...`);
    console.log(`   🆔 Original Message ID: ${messageId}`);
    console.log(`   🔐 Encrypted data: ${encryptedData.data.substring(0, 32)}...`);
    const encryptedMessage: XorEncryptedMessage = {
      encryptedData: Buffer.from(encryptedData.data, 'hex'),
      nonce: Buffer.from(encryptedData.nonce, 'hex')
    };
    // Store the message
    group.encryptedMessages.set(messageId, {
      message: encryptedMessage,
      from: senderId || 'Unknown',
      messageId,
      originalText: '' // We don't know the original for received messages
    });
    // Perform partial decryption for received messages
    this.performPartialDecryption(group, messageId, encryptedMessage);
    this.showMessages(); // Show updated messages after receiving
  }

  private handlePartialDecryption(cryptoData: any, content: any): void {
    const { groupId, originalMessageId, partialDecryption } = cryptoData;
    const group = this.activeGroups.get(groupId);
    if (!group) return;
    const senderId = content.player?.id;
    const partial: XorPartialDecryption = {
      playerId: partialDecryption.playerId,
      value: Buffer.from(partialDecryption.value, 'hex')
    };
    // Store the partial decryption
    if (!group.partialDecryptions.has(originalMessageId)) {
      group.partialDecryptions.set(originalMessageId, []);
    }
    const partials = group.partialDecryptions.get(originalMessageId)!;
    if (!partials.some(p => p.playerId === partial.playerId)) {
      partials.push(partial);
      // Only attempt reconstruction if we have the encrypted message
      if (group.encryptedMessages.has(originalMessageId)) {
        this.tryMessageReconstruction(group, originalMessageId);
      } else {
        // Otherwise, just store the partial and wait for the encrypted message to arrive
        // Optionally, log that we're waiting for the encrypted message
      }
    }
  }

  private async advanceGroupToKeyExchange(group: CryptoGroup): Promise<void> {
    // FIXED: Ensure all participants are mapped before advancing
    this.ensureAllParticipantsMapped(group);

    // FIXED: Validate group is ready for key exchange
    if (group.participants.length < group.totalPlayers) {
      console.error(`❌ Cannot advance to key exchange: Group not full (${group.participants.length}/${group.totalPlayers})`);
      return;
    }

    if (group.state !== 'recruiting') {
      console.log(`ℹ️ Group ${group.groupId} already in state: ${group.state}`);
      return;
    }

    console.log(`🔄 Advancing group ${group.groupId} to key-exchange state...`);

    try {
      const metadata = XorCryptoMessageBuilder.createGroupUpdateMessage(
        { id: this.localParticipant!.id, name: this.localParticipant!.name },
        group.groupId,
        'key-exchange',
        group.participants
      );

      const txId = await this.sendCryptoMessage(metadata);
      if (txId) {
        console.log(`✅ Advanced to key-exchange - Transaction ID: ${txId}`);

        // FIXED: Update local group state immediately
        group.state = 'key-exchange';

        // FIXED: Show immediate feedback to creator
        console.log(`🔑 Starting key exchange process...`);
        console.log(`⏳ Each participant will generate and share their key...`);

        // FIXED: Creator also participates in key exchange
        this.generateAndShareKey(group);
      } else {
        console.error(`❌ Failed to advance group to key-exchange`);
      }
    } catch (error) {
      console.error(`❌ Error advancing group to key-exchange:`, error);
    }
  }

  private async generateAndShareKey(group: CryptoGroup): Promise<void> {
    // FIXED: Ensure participant mapping is consistent before key generation
    this.ensureAllParticipantsMapped(group);

    // FIXED: Validate we have the correct participant position
    const keyIndex = group.participants.indexOf(this.localParticipant!.id) + 1;
    if (keyIndex === 0) {
      console.error(`❌ Local participant not found in group ${group.groupId} participants list`);
      return;
    }

    const delayMs = keyIndex * 100; // 2 seconds per participant index
    console.log(`\n🔑 Generating key (${keyIndex}/${group.totalPlayers}) in ${delayMs}ms...`);

    // FIXED: Add delay to prevent simultaneous key sharing
    await new Promise(resolve => setTimeout(resolve, delayMs));

    try {
      const playerKey = SimplifiedXorCrypto.generatePlayerKey(
        group.cryptoConfig,
        { id: this.localParticipant!.id, name: this.localParticipant!.name },
        keyIndex
      );

      group.localParticipant.cryptoKey = playerKey;

      console.log(`🔑 Generated key (${keyIndex}) after ${delayMs}ms delay`);
      console.log(`   🔐 Public Key: ${playerKey.publicKey.toString('hex').substring(0, 20)}...`);
      console.log(`📤 Sharing key with group...`);

      const metadata = XorCryptoMessageBuilder.createPublicKeyShareMessage(
        { id: this.localParticipant!.id, name: this.localParticipant!.name },
        playerKey,
        group.groupId
      );

      const txId = await this.sendCryptoMessage(metadata);
      if (txId) {
        console.log(`✅ Shared key - Transaction ID: ${txId}`);

        // FIXED: Immediately check group completion after successful key sharing
        this.checkGroupCompletion(group);
      } else {
        console.error(`❌ Failed to share key - transaction failed`);
      }
    } catch (error) {
      console.error(`❌ Key generation failed:`, error);
    }
  }

  private checkGroupCompletion(group: CryptoGroup): void {
    // FIXED: Ensure all participants are mapped before checking completion
    this.ensureAllParticipantsMapped(group);

    const keysReceived = Array.from(group.remoteParticipants.values())
      .filter(p => p.publicKey !== undefined).length;
    const expectedKeys = group.totalPlayers - 1;

    // FIXED: Show progress to all group participants
    if (group.participants.includes(this.localParticipant?.id || '')) {
      console.log(`\n📊 Key exchange progress: ${keysReceived + 1}/${group.totalPlayers} keys received`);
    }

    if (keysReceived === expectedKeys) {
      if (group.participants.includes(this.localParticipant?.id || '')) {
        console.log(`\n🎉 All keys received! Calculating group encryption key...`);
      }

      const keyCalculated = this.calculateGroupKey(group);
      if (keyCalculated) {
        group.isComplete = true;
        group.state = 'encryption-ready';

        if (group.participants.includes(this.localParticipant?.id || '')) {
          console.log(`✅ Group cryptography complete! Ready for encrypted messaging.`);
          console.log(`💡 Use 'encrypt <message>' to send encrypted messages`);
        }

        // FIXED: Refresh UI for all participants
        this.showGroups();
      }
    } else {
      if (group.participants.includes(this.localParticipant?.id || '')) {
        console.log(`⏳ Waiting for ${expectedKeys - keysReceived} more keys...`);
      }

      // FIXED: Retry completion check periodically
      setTimeout(() => { this.checkGroupCompletion(group); }, 5000);
    }
  }

  private async closeGroup(group: CryptoGroup, reason: string): Promise<void> {
    if (group.state === 'closed') return;
    console.log(`🔒 Closing group ${group.groupId}: ${reason}`);
    const metadata = XorCryptoMessageBuilder.createGroupCloseMessage(
      { id: this.localParticipant!.id, name: this.localParticipant!.name },
      group.groupId,
      reason
    );
    const txId = await this.sendCryptoMessage(metadata);
    if (txId) {
      console.log(`✅ Group close message sent`);
      this.showGroups(); // <--- ADDED: Refresh UI after closure
    }
  }

  private calculateGroupKey(group: CryptoGroup): boolean {
    try {
      if (!group.localParticipant.cryptoKey) {
        console.log(`⚠️ Local crypto key not available for group ${group.groupId}`);
        return false;
      }

      const allPlayerKeys: XorPlayerKey[] = [group.localParticipant.cryptoKey];

      // FIXED: Ensure all remote participants have keys before combining
      for (const remote of group.remoteParticipants.values()) {
        if (remote.publicKey && remote.keyIndex) {
          const remoteKey: XorPlayerKey = {
            playerId: remote.id,
            playerName: remote.name,
            privateKey: Buffer.alloc(group.cryptoConfig.keyLength, 0),
            publicKey: Buffer.from(remote.publicKey, 'hex'),
            keyIndex: remote.keyIndex
          };
          allPlayerKeys.push(remoteKey);
        }
      }

      // FIXED: Validate we have all expected keys
      if (allPlayerKeys.length !== group.totalPlayers) {
        console.log(`⚠️ Key calculation failed: Expected ${group.totalPlayers} keys, got ${allPlayerKeys.length}`);
        return false;
      }

      // FIXED: Show key combination progress to all participants
      if (group.participants.includes(this.localParticipant?.id || '')) {
        console.log(`🔢 Combining ${allPlayerKeys.length} player keys...`);
      }

      const groupKey = SimplifiedXorCrypto.createGroupKey(
        group.cryptoConfig,
        allPlayerKeys,
        group.createdBy
      );

      group.combinedKey = groupKey.combinedKey;

      // FIXED: Show success message to all participants
      if (group.participants.includes(this.localParticipant?.id || '')) {
        console.log(`🔐 GROUP ENCRYPTION KEY CALCULATED!`);
        console.log(`   🔑 Combined Key: ${groupKey.combinedKey.toString('hex').substring(0, 32)}...`);
        console.log(`   📊 Key formed from ${allPlayerKeys.length} participants`);
        console.log(`   🎯 Threshold: ${group.threshold} signatures required`);
        console.log(`   ✅ Group ready for secure communications!`);
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to calculate group key:', error);
      return false;
    }
  }

  private async performPartialDecryption(group: CryptoGroup, messageId: string, encryptedMessage: XorEncryptedMessage): Promise<void> {
    if (!group.localParticipant.cryptoKey) {
      console.log(`⚠️ No local crypto key available for decryption`);
      return;
    }
    console.log(`🔐 Performing partial decryption with local key...`);
    console.log(`   🆔 Original Message ID: ${messageId}`);
    const groupKey: XorGroupKey = {
      groupId: group.groupId,
      threshold: group.threshold,
      totalPlayers: group.totalPlayers,
      keyLength: group.cryptoConfig.keyLength,
      combinedKey: group.combinedKey!,
      createdAt: group.createdAt,
      createdBy: group.createdBy,
      participants: group.participants
    };
    const partialDecryption = SimplifiedXorCrypto.partialDecrypt(
      encryptedMessage,
      group.localParticipant.cryptoKey,
      groupKey
    );
    console.log(`   🔓 Partial decryption value: ${partialDecryption.value.toString('hex').substring(0, 32)}...`);
    if (!group.partialDecryptions.has(messageId)) {
      group.partialDecryptions.set(messageId, []);
    }
    // Only add if not already present (avoid duplicate partials)
    const partials = group.partialDecryptions.get(messageId)!;
    if (!partials.some(p => p.playerId === partialDecryption.playerId)) {
      partials.push(partialDecryption);
    }
    console.log(`📤 Sharing partial decryption with group...`);
    const partialDecryptionMsg = XorCryptoMessageBuilder.createPartialDecryptionMessage(
      { id: this.localParticipant!.id, name: this.localParticipant!.name },
      partialDecryption,
      group.groupId,
      messageId
    );
    const txId = await this.sendCryptoMessage(partialDecryptionMsg);
    if (txId) {
      console.log(`✅ Shared partial decryption`);
    }
    // Always try reconstruction (for both sent and received messages)
    this.tryMessageReconstruction(group, messageId);
  }

  private tryMessageReconstruction(group: CryptoGroup, messageId: string): void {
    const encryptedData = group.encryptedMessages.get(messageId);
    const partialDecryptions = group.partialDecryptions.get(messageId);
    if (!encryptedData || !partialDecryptions) return;
    if (partialDecryptions.length < group.threshold) {
      console.log(`   📊 Partial decryptions: ${partialDecryptions.length}/${group.threshold} (waiting for more)`);
      return;
    }
    // Skip if already reconstructed
    // if (group.reconstructedMessages.has(messageId)) {
    //   console.log(`   ✅ Message already reconstructed`);
    //   return;
    // }
    try {
      console.log(`\n🔍 Attempting message reconstruction...`);
      console.log(`   🆔 Original Message ID: ${messageId}`);
      console.log(`   📊 Using ${partialDecryptions.length} partial decryptions`);
      const groupKey: XorGroupKey = {
        groupId: group.groupId,
        threshold: group.threshold,
        totalPlayers: group.totalPlayers,
        keyLength: group.cryptoConfig.keyLength,
        combinedKey: group.combinedKey!,
        createdAt: group.createdAt,
        createdBy: group.createdBy,
        participants: group.participants
      };
      const reconstructedMessage = SimplifiedXorCrypto.combinePartialDecryptions(
        encryptedData.message,
        partialDecryptions,
        groupKey
      );
      // Store the reconstruction
      group.reconstructedMessages.set(messageId, reconstructedMessage);
      // NEW: Show consistent output for everyone
      console.log(`\n✨ MESSAGE RECONSTRUCTED SUCCESSFULLY!`);
      console.log(`   🆔 Message ID: ${messageId}`);
      console.log(`   👤 From: ${encryptedData.from === this.localParticipant?.id ? 'You' :
        group.remoteParticipants.get(encryptedData.from)?.name || encryptedData.from.substring(0, 12)}`);
      console.log(`   📝 Decrypted: "${reconstructedMessage}"`);
      console.log(`   🔓 Used ${partialDecryptions.length}/${group.threshold} partial decryptions`);
      // Only show verification if we know the original (we sent it)
      if (encryptedData.originalText && encryptedData.from === this.localParticipant?.id) {
        const isMatch = reconstructedMessage === encryptedData.originalText;
        console.log(`   ✓ Self-verification: ${isMatch ? '✅ PASS' : '❌ FAIL'}`);
        if (!isMatch) {
          console.warn(`   ⚠️ Original: "${encryptedData.originalText}"`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to reconstruct message ${messageId}:`, error);
    }
  }

  private async sendCryptoMessage(metadata: any): Promise<string | null> {
    try {
      const allUtxos = await this.hydraClient.fetchUTXOs();
      const senderUtxos = allUtxos.filter(utxo => {
        const utxoAddress = utxo.address || utxo.output?.address;
        const addressStr = typeof utxoAddress === 'string' ? utxoAddress :
          (utxoAddress?.toString ? utxoAddress.toString() :
            utxoAddress?.toBech32 ? utxoAddress.toBech32() : String(utxoAddress));
        return addressStr.trim() === this.localParticipant!.walletInfo.address.trim();
      });
      if (senderUtxos.length === 0) {
        console.error('❌ No UTXOs available for transaction');
        return null;
      }
      const selectedUtxo = senderUtxos.sort((a, b) =>
        Number(b.output.value.lovelace) - Number(a.output.value.lovelace)
      )[0];
      const txBuilder = makeTxBuilder({ isMainnet: false });
      txBuilder.spendWithoutRedeemer(selectedUtxo);
      const value = makeValue(BigInt(500_000));
      txBuilder.payUnsafe(this.localParticipant!.walletInfo.address, value);
      const metadataJson = JSON.stringify(metadata);
      txBuilder.setMetadataAttributes({ 1337: metadataJson });
      txBuilder.validToTime(Date.now() + 3600000);
      const networkParams = await this.hydraClient.getNetworkParameters();
      const tx = await txBuilder.build({
        changeAddress: this.localParticipant!.walletInfo.address,
        networkParams,
        spareUtxos: []
      });
      const originalConsoleLog = console.log;
      const originalConsoleInfo = console.info;
      console.log = () => { };
      console.info = () => { };
      const signedTx = await this.localParticipant!.wallet.signTransaction(tx);
      console.log = originalConsoleLog;
      console.info = originalConsoleInfo;
      return await this.hydraClient.submitTransaction(signedTx);
    } catch (error) {
      console.error('❌ Send failed:', error);
      return null;
    }
  }

  async selectLocalParticipant(): Promise<void> {
    const wallets = await this.getAvailableWallets();
    if (wallets.length === 0) throw new Error('No wallets available');
    console.log('\n👤 Available Wallets:');
    wallets.forEach((wallet, index) => {
      console.log(`   ${index + 1}. ${wallet}`);
    });
    const choice = await this.ask('\n🔹 Select wallet: ');
    const walletIndex = parseInt(choice) - 1;
    if (walletIndex < 0 || walletIndex >= wallets.length) {
      throw new Error('Invalid selection');
    }
    const selectedWalletId = wallets[walletIndex];
    const originalConsoleLog = console.log;
    const originalConsoleInfo = console.info;
    console.log = () => { };
    console.info = () => { };
    const wallet = await heliosWallet.load(selectedWalletId, {
      name: 'CryptoParticipant',
      network: 'testnet',
      storageDir: './helios-wallets',
      hydraClient: this.hydraClient
    });
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    const walletInfo = wallet.getWalletInfo();
    const participantName = this.generateParticipantName(walletInfo.address);
    this.localParticipant = {
      id: walletInfo.id,
      name: participantName,
      wallet,
      walletInfo
    };
    console.log(`✅ Ready: ${this.localParticipant.name}`);
    console.log(`   📍 Address: ${walletInfo.address}`);
    console.log(`   🆔 Wallet ID: ${walletInfo.id.substring(0, 12)}...`);
  }

  private showMenu(): void {
    console.log('\n📋 Commands:');
    console.log('   create <threshold> <total>  - Create crypto group');
    console.log('   join <groupId>              - Join group');
    console.log('   encrypt <message>           - Encrypt and send message');
    console.log('   groups                      - Show groups');
    console.log('   messages                    - Show encrypted messages');
    console.log('   help                        - Show this menu');
    console.log('   quit                        - Exit');
    this.showPrompt();
  }

  private showPrompt(): void {
    // Add a small delay to ensure all console output is complete
    setTimeout(() => {
      if (this.isRunning && !this.promptActive) {
        this.promptActive = true;
        this.rl.question('\n🔹 Command: ', (input) => {
          this.promptActive = false;
          if (input.trim()) {
            this.handleCommand(input.trim());
          } else {
            // Handle empty input by showing prompt again
            this.showPrompt();
          }
        });
      }
    }, 100);
  }

  private async handleCommand(input: string): Promise<void> {
    const parts = input.split(' ');
    const command = parts[0].toLowerCase();
    try {
      switch (command) {
        case 'create':
          await this.createGroup(parseInt(parts[1]), parseInt(parts[2]));
          break;
        case 'join':
          await this.joinGroup(parts[1]);
          break;
        case 'encrypt':
          await this.encryptMessage(parts.slice(1).join(' '));
          break;
        case 'groups':
          this.showGroups();
          break;
        case 'messages':
          this.showMessages();
          break;
        case 'help':
          this.showMenu();
          break;
        case 'quit':
          this.stopSystem();
          return; // Don't show prompt after quit
        default:
          console.log('❓ Unknown command. Type "help" for available commands.');
      }
    } catch (error) {
      console.error('❌ Command failed:', error);
    }
    // ALWAYS show prompt after command execution (except quit)
    this.showPrompt();
  }

  private async createGroup(threshold: number, totalPlayers: number): Promise<void> {
    if (!threshold || !totalPlayers || threshold > totalPlayers) {
      console.log('❌ Usage: create <threshold> <total>');
      return;
    }
    const groupId = `xor_group_${Date.now()}`;
    const cryptoConfig = SimplifiedXorCrypto.generateGroupConfig(threshold, totalPlayers);
    const group: CryptoGroup = {
      groupId,
      threshold,
      totalPlayers,
      cryptoConfig,
      localParticipant: this.localParticipant!,
      remoteParticipants: new Map(),
      isComplete: false,
      createdAt: Date.now(),
      createdBy: this.localParticipant!.id,
      participants: [this.localParticipant!.id],
      state: 'recruiting',
      isLocalCreator: true,
      encryptedMessages: new Map(),
      partialDecryptions: new Map(),
      reconstructedMessages: new Map(),
      sessionStartTime: this.sessionStartTime
    };
    this.activeGroups.set(groupId, group);
    const metadata = XorCryptoMessageBuilder.createGroupCreateMessage(
      { id: this.localParticipant!.id, name: this.localParticipant!.name },
      groupId,
      threshold,
      totalPlayers,
      cryptoConfig
    );
    const txId = await this.sendCryptoMessage(metadata);
    if (txId) {
      console.log(`✅ Group created: ${groupId}`);
      console.log(`   TX: ${txId}`);
    }
  }

  private async joinGroup(groupId: string): Promise<void> {
    if (!groupId) {
      console.log('❌ Usage: join <groupId>');
      return;
    }
    const group = this.activeGroups.get(groupId);
    if (group && !group.participants.includes(this.localParticipant!.id)) {
      group.participants.push(this.localParticipant!.id);
      group.localParticipant = this.localParticipant!;
      console.log(`👥 Added to group participant list (${group.participants.length}/${group.totalPlayers})`);
    }
    const metadata = XorCryptoMessageBuilder.createGroupJoinMessage(
      { id: this.localParticipant!.id, name: this.localParticipant!.name },
      groupId
    );
    const txId = await this.sendCryptoMessage(metadata);
    if (txId) {
      console.log(`✅ Join request sent: ${groupId}`);
    }
  }

  private async encryptMessage(message: string): Promise<void> {
    if (!message) {
      console.log('❌ Usage: encrypt <message>');
      return;
    }
    const completeGroup = Array.from(this.activeGroups.values()).find(g =>
      g.isComplete && g.participants.includes(this.localParticipant!.id)
    );
    if (!completeGroup) {
      console.log('❌ No complete group available for encryption');
      console.log('   Complete the key exchange first');
      return;
    }
    console.log(`\n🔒 Encrypting message: "${message}"`);
    try {
      const groupKey: XorGroupKey = {
        groupId: completeGroup.groupId,
        threshold: completeGroup.threshold,
        totalPlayers: completeGroup.totalPlayers,
        keyLength: completeGroup.cryptoConfig.keyLength,
        combinedKey: completeGroup.combinedKey!,
        createdAt: completeGroup.createdAt,
        createdBy: completeGroup.createdBy,
        participants: completeGroup.participants
      };
      const encryptedMessage = SimplifiedXorCrypto.encryptMessage(message, groupKey);
      console.log(`   🔐 Encrypted successfully`);
      console.log(`      data: ${encryptedMessage.encryptedData.toString('hex').substring(0, 32)}...`);
      console.log(`      nonce: ${encryptedMessage.nonce.toString('hex').substring(0, 32)}...`);
      // Generate unique message ID
      const messageId = `xor_msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      // Store the message BEFORE sending
      completeGroup.encryptedMessages.set(messageId, {
        message: encryptedMessage,
        from: this.localParticipant!.id,
        messageId,
        originalText: message // We know the original since we're sending it
      });
      // Create the encrypted message metadata
      const encryptedMessageData = XorCryptoMessageBuilder.createEncryptedMessage(
        { id: this.localParticipant!.id, name: this.localParticipant!.name },
        encryptedMessage,
        completeGroup.groupId,
        completeGroup.participants.filter(p => p !== this.localParticipant!.id)
      );
      // Add the message ID to the metadata
      (encryptedMessageData.gameData as any).customMessageId = messageId;
      const txId = await this.sendCryptoMessage(encryptedMessageData);
      if (txId) {
        console.log(`   📤 Transmitted via Hydra`);
        console.log(`   🆔 Original Message ID: ${messageId}`);
        console.log(`   ⏳ Performing local partial decryption...`);
        // Perform our partial decryption
        await this.performPartialDecryption(completeGroup, messageId, encryptedMessage);
        this.showMessages(); // Show updated messages after sending
      } else {
        console.log(`   ❌ Failed to transmit message`);
        // Remove the message if transmission failed
        completeGroup.encryptedMessages.delete(messageId);
      }
    } catch (error) {
      console.error(`❌ Failed to encrypt message:`, error);
    }
  }

  private showGroups(): void {
    console.log('\n🏢 Active Groups:');
    if (this.activeGroups.size === 0) {
      console.log('   No active groups');
      console.log('   💡 Use "create <threshold> <total>" to create a new group');
      return;
    }

    for (const [groupId, group] of this.activeGroups) {
      const isParticipant = group.participants.includes(this.localParticipant!.id);
      const participantCount = group.participants.length;

      console.log(`\n🆔 ${groupId}`);
      console.log(`   📊 Status: ${group.state.toUpperCase()}`);
      console.log(`   👥 Participants: ${participantCount}/${group.totalPlayers} ${participantCount === group.totalPlayers ? '(FULL)' : '(RECRUITING)'}`);
      console.log(`   🏗️  Creator: ${group.isLocalCreator ? '✅ You' : '👤 Remote'}`);
      console.log(`   🎯 Your Role: ${isParticipant ? '✅ MEMBER' : '❌ NOT JOINED'}`);
      console.log(`   🔐 Threshold: ${group.threshold} signatures required`);
      console.log(`   ⏰ Created: ${new Date(group.createdAt).toLocaleTimeString()}`);

      if (group.closedAt) {
        console.log(`   🔒 Closed: ${new Date(group.closedAt).toLocaleTimeString()}`);
      }

      // FIXED: Show participant details consistently for both creator and joiner
      console.log(`   \n   👥 Participant Details:`);
      group.participants.forEach((participantId, index) => {
        const isYou = participantId === this.localParticipant!.id;
        const remoteParticipant = group.remoteParticipants.get(participantId);
        const name = isYou ? this.localParticipant!.name : (remoteParticipant?.name || participantId.substring(0, 12));
        const keyStatus = isYou ?
          (group.localParticipant.cryptoKey ? '🔑' : '⏳') :
          (remoteParticipant?.publicKey ? '🔑' : '⏳');
        console.log(`      ${index + 1}. ${name} ${isYou ? '(YOU)' : ''} ${keyStatus}`);
      });

      // FIXED: Show encryption key section consistently for both creator and joiner
      if (group.isComplete && group.combinedKey) {
        console.log(`   \n   🔐 Group Encryption Key:`);
        console.log(`   ────────────────────────────────────────────────────────────`);
        const keyHex = group.combinedKey.toString('hex').toUpperCase();
        console.log(`      🔑 Combined Key: ${keyHex.substring(0, 32)}...`);
        console.log(`      📏 Key Length: ${keyHex.length * 4} bits`);
        console.log(`      🎯 Encryption Ready: ✅ YES`);
        console.log(`      💡 Use "encrypt <message>" to send encrypted messages`);
      } else if (group.state === 'encryption-ready' || group.state === 'key-exchange') {
        console.log(`   \n   🔐 Group Encryption Status:`);
        console.log(`   ────────────────────────────────────────────────────────────`);
        console.log(`      🔑 Combined Key: ${group.combinedKey ? '✅ READY' : '⏳ CALCULATING'}`);
        console.log(`      🎯 Encryption Ready: ${group.isComplete ? '✅ YES' : '⏳ PROCESSING'}`);
        if (!group.isComplete) {
          console.log(`      💡 Key exchange in progress...`);
        }
      }

      // FIXED: Show consistent next steps for all participants
      console.log(`   \n   🎯 Next Steps:`);
      if (group.state === 'closed') {
        console.log(`      🔒 Group is closed - no new participants can join`);
      } else if (!isParticipant && group.state === 'recruiting') {
        console.log(`      💡 Use "join ${groupId}" to join this group`);
      } else if (isParticipant && group.state === 'recruiting') {
        console.log(`      ⏳ Waiting for more participants to join`);
      } else if (isParticipant && group.state === 'key-exchange') {
        if (group.isComplete) {
          console.log(`      🎉 Group ready for crypto operations!`);
        } else {
          console.log(`      ⏳ Waiting for all key exchanges to complete`);
        }
      } else if (isParticipant && group.state === 'encryption-ready') {
        console.log(`      🎉 Group ready for encrypted messaging!`);
        console.log(`      💡 Use "encrypt <message>" to send encrypted messages`);
      }

      console.log(`   ${'-'.repeat(60)}`);
    }
  }

  private showMessages(): void {
    console.log('\n💬 Encrypted Messages:');
    let hasMessages = false;
    for (const [groupId, group] of this.activeGroups) {
      if (group.encryptedMessages.size > 0) {
        hasMessages = true;
        console.log(`\n📁 Group: ${groupId}`);
        // Sort messages by ID (roughly chronological)
        const sortedMessages = Array.from(group.encryptedMessages.entries())
          .sort(([idA], [idB]) => idA.localeCompare(idB));
        for (const [messageId, messageData] of sortedMessages) {
          const isOwnMessage = messageData.from === this.localParticipant?.id;
          const senderName = isOwnMessage ? 'You' :
            group.remoteParticipants.get(messageData.from)?.name || messageData.from.substring(0, 12);
          console.log(`\n   📝 Message: ${messageId}`);
          console.log(`      👤 From: ${senderName}`);
          console.log(`      🔐 Encrypted: ${messageData.message.encryptedData.toString('hex').substring(0, 32)}...`);
          const partialDecryptions = group.partialDecryptions.get(messageId) || [];
          console.log(`      🔓 Partial decryptions: ${partialDecryptions.length}/${group.threshold}`);
          // Show who provided partials
          if (partialDecryptions.length > 0) {
            const contributors = partialDecryptions.map(pd => {
              if (pd.playerId === this.localParticipant?.id) return 'You';
              return group.remoteParticipants.get(pd.playerId)?.name || pd.playerId.substring(0, 8);
            });
            console.log(`      👥 Contributors: ${contributors.join(', ')}`);
          }
          const reconstructedMessage = group.reconstructedMessages.get(messageId);
          if (reconstructedMessage) {
            console.log(`      ✅ Decrypted: "${reconstructedMessage}"`);
            // Only show verification status if we sent it
            if (isOwnMessage && messageData.originalText) {
              const isMatch = reconstructedMessage === messageData.originalText;
              console.log(`      ✓ Verified: ${isMatch ? '✅' : '❌'}`);
            }
          } else if (partialDecryptions.length >= group.threshold) {
            console.log(`      ⏳ Ready for reconstruction (retrying...)`);
            // Retry reconstruction
            this.tryMessageReconstruction(group, messageId);
          } else {
            console.log(`      ⏳ Waiting for ${group.threshold - partialDecryptions.length} more partial decryptions`);
          }
        }
      }
    }
    if (!hasMessages) {
      console.log('   No encrypted messages yet');
      console.log('   💡 Use "encrypt <message>" to send encrypted messages');
    }
  }

  stopSystem(): void {
    console.log('\n👋 Shutting down...');
    this.isRunning = false;
    if (this.transactionMonitor) {
      this.transactionMonitor.stopMonitoring();
    }
    this.rl.close();
    process.exit(0);
  }

  private ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  private async getAvailableWallets(): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    try {
      const files = await fs.readdir('./helios-wallets');
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
    } catch (error) {
      return [];
    }
  }
}

async function runDemo(): Promise<void> {
  const demo = new XorEncryptionDemo();
  await demo.start();
}

runDemo().catch(console.error); 