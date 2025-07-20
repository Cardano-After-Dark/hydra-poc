import { randomBytes } from 'crypto';

export interface XorCryptoConfig {
  threshold: number;
  totalPlayers: number;
  keyLength: number;
}

export interface XorPlayerKey {
  playerId: string;
  playerName: string;
  privateKey: Buffer;
  publicKey: Buffer;
  keyIndex: number;
}

export interface XorGroupKey {
  groupId: string;
  threshold: number;
  totalPlayers: number;
  keyLength: number;
  combinedKey: Buffer;
  createdAt: number;
  createdBy: string;
  participants: string[];
}

export interface XorEncryptedMessage {
  encryptedData: Buffer;
  nonce: Buffer;
}

export interface XorPartialDecryption {
  playerId: string;
  value: Buffer;
}

export class SimplifiedXorCrypto {
  private static readonly DEFAULT_KEY_LENGTH = 32;

  static generateGroupConfig(threshold: number, totalPlayers: number): XorCryptoConfig {
    if (threshold > totalPlayers) throw new Error('Threshold cannot exceed total players');
    if (threshold < 2) throw new Error('Threshold must be at least 2');
    return {
      threshold,
      totalPlayers,
      keyLength: this.DEFAULT_KEY_LENGTH
    };
  }

  static generatePlayerKey(
    config: XorCryptoConfig,
    player: { id: string; name: string },
    keyIndex: number
  ): XorPlayerKey {
    const privateKey = randomBytes(config.keyLength);
    const publicKey = Buffer.from(privateKey);
    return {
      playerId: player.id,
      playerName: player.name,
      privateKey,
      publicKey,
      keyIndex
    };
  }

  static createGroupKey(
    config: XorCryptoConfig,
    playerKeys: XorPlayerKey[],
    createdBy: string
  ): XorGroupKey {
    if (playerKeys.length !== config.totalPlayers) throw new Error('Must have exactly totalPlayers key shares');
    let combinedKey = Buffer.alloc(config.keyLength, 0);
    const participants: string[] = [];
    for (const playerKey of playerKeys) {
      for (let i = 0; i < config.keyLength; i++) {
        combinedKey[i] ^= playerKey.publicKey[i];
      }
      participants.push(playerKey.playerId);
    }
    const groupId = 'xor_group_' + randomBytes(8).toString('hex');
    return {
      groupId,
      threshold: config.threshold,
      totalPlayers: config.totalPlayers,
      keyLength: config.keyLength,
      combinedKey,
      createdAt: Date.now(),
      createdBy,
      participants
    };
  }

  static encryptMessage(message: string, groupKey: XorGroupKey): XorEncryptedMessage {
    try {
      const messageBuffer = Buffer.from(message, 'utf8');
      const nonce = randomBytes(16);
      const paddedMessage = Buffer.alloc(groupKey.keyLength);
      messageBuffer.copy(paddedMessage, 0, 0, Math.min(messageBuffer.length, groupKey.keyLength));
      const encryptedData = Buffer.alloc(groupKey.keyLength);
      for (let i = 0; i < groupKey.keyLength; i++) {
        encryptedData[i] = paddedMessage[i] ^ groupKey.combinedKey[i] ^ nonce[i % nonce.length];
      }
      return { encryptedData, nonce };
    } catch (error) {
      throw new Error(`XOR encryption failed: ${error}`);
    }
  }

  static decryptMessage(
    encryptedMessage: XorEncryptedMessage,
    groupKey: XorGroupKey
  ): string {
    try {
      const decryptedData = Buffer.alloc(groupKey.keyLength);
      for (let i = 0; i < groupKey.keyLength; i++) {
        decryptedData[i] = encryptedMessage.encryptedData[i] ^ groupKey.combinedKey[i] ^ encryptedMessage.nonce[i % encryptedMessage.nonce.length];
      }
      return decryptedData.toString('utf8').replace(/\0+$/, '');
    } catch (error) {
      throw new Error(`XOR decryption failed: ${error}`);
    }
  }

  static partialDecrypt(
    encryptedMessage: XorEncryptedMessage,
    playerKey: XorPlayerKey,
    groupKey: XorGroupKey
  ): XorPartialDecryption {
    // For XOR demo, partial decryption is just the full decryption
    const decryptedData = Buffer.alloc(groupKey.keyLength);
    for (let i = 0; i < groupKey.keyLength; i++) {
      decryptedData[i] = encryptedMessage.encryptedData[i] ^ groupKey.combinedKey[i] ^ encryptedMessage.nonce[i % encryptedMessage.nonce.length];
    }
    return {
      playerId: playerKey.playerId,
      value: decryptedData
    };
  }

  static combinePartialDecryptions(
    encryptedMessage: XorEncryptedMessage,
    partialDecryptions: XorPartialDecryption[],
    groupKey: XorGroupKey
  ): string {
    if (partialDecryptions.length < groupKey.threshold) throw new Error(`Need at least ${groupKey.threshold} partial decryptions`);
    // For XOR demo, any partial decryption is sufficient
    const partial = partialDecryptions[0];
    return partial.value.toString('utf8').replace(/\0+$/, '');
  }

  static verifyPlayerKey(playerKey: XorPlayerKey, config: XorCryptoConfig): boolean {
    try {
      if (playerKey.privateKey.length !== config.keyLength) return false;
      if (playerKey.publicKey.length !== config.keyLength) return false;
      if (!playerKey.privateKey.equals(playerKey.publicKey)) return false;
      if (playerKey.keyIndex < 1 || playerKey.keyIndex > config.totalPlayers) return false;
      return true;
    } catch {
      return false;
    }
  }

  static bufferToHex(buffer: Buffer): string {
    return buffer.toString('hex');
  }
  static hexToBuffer(hex: string): Buffer {
    return Buffer.from(hex, 'hex');
  }
}

export class XorCryptoMessageBuilder {
  static createGroupCreateMessage(
    creator: { id: string; name: string },
    groupId: string,
    threshold: number,
    totalPlayers: number,
    config: XorCryptoConfig
  ) {
    return {
      app: 'in-game-communication-demo',
      version: '1.0.0',
      messageType: 'custom' as const,
      channel: 'crypto',
      content: `🏗️ Creating XOR group ${groupId} (${threshold}/${totalPlayers})`,
      player: creator,
      gameData: {
        systemType: 'crypto',
        cryptoOperation: 'group-create',
        groupId,
        threshold,
        totalPlayers,
        cryptoConfig: {
          keyLength: config.keyLength
        },
        createdBy: creator.id
      },
      timestamp: Date.now(),
      messageId: `xor_create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  static createGroupJoinMessage(
    joiner: { id: string; name: string },
    groupId: string
  ) {
    return {
      app: 'in-game-communication-demo',
      version: '1.0.0',
      messageType: 'custom' as const,
      channel: 'crypto',
      content: `👋 ${joiner.name} wants to join XOR group ${groupId}`,
      player: joiner,
      gameData: {
        systemType: 'crypto',
        cryptoOperation: 'group-join',
        groupId,
        participantId: joiner.id
      },
      timestamp: Date.now(),
      messageId: `xor_join_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  static createGroupUpdateMessage(
    updater: { id: string; name: string },
    groupId: string,
    state: 'recruiting' | 'key-exchange' | 'complete',
    participants: string[]
  ) {
    return {
      app: 'in-game-communication-demo',
      version: '1.0.0',
      messageType: 'custom' as const,
      channel: 'crypto',
      content: `📊 XOR Group ${groupId} state: ${state} (${participants.length} participants)`,
      player: updater,
      gameData: {
        systemType: 'crypto',
        cryptoOperation: 'group-update',
        groupId,
        state,
        participants
      },
      timestamp: Date.now(),
      messageId: `xor_update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  static createGroupCloseMessage(
    closer: { id: string; name: string },
    groupId: string,
    reason: string
  ) {
    return {
      app: 'in-game-communication-demo',
      version: '1.0.0',
      messageType: 'custom' as const,
      channel: 'crypto',
      content: `🔒 XOR Group ${groupId} closed: ${reason}`,
      player: closer,
      gameData: {
        systemType: 'crypto',
        cryptoOperation: 'group-close',
        groupId,
        reason,
        closedBy: closer.id
      },
      timestamp: Date.now(),
      messageId: `xor_close_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  static createPublicKeyShareMessage(
    sender: { id: string; name: string },
    playerKey: XorPlayerKey,
    groupId: string
  ) {
    return {
      app: 'in-game-communication-demo',
      version: '1.0.0',
      messageType: 'custom' as const,
      channel: 'crypto',
      content: `🔑 XOR Key from ${sender.name} for group ${groupId}`,
      player: sender,
      gameData: {
        systemType: 'crypto',
        cryptoOperation: 'public-key-share',
        groupId,
        publicKeyShare: {
          playerId: playerKey.playerId,
          playerName: playerKey.playerName,
          publicKey: playerKey.publicKey.toString('hex'),
          keyIndex: playerKey.keyIndex
        }
      },
      timestamp: Date.now(),
      messageId: `xor_pubkey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  static createEncryptedMessage(
    sender: { id: string; name: string },
    encryptedMsg: XorEncryptedMessage,
    groupId: string,
    recipients: string[]
  ) {
    return {
      app: 'in-game-communication-demo',
      version: '1.0.0',
      messageType: 'custom' as const,
      channel: 'crypto',
      content: `🔒 XOR encrypted message from ${sender.name}`,
      player: sender,
      gameData: {
        systemType: 'crypto',
        cryptoOperation: 'encrypted-message',
        groupId,
        encryptedData: {
          data: encryptedMsg.encryptedData.toString('hex'),
          nonce: encryptedMsg.nonce.toString('hex')
        },
        recipients
      },
      timestamp: Date.now(),
      messageId: `xor_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  static createPartialDecryptionMessage(
    sender: { id: string; name: string },
    partialDecryption: XorPartialDecryption,
    groupId: string,
    messageId: string
  ) {
    return {
      app: 'in-game-communication-demo',
      version: '1.0.0',
      messageType: 'custom' as const,
      channel: 'crypto',
      content: `🔓 XOR partial decryption from ${sender.name}`,
      player: sender,
      gameData: {
        systemType: 'crypto',
        cryptoOperation: 'partial-decryption',
        groupId,
        originalMessageId: messageId,
        partialDecryption: {
          playerId: partialDecryption.playerId,
          value: partialDecryption.value.toString('hex')
        }
      },
      timestamp: Date.now(),
      messageId: `xor_partial_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }
} 