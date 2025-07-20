/**
 * Tic-Tac-Toe Game Demo - Two-Terminal Interactive Gaming
 * 
 * Based on the proven crypto-demo.ts patterns for reliable two-terminal operation:
 * 1. Game creation and joining through blockchain transactions
 * 2. Real-time move communication via Hydra
 * 3. Complete workflow from game creation to completion
 * 
 * Features:
 * - Two-terminal gameplay with real-time move synchronization
 * - Blockchain-based game state management
 * - Visual board display with move history
 * - Automatic turn management and win detection
 * - Integration with existing Hydra infrastructure
 */

import { config } from 'dotenv';
import * as readline from 'readline';
import { logger, LogLevel } from '../tools/debug/logger.js';
import { HydraClientWrapper } from './hydra/hydra-client.js';
import { GameMessage, HydraTransactionMonitor } from './hydra/hydra-transaction-monitor.js';
import { heliosWallet, HeliosWallet, HeliosWalletInfo } from './wallets/helios-wallet.js';

// Load environment variables
config();

// Configure logger for clean interface
logger.setLevel(LogLevel.FATAL);

// Message Builder following crypto-demo pattern
class TicTacToeMessageBuilder {
  static createGameCreateMessage(
    creator: { id: string; name: string },
    gameId: string,
    sessionId: string
  ) {
    return {
      app: "tictactoe-game-demo",
      version: "1.0.0",
      messageType: 'custom' as const,
      channel: 'tictactoe',
      content: `🎮 ${creator.name} created tic-tac-toe game ${gameId}`,
      player: creator,
      gameData: {
        systemType: 'tictactoe',
        gameSystem: 'tictactoe',
        operation: 'game-create',
        gameId,
        createdBy: creator.id,
        sessionId
      },
      timestamp: Date.now(),
      messageId: `tictactoe_create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  static createGameJoinMessage(
    joiner: { id: string; name: string },
    gameId: string,
    sessionId: string
  ) {
    return {
      app: "tictactoe-game-demo",
      version: "1.0.0",
      messageType: 'custom' as const,
      channel: 'tictactoe',
      content: `👋 ${joiner.name} wants to join tic-tac-toe game ${gameId}`,
      player: joiner,
      gameData: {
        systemType: 'tictactoe',
        gameSystem: 'tictactoe',
        operation: 'game-join',
        gameId,
        participantId: joiner.id,
        sessionId
      },
      timestamp: Date.now(),
      messageId: `tictactoe_join_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  static createPlayerAssignmentMessage(
    player: { id: string; name: string },
    gameId: string,
    randomNumber: number
  ) {
    return {
      app: "tictactoe-game-demo",
      version: "1.0.0",
      messageType: 'custom' as const,
      channel: 'tictactoe',
      content: `🎲 ${player.name} sent random number for player assignment`,
      player: player,
      gameData: {
        systemType: 'tictactoe',
        gameSystem: 'tictactoe',
        operation: 'player-assignment',
        gameId,
        randomNumber
        // Removed sessionId to match working game-create/game-join pattern
      },
      timestamp: Date.now(),
      messageId: `tictactoe_assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  static createGameMoveMessage(
    player: { id: string; name: string },
    gameId: string,
    move: { row: number; col: number },
    moveNumber: number,
    boardState: string[][]
  ) {
    return {
      app: "tictactoe-game-demo",
      version: "1.0.0",
      messageType: 'custom' as const,
      channel: 'tictactoe',
      content: `🎯 ${player.name} played at (${move.row}, ${move.col})`,
      player: player,
      gameData: {
        systemType: 'tictactoe',
        gameSystem: 'tictactoe',
        operation: 'game-move',
        gameId,
        move,
        moveNumber,
        boardState
        // Removed sessionId to match working pattern
      },
      timestamp: Date.now(),
      messageId: `tictactoe_move_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  static createGameEndMessage(
    player: { id: string; name: string },
    gameId: string,
    winner: string,
    finalBoard: string[][],
    totalMoves: number
  ) {
    return {
      app: "tictactoe-game-demo",
      version: "1.0.0",
      messageType: 'custom' as const,
      channel: 'tictactoe',
      content: `🏁 Game ${gameId} ended - Winner: ${winner}`,
      player: player,
      gameData: {
        systemType: 'tictactoe',
        gameSystem: 'tictactoe',
        operation: 'game-end',
        gameId,
        winner,
        finalBoard,
        totalMoves
      },
      timestamp: Date.now(),
      messageId: `tictactoe_end_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }
}

interface LocalPlayer {
  id: string;
  name: string;
  wallet: HeliosWallet;
  walletInfo: HeliosWalletInfo;
}

interface RemotePlayer {
  id: string;
  name: string;
  symbol?: 'X' | 'O';
  joinedAt: number;
}

interface TicTacToeGame {
  gameId: string;
  localPlayer: LocalPlayer;
  remotePlayer?: RemotePlayer;
  createdBy: string;
  createdAt: number;
  status: 'waiting-for-player' | 'assigning-players' | 'in-progress' | 'completed';
  isLocalCreator: boolean;

  // Game state
  board: string[][];
  currentTurn: string;
  moveCount: number;
  winner?: string;

  // Player assignment
  localSymbol?: 'X' | 'O';
  remoteSymbol?: 'X' | 'O';
  localRandomNumber?: number;
  remoteRandomNumber?: number;
  localAssignmentSent?: boolean;
  pendingRemoteAssignment?: {
    playerId: string;
    playerName: string;
    randomNumber: number;
  };

  // Move tracking
  moveHistory: Array<{
    player: string;
    symbol: string;
    move: { row: number; col: number };
    moveNumber: number;
    timestamp: number;
  }>;
}

class TicTacToeDemo {
  private hydraClient: HydraClientWrapper;
  private transactionMonitor!: HydraTransactionMonitor;
  private localPlayer?: LocalPlayer;
  private activeGames: Map<string, TicTacToeGame> = new Map();
  private rl: readline.Interface;
  private isRunning = false;
  private promptActive = false;
  private startTime: number;
  private sessionId: string;

  constructor() {
    this.startTime = Date.now();
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.hydraClient = new HydraClientWrapper({
      hostname: process.env.HYDRA_HOSTNAME || '127.0.0.1',
      httpPort: parseInt(process.env.HYDRA_HTTP_PORT || '4001', 10),
      wsPort: parseInt(process.env.HYDRA_WS_PORT || '4001', 10),
      secure: process.env.HYDRA_SECURE === 'true',
      isForMainnet: process.env.HYDRA_IS_MAINNET === 'true'
    });

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Generate a player name from wallet address
   */
  private generatePlayerName(address: string): string {
    const addressSuffix = address.substring(address.length - 6);
    return `Player_${addressSuffix}`;
  }

  /**
   * Suppress console logging for clean interface
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
   * Suppress noisy Hydra transaction logs
   */
  private suppressHydraLogs(): void {
    const originalConsoleLog = console.log;

    console.log = (...args: any[]) => {
      const message = args.join(' ');

      // Filter out noisy Hydra logs
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

        message.includes('⏱️ PRODUCTION:') ||
        message.includes('🔧 PRODUCTION:') ||
        message.includes('🔄 PRODUCTION:') ||
        message.includes('🎯 PRODUCTION:')
      ) {
        return; // Suppress these logs
      }

      originalConsoleLog.apply(console, args);
    };
  }

  async start(): Promise<void> {
    this.suppressLoggerOutput();
    this.suppressHydraLogs();

    console.log('🎮 Tic-Tac-Toe Demo Starting...');

    try {
      const connectivity = await this.hydraClient.testConnectivity();
      if (!connectivity.success) {
        throw new Error(`Hydra failed: ${connectivity.error}`);
      }
      console.log('✅ Hydra connected');

      this.transactionMonitor = new HydraTransactionMonitor({
        hostname: process.env.HYDRA_HOSTNAME || '127.0.0.1',
        wsPort: parseInt(process.env.HYDRA_WS_PORT || '4001', 10),
        secure: process.env.HYDRA_SECURE === 'true',
        reconnectInterval: 5000,
        messageQueueSize: 5000, // Increased from 1000 to prevent message loss during games
        enableLogging: false  // Disable verbose logging for clean gameplay
      });

      await this.transactionMonitor.startMonitoring();
      this.setupGameHandlers();
      console.log('✅ Message monitoring active');

      await this.selectLocalPlayer();

      this.isRunning = true;
      console.log('\n🎯 Tic-Tac-Toe Demo Ready!');
      this.showMenu();
    } catch (error) {
      console.error('❌ Startup failed:', error);
      process.exit(1);
    }
  }

  private setupGameHandlers(): void {
    this.transactionMonitor.registerMessageHandler('custom', (message: GameMessage) => {
      this.handleGameMessage(message);
    });

    this.transactionMonitor.registerMessageHandler('data', (message: GameMessage) => {
      this.handleGameMessage(message);
    });

    // Add queue monitoring for debugging (only show warnings)
    setInterval(() => {
      const stats = this.transactionMonitor.getStatistics();
      if (stats.messageCount > 1000) {
        console.log(`⚠️  Queue getting full: ${stats.messageCount} messages`);
      }
    }, 60000); // Check every minute

    console.log('✅ Tic-tac-toe message handlers registered');
  }

  private handleGameMessage(message: GameMessage): void {
    try {
      const content = message.metadata.content;

      if (!content || typeof content !== 'object') {
        return; // Silently ignore invalid messages
      }

      // Parse game metadata
      const gameMetadata = this.parseGameMetadata(content);
      if (!gameMetadata || !gameMetadata.gameData) {
        return; // Silently ignore non-game messages
      }

      const gameData = gameMetadata.gameData;
      if (!gameData || gameData.systemType !== 'tictactoe') {
        return; // Silently ignore non-tic-tac-toe messages
      }

      // Check timing buffer (increased for better reliability)
      const bufferTime = 5 * 60 * 1000; // Increased to 5 minutes for better reliability
      const messageTime = content.timestamp;
      const currentTime = Date.now();
      const startTimeWithBuffer = this.startTime - bufferTime;

      // Skip timing check for player-assignment messages since they're critical for game setup
      if (gameData.operation !== 'player-assignment') {
        if (messageTime < startTimeWithBuffer) {
          return; // Silently reject old messages
        }
      }

      // Process different game operations
      switch (gameData.operation) {
        case 'game-create':
          this.handleGameCreate(gameData, gameMetadata);
          break;
        case 'game-join':
          this.handleGameJoin(gameData, gameMetadata);
          break;
        case 'player-assignment':
          this.handlePlayerAssignment(gameData, gameMetadata);
          break;
        case 'game-move':
          this.handleGameMove(gameData, gameMetadata);
          break;
        case 'game-end':
          this.handleGameEnd(gameData, gameMetadata);
          break;
        default:
          // Silently ignore unknown operations
          break;
      }

      this.showPrompt();
    } catch (error) {
      console.error('❌ Error handling game message:', error);
    }
  }

  private parseGameMetadata(content: any): any | null {
    try {
      // Check if it's a tic-tac-toe message in crypto-demo format
      if (content.gameData && content.gameData.systemType === 'tictactoe') {
        return content; // Return the flat structure directly
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to parse game metadata:', error);
      return null;
    }
  }

  private handleGameCreate(gameData: any, metadata: any): void {
    const gameId = gameData.gameId;
    const createdBy = gameData.createdBy || metadata.player.id;

    if (!this.localPlayer) return;

    const isCreator = createdBy === this.localPlayer.id;

    // Skip if this is our own game creation that we already processed
    if (isCreator && this.activeGames.has(gameId)) {
      return;
    }

    // Check if we already have a game instance (from joining)
    let game = this.activeGames.get(gameId);

    if (!game) {
      // Create new game entry
      game = {
        gameId,
        localPlayer: this.localPlayer,
        createdBy,
        createdAt: Date.now(),
        status: 'waiting-for-player',
        isLocalCreator: isCreator,
        board: this.createEmptyBoard(),
        currentTurn: '',
        moveCount: 0,
        moveHistory: [],
        localAssignmentSent: false,
        pendingRemoteAssignment: undefined
      };

      // Add remote player if not creator
      if (!isCreator) {
        game.remotePlayer = {
          id: createdBy,
          name: metadata.player.name,
          joinedAt: Date.now()
        };
      }

      this.activeGames.set(gameId, game);
    } else {
      // Update existing game instance (for joining players)
      game.createdBy = createdBy;
      game.isLocalCreator = isCreator;

      if (!isCreator && !game.remotePlayer) {
        game.remotePlayer = {
          id: createdBy,
          name: metadata.player.name,
          joinedAt: Date.now()
        };
      }
    }

    if (!isCreator) {
      console.log(`\n🎮 NEW GAME AVAILABLE: ${gameId}`);
      console.log(`   👤 Created by: ${metadata.player.name}`);
      console.log(`   💡 Use 'join ${gameId}' to join`);
      this.showPrompt();
    }
  }

  private handleGameJoin(gameData: any, metadata: any): void {
    const gameId = gameData.gameId;
    const joiningPlayerId = metadata.player.id;

    const game = this.activeGames.get(gameId);
    if (!game) return;

    // Handle someone else joining our game
    if (joiningPlayerId !== this.localPlayer?.id) {
      game.remotePlayer = {
        id: joiningPlayerId,
        name: metadata.player.name,
        joinedAt: Date.now()
      };
      game.status = 'assigning-players';

      console.log(`\n👥 ${metadata.player.name} joined your game!`);
      console.log(`   🎮 Game: ${gameId}`);
      console.log(`   🔄 Moving to player assignment...`);

      // Both players participate in assignment - staggered timing to prevent conflicts
      const delay = game.isLocalCreator ? 1000 : 2000; // Creator goes first
      setTimeout(() => {
        this.startPlayerAssignment(game);
      }, delay);
    } else {
      // This is our own join message - we need to set up the remote player (creator)
      // The creator's information should be available from the game creation message
      if (!game.remotePlayer && game.createdBy) {
        // Extract creator name from the game creation message
        const creatorName = this.generatePlayerName(game.createdBy);
        game.remotePlayer = {
          id: game.createdBy,
          name: creatorName,
          joinedAt: Date.now()
        };
      }

      game.status = 'assigning-players';
      console.log(`\n✅ Successfully joined game: ${gameId}`);
      console.log(`   🔄 Moving to player assignment...`);

      // As the joiner, also participate in player assignment
      // Use longer delay to ensure creator goes first
      setTimeout(() => {
        this.startPlayerAssignment(game);
      }, 2000);
    }
  }

  private handlePlayerAssignment(gameData: any, metadata: any): void {
    const gameId = gameData.gameId;
    const playerId = metadata.player.id;
    const randomNumber = gameData.randomNumber;

    const game = this.activeGames.get(gameId);
    if (!game) return;

    if (playerId === this.localPlayer?.id) {
      // Our own assignment message
      game.localRandomNumber = randomNumber;
      console.log(`🔍 DEBUG: Stored local assignment: ${randomNumber}`);
    } else {
      // Remote player assignment - only process if we've started our own assignment
      if (game.localAssignmentSent) {
        game.remoteRandomNumber = randomNumber;
        if (game.remotePlayer) {
          game.remotePlayer.name = metadata.player.name;
          console.log(`🔍 DEBUG: Stored remote assignment: ${randomNumber} from ${metadata.player.name}`);
        } else {
          // Try to set up remote player if missing
          game.remotePlayer = {
            id: playerId,
            name: metadata.player.name,
            joinedAt: Date.now()
          };
          console.log(`🔍 DEBUG: Created remote player for ${metadata.player.name}`);
        }
      } else {
        console.log(`🔍 DEBUG: Ignoring remote assignment from ${metadata.player.name} - local assignment not yet sent`);
        // Store the remote assignment for later processing
        game.pendingRemoteAssignment = {
          playerId,
          playerName: metadata.player.name,
          randomNumber
        };
      }
    }

    console.log(`🔍 DEBUG: Assignment check - Local: ${game.localRandomNumber}, Remote: ${game.remoteRandomNumber}`);

    // Check if both players have submitted and we've sent our assignment
    if (game.localRandomNumber && game.remoteRandomNumber && game.localAssignmentSent) {
      console.log(`🔍 DEBUG: Both assignments received and local assignment sent - finalizing...`);
      this.finalizePlayerAssignment(game);
    } else if (game.localRandomNumber && game.remoteRandomNumber && !game.localAssignmentSent) {
      console.log(`🔍 DEBUG: Both assignments received but local assignment not yet sent - waiting...`);
    }
  }

  private handleGameMove(gameData: any, metadata: any): void {
    const gameId = gameData.gameId;
    const playerId = metadata.player.id;
    const move = gameData.move;
    const incomingMoveNumber = gameData.moveNumber;

    const game = this.activeGames.get(gameId);
    if (!game) {
      return; // Silently ignore moves for unknown games
    }

    if (playerId === this.localPlayer?.id) {
      return; // Silently ignore own moves
    }

    if (game.status !== 'in-progress') {
      return; // Silently ignore moves for games not in progress
    }

    if (game.board[move.row][move.col] !== '') {
      return; // Silently ignore invalid moves
    }

    // Enhanced move number validation with tolerance for out-of-order messages
    const expectedMoveNumber = game.moveCount + 1;
    const moveNumberDifference = Math.abs(incomingMoveNumber - expectedMoveNumber);

    // Allow tolerance of 1 move for network delays
    if (moveNumberDifference > 1) {
      return; // Silently ignore moves too far out of sync
    }

    // If move number is behind, it might be a duplicate or delayed message
    if (incomingMoveNumber < expectedMoveNumber) {
      return; // Silently ignore old moves
    }

    // If move number is ahead, adjust the game state to catch up
    if (incomingMoveNumber > expectedMoveNumber) {
      // This could indicate a missed move - log for debugging
      console.log(`   ⚠️  Possible missed move detected. Game state may be inconsistent.`);
    }

    // Apply the move
    const playerSymbol = game.remotePlayer?.symbol || 'O';
    game.board[move.row][move.col] = playerSymbol;
    game.moveCount = Math.max(game.moveCount, incomingMoveNumber); // Use the higher move number

    // Add to move history
    game.moveHistory.push({
      player: playerId,
      symbol: playerSymbol,
      move: move,
      moveNumber: incomingMoveNumber,
      timestamp: Date.now()
    });

    // Switch turn to local player
    game.currentTurn = this.localPlayer?.id || '';

    console.log(`\n🎯 ${metadata.player.name} played ${playerSymbol} at (${move.row}, ${move.col})`);
    this.displayBoard(game);

    // Check for game end
    const winner = this.checkWinner(game.board);
    if (winner) {
      this.endGame(game, winner);
    } else {
      console.log(`\n⏰ Your turn! Use 'move ${gameId} <row> <col>' to play`);
    }
  }

  private handleGameEnd(gameData: any, metadata: any): void {
    const gameId = gameData.gameId;
    const winner = gameData.winner;

    const game = this.activeGames.get(gameId);
    if (!game) return;

    game.status = 'completed';
    game.winner = winner;

    console.log(`\n🏁 Game ${gameId} ended!`);
    if (winner === 'draw') {
      console.log(`   🤝 Result: Draw!`);
    } else {
      const winnerName = winner === game.localSymbol ? this.localPlayer?.name : game.remotePlayer?.name;
      console.log(`   🏆 Winner: ${winnerName} (${winner})`);
    }

    this.displayBoard(game);
    console.log(`   📊 Total moves: ${game.moveCount}`);
  }

  private async startPlayerAssignment(game: TicTacToeGame): Promise<void> {
    // Generate random number for assignment
    const randomNumber = Math.floor(Math.random() * 1000000);
    game.localRandomNumber = randomNumber;

    console.log(`\n🎲 Starting player assignment...`);
    console.log(`   🔢 Your random number: ${randomNumber}`);

    // Add small delay to ensure proper message broadcast timing
    await new Promise(resolve => setTimeout(resolve, 500));

    const metadata = TicTacToeMessageBuilder.createPlayerAssignmentMessage(
      { id: this.localPlayer!.id, name: this.localPlayer!.name },
      game.gameId,
      randomNumber
    );

    const txId = await this.sendGameMessage(metadata);
    if (txId) {
      console.log(`   ✅ Assignment sent`);

      // Mark that we've sent our assignment
      game.localAssignmentSent = true;

      // Process any pending remote assignment
      if (game.pendingRemoteAssignment) {
        console.log(`🔍 DEBUG: Processing pending remote assignment from ${game.pendingRemoteAssignment.playerName}`);
        game.remoteRandomNumber = game.pendingRemoteAssignment.randomNumber;
        if (!game.remotePlayer) {
          game.remotePlayer = {
            id: game.pendingRemoteAssignment.playerId,
            name: game.pendingRemoteAssignment.playerName,
            joinedAt: Date.now()
          };
        }
        game.pendingRemoteAssignment = undefined;

        // Check if we can finalize now
        if (game.localRandomNumber && game.remoteRandomNumber) {
          console.log(`🔍 DEBUG: Both assignments received after processing pending - finalizing...`);
          this.finalizePlayerAssignment(game);
        }
      }
    }
  }

  private finalizePlayerAssignment(game: TicTacToeGame): void {
    // Prevent multiple finalizations
    if (game.status === 'in-progress') {
      return;
    }

    const localNum = game.localRandomNumber!;
    const remoteNum = game.remoteRandomNumber!;

    console.log(`\n🎯 Player assignment complete:`);
    console.log(`   ${this.localPlayer!.name}: ${localNum}`);
    console.log(`   ${game.remotePlayer!.name}: ${remoteNum}`);

    // Higher number goes first (X)
    if (localNum > remoteNum) {
      game.localSymbol = 'X';
      game.remotePlayer!.symbol = 'O';
      game.currentTurn = this.localPlayer!.id;
      console.log(`   🥇 You go first (X)`);
    } else {
      game.localSymbol = 'O';
      game.remotePlayer!.symbol = 'X';
      game.currentTurn = game.remotePlayer!.id;
      console.log(`   🥈 ${game.remotePlayer!.name} goes first (X)`);
    }

    game.status = 'in-progress';
    console.log(`   ✅ Game ready to start!`);

    // Show the final game board with player symbols assigned
    this.displayBoard(game);

    // Both players should see the game start notification
    if (game.currentTurn === this.localPlayer!.id) {
      console.log(`\n⏰ Your turn! Use 'move ${game.gameId} <row> <col>' to play`);
    } else {
      console.log(`\n⏳ Waiting for ${game.remotePlayer!.name} to make first move...`);
      console.log(`   🎮 You are ${game.localSymbol} - you'll play after ${game.remotePlayer!.name} moves`);
      console.log(`   💡 Game is ready - you'll be notified when it's your turn`);
    }
  }

  private checkWinner(board: string[][]): string | null {
    // Check rows
    for (let row = 0; row < 3; row++) {
      if (board[row][0] && board[row][0] === board[row][1] && board[row][1] === board[row][2]) {
        return board[row][0];
      }
    }

    // Check columns
    for (let col = 0; col < 3; col++) {
      if (board[0][col] && board[0][col] === board[1][col] && board[1][col] === board[2][col]) {
        return board[0][col];
      }
    }

    // Check diagonals
    if (board[0][0] && board[0][0] === board[1][1] && board[1][1] === board[2][2]) {
      return board[0][0];
    }
    if (board[0][2] && board[0][2] === board[1][1] && board[1][1] === board[2][0]) {
      return board[0][2];
    }

    // Check for draw
    const isFull = board.flat().every(cell => cell !== '');
    if (isFull) {
      return 'draw';
    }

    return null;
  }

  private endGame(game: TicTacToeGame, winner: string): void {
    game.status = 'completed';
    game.winner = winner;

    console.log(`\n🏁 Game Over!`);
    if (winner === 'draw') {
      console.log(`   🤝 Result: Draw!`);
    } else {
      const isLocalWinner = winner === game.localSymbol;
      const winnerName = isLocalWinner ? this.localPlayer?.name : game.remotePlayer?.name;
      console.log(`   🏆 Winner: ${winnerName} (${winner})`);
      console.log(`   ${isLocalWinner ? '🎉 Congratulations!' : '😢 Better luck next time!'}`);
    }

    this.displayBoard(game);
    console.log(`   📊 Total moves: ${game.moveCount}`);
  }

  private createEmptyBoard(): string[][] {
    return [
      ['', '', ''],
      ['', '', ''],
      ['', '', '']
    ];
  }

  private displayBoard(game: TicTacToeGame): void {
    console.log(`\n📋 Game Board (${game.gameId}):`);

    // Add status indicator for assignment phase
    if (game.status === 'assigning-players') {
      console.log(`   🎲 Status: Assigning player symbols...`);
    } else if (game.status === 'in-progress') {
      console.log(`   🎯 Status: Game in progress`);
    } else if (game.status === 'completed') {
      console.log(`   🏁 Status: Game completed`);
    }

    console.log('   0   1   2');
    for (let row = 0; row < 3; row++) {
      const cells = game.board[row].map(cell => cell || ' ').join(' | ');
      console.log(`${row}  ${cells}`);
      if (row < 2) console.log('  ---|---|---');
    }
    console.log();
  }

  private async sendGameMessage(metadata: any): Promise<string | null> {
    try {
      const allUtxos = await this.hydraClient.fetchUTXOs();
      const senderUtxos = allUtxos.filter(utxo => {
        const utxoAddress = utxo.address || utxo.output?.address;
        const addressStr = typeof utxoAddress === 'string' ? utxoAddress :
          (utxoAddress?.toString ? utxoAddress.toString() :
            utxoAddress?.toBech32 ? utxoAddress.toBech32() : String(utxoAddress));
        return addressStr.trim() === this.localPlayer!.walletInfo.address.trim();
      });

      if (senderUtxos.length === 0) return null;

      const selectedUtxo = senderUtxos.sort((a, b) =>
        Number(b.output.value.lovelace) - Number(a.output.value.lovelace)
      )[0];

      const { makeTxBuilder } = await import('@helios-lang/tx-utils');
      const { makeValue } = await import('@helios-lang/ledger');

      const txBuilder = makeTxBuilder({ isMainnet: false });
      txBuilder.spendWithoutRedeemer(selectedUtxo);

      const value = makeValue(BigInt(500_000));
      txBuilder.payUnsafe(this.localPlayer!.walletInfo.address, value);

      // Send the flat message structure directly (crypto-demo format)
      const metadataJson = JSON.stringify(metadata);
      txBuilder.setMetadataAttributes({ 1337: metadataJson });

      txBuilder.validToTime(Date.now() + 3600000);
      const networkParams = await this.hydraClient.getNetworkParameters();
      const tx = await txBuilder.build({
        changeAddress: this.localPlayer!.walletInfo.address,
        networkParams,
        spareUtxos: []
      });

      // Suppress wallet signing logs
      const originalConsoleLog = console.log;
      const originalConsoleInfo = console.info;
      console.log = () => { };
      console.info = () => { };

      const signedTx = await this.localPlayer!.wallet.signTransaction(tx);

      // Restore console logging
      console.log = originalConsoleLog;
      console.info = originalConsoleInfo;

      return await this.hydraClient.submitTransaction(signedTx);
    } catch (error) {
      console.error('❌ Send failed:', error);
      return null;
    }
  }

  async selectLocalPlayer(): Promise<void> {
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

    // Suppress wallet loading logs
    const originalConsoleLog = console.log;
    const originalConsoleInfo = console.info;
    console.log = () => { };
    console.info = () => { };

    const wallet = await heliosWallet.load(selectedWalletId, {
      name: 'TicTacToePlayer',
      network: 'testnet',
      storageDir: './helios-wallets',
      hydraClient: this.hydraClient
    });

    // Restore console logging
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;

    const walletInfo = wallet.getWalletInfo();
    const playerName = this.generatePlayerName(walletInfo.address);

    this.localPlayer = {
      id: walletInfo.id,
      name: playerName,
      wallet,
      walletInfo
    };

    console.log(`✅ Ready: ${this.localPlayer.name}`);
    console.log(`   📍 Address: ${walletInfo.address}`);
    console.log(`   🆔 Wallet ID: ${walletInfo.id.substring(0, 12)}...`);
  }

  private showMenu(): void {
    console.log('\n📋 Tic-Tac-Toe Commands:');
    console.log('   create <gameId>           - Create new game');
    console.log('   join <gameId>             - Join existing game');
    console.log('   move <gameId> <row> <col> - Make a move (0-2)');
    console.log('   games                     - Show active games');
    console.log('   queue                     - Show message queue status');
    console.log('   clear                     - Clear processed messages');
    console.log('   help                      - Show this menu');
    console.log('   quit                      - Exit');
    this.showPrompt();
  }

  private showPrompt(): void {
    if (this.isRunning && !this.promptActive) {
      this.promptActive = true;
      this.rl.question('\n🎮 Command: ', (input) => {
        this.promptActive = false;
        this.handleCommand(input.trim());
      });
    }
  }

  private async handleCommand(input: string): Promise<void> {
    const parts = input.split(' ');
    const command = parts[0].toLowerCase();

    try {
      switch (command) {
        case 'create':
          await this.createGame(parts[1]);
          break;
        case 'join':
          await this.joinGame(parts[1]);
          break;
        case 'move':
          await this.makeMove(parts[1], parseInt(parts[2]), parseInt(parts[3]));
          break;
        case 'games':
          this.showGames();
          break;
        case 'queue':
          this.showQueueStatus();
          break;
        case 'clear':
          this.clearProcessedMessages();
          break;
        case 'help':
          this.showMenu();
          return;
        case 'quit':
          this.stopSystem();
          return;
        default:
          console.log('❓ Unknown command');
      }
    } catch (error) {
      console.error('❌ Command failed:', error);
    }

    this.showPrompt();
  }

  private async createGame(gameId: string): Promise<void> {
    if (!gameId) {
      console.log('❌ Usage: create <gameId>');
      return;
    }

    // Create local game instance
    const game: TicTacToeGame = {
      gameId,
      localPlayer: this.localPlayer!,
      createdBy: this.localPlayer!.id,
      createdAt: Date.now(),
      status: 'waiting-for-player',
      isLocalCreator: true,
      board: this.createEmptyBoard(),
      currentTurn: '',
      moveCount: 0,
      moveHistory: []
    };

    this.activeGames.set(gameId, game);

    const metadata = TicTacToeMessageBuilder.createGameCreateMessage(
      { id: this.localPlayer!.id, name: this.localPlayer!.name },
      gameId,
      this.sessionId
    );

    const txId = await this.sendGameMessage(metadata);
    if (txId) {
      console.log(`✅ Game created: ${gameId}`);
      console.log(`   ⏳ Waiting for another player to join...`);
    }
  }

  private async joinGame(gameId: string): Promise<void> {
    if (!gameId) {
      console.log('❌ Usage: join <gameId>');
      return;
    }

    // Create local game instance for the joining player
    // This ensures we have a game instance to update when we receive our own join message
    const game: TicTacToeGame = {
      gameId,
      localPlayer: this.localPlayer!,
      createdBy: '', // Will be set when we receive the game creation message
      createdAt: Date.now(),
      status: 'waiting-for-player',
      isLocalCreator: false,
      board: this.createEmptyBoard(),
      currentTurn: '',
      moveCount: 0,
      moveHistory: []
    };

    this.activeGames.set(gameId, game);

    // Add small delay to ensure local game instance is properly set up
    await new Promise(resolve => setTimeout(resolve, 100));

    const metadata = TicTacToeMessageBuilder.createGameJoinMessage(
      { id: this.localPlayer!.id, name: this.localPlayer!.name },
      gameId,
      this.sessionId
    );

    const txId = await this.sendGameMessage(metadata);
    if (txId) {
      console.log(`✅ Join request sent: ${gameId}`);
    }
  }

  private async makeMove(gameId: string, row: number, col: number): Promise<void> {
    if (!gameId || isNaN(row) || isNaN(col)) {
      console.log('❌ Usage: move <gameId> <row> <col>');
      return;
    }

    if (row < 0 || row > 2 || col < 0 || col > 2) {
      console.log('❌ Row and column must be between 0-2');
      return;
    }

    const game = this.activeGames.get(gameId);
    if (!game) {
      console.log('❌ Game not found');
      return;
    }

    if (game.status !== 'in-progress') {
      console.log('❌ Game is not in progress');
      console.log(`   🔍 Current game status: ${game.status}`);
      return;
    }

    if (game.currentTurn !== this.localPlayer!.id) {
      console.log('❌ Not your turn');
      return;
    }

    if (game.board[row][col] !== '') {
      console.log('❌ Position already occupied');
      return;
    }

    // Capture the move number BEFORE incrementing
    const moveNumber = game.moveCount + 1;

    // Make the move locally
    game.board[row][col] = game.localSymbol!;
    game.moveCount++;

    // Add to move history
    game.moveHistory.push({
      player: this.localPlayer!.id,
      symbol: game.localSymbol!,
      move: { row, col },
      moveNumber: moveNumber,
      timestamp: Date.now()
    });

    // Switch turn
    game.currentTurn = game.remotePlayer!.id;

    console.log(`\n🎯 You played ${game.localSymbol} at (${row}, ${col})`);
    this.displayBoard(game);

    // Check for winner
    const winner = this.checkWinner(game.board);
    if (winner) {
      this.endGame(game, winner);
    } else {
      console.log(`⏳ Waiting for ${game.remotePlayer!.name} to move...`);
    }

    // Send move to blockchain with the correct move number (before local increment)
    const metadata = TicTacToeMessageBuilder.createGameMoveMessage(
      { id: this.localPlayer!.id, name: this.localPlayer!.name },
      gameId,
      { row, col },
      moveNumber,
      game.board
    );

    const txId = await this.sendGameMessage(metadata);
    if (txId) {
      console.log(`   ✅ Move sent`);

      // Add retry logic for critical moves (like the 4th move)
      if (moveNumber >= 4) {
        this.monitorMoveConfirmation(gameId, moveNumber, txId);
      }
    }
  }

  private monitorMoveConfirmation(gameId: string, moveNumber: number, txId: string): void {
    // Set up a timeout to check if the move was processed
    setTimeout(() => {
      const game = this.activeGames.get(gameId);
      if (game && game.moveCount < moveNumber) {
        console.log(`   ⚠️  Move #${moveNumber} may not have been processed. Current count: ${game.moveCount}`);
        console.log(`   💡 Consider using 'queue' command to check message status`);
      }
    }, 10000); // Check after 10 seconds
  }

  private showGames(): void {
    console.log('\n🎮 Active Games:');

    if (this.activeGames.size === 0) {
      console.log('   No active games');
      return;
    }

    for (const [gameId, game] of this.activeGames) {
      console.log(`\n🆔 ${gameId}`);
      console.log(`   📊 Status: ${game.status.toUpperCase()}`);
      console.log(`   🏗️  Creator: ${game.isLocalCreator ? '✅ You' : '👤 ' + game.remotePlayer?.name}`);
      console.log(`   ⏰ Created: ${new Date(game.createdAt).toLocaleTimeString()}`);

      if (game.status === 'waiting-for-player') {
        console.log(`   ⏳ Waiting for another player to join`);
      } else if (game.status === 'assigning-players') {
        console.log(`   🎲 Assigning player symbols...`);
      } else if (game.status === 'in-progress') {
        console.log(`   🎯 Your Symbol: ${game.localSymbol}`);
        console.log(`   🎯 Their Symbol: ${game.remoteSymbol}`);
        console.log(`   ⏰ Current Turn: ${game.currentTurn === this.localPlayer!.id ? 'YOUR TURN' : game.remotePlayer?.name}`);
        console.log(`   📊 Move Count: ${game.moveCount}`);

        this.displayBoard(game);

        if (game.currentTurn === this.localPlayer!.id) {
          console.log(`   💡 Use 'move ${gameId} <row> <col>' to play`);
        }
      } else if (game.status === 'completed') {
        console.log(`   🏁 Game Complete!`);
        if (game.winner === 'draw') {
          console.log(`   🤝 Result: Draw`);
        } else {
          const winnerName = game.winner === game.localSymbol ? this.localPlayer?.name : game.remotePlayer?.name;
          console.log(`   🏆 Winner: ${winnerName} (${game.winner})`);
        }
        console.log(`   📊 Total moves: ${game.moveCount}`);

        this.displayBoard(game);
      }

      console.log(`   ${'─'.repeat(40)}`);
    }
  }

  private showQueueStatus(): void {
    const stats = this.transactionMonitor.getStatistics();
    console.log('\n📊 Message Queue Status:');
    console.log(`   Total Messages: ${stats.messageCount}`);
    console.log(`   Unprocessed: ${stats.unprocessedCount}`);
    console.log(`   Processed: ${stats.processedCount}`);
    console.log(`   Message Types: ${Object.keys(stats.messageTypes).join(', ')}`);
    console.log(`   Connection Status: ${stats.connected ? 'Connected' : 'Disconnected'}`);

    // Show recent messages from the queue
    const messageQueue = this.transactionMonitor.getMessageQueue();
    if (messageQueue.length > 0) {
      console.log(`   Recent Messages (last 5):`);
      const recentMessages = messageQueue.slice(-5);
      recentMessages.forEach((msg: any) => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        console.log(`   🔍 ${msg.id.substring(0, 8)}... - ${msg.messageType} (${time})`);
      });
    } else {
      console.log('   No messages in queue.');
    }
  }

  private clearProcessedMessages(): void {
    this.transactionMonitor.clearProcessedMessages();
    console.log('\n✅ Cleared all processed messages from the queue.');
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

async function runTicTacToeDemo(): Promise<void> {
  const demo = new TicTacToeDemo();
  await demo.start();
}

runTicTacToeDemo().catch(console.error); 