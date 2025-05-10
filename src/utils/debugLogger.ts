/**
 * A custom logger utility that behaves like Python's logging module.
 * - In debug mode: Shows all logs including debug-level logs
 * - In normal mode: Only shows info level and above
 */

// Log levels similar to Python's logging
export enum LogLevel {
  DEBUG = 10,
  INFO = 20,
  WARNING = 30,
  ERROR = 40,
  CRITICAL = 50
}

// ANSI color codes for terminal output
const COLORS = {
  RESET: '\x1b[0m',
  DEBUG: '\x1b[36m',    // Cyan
  INFO: '\x1b[32m',     // Green
  WARNING: '\x1b[33m',  // Yellow
  ERROR: '\x1b[31m',    // Red
  CRITICAL: '\x1b[35m', // Magenta
  TIMESTAMP: '\x1b[90m', // Gray
  CALLER: '\x1b[90m',   // Gray
  SEPARATOR: '\x1b[90m', // Gray
  SECTION: '\x1b[1m\x1b[36m', // Bold Cyan
  ATTRIBUTE: '\x1b[33m' // Yellow
};

// Logger configuration interface
export interface LoggerConfig {
  showTimestamp: boolean;
  showCallStack: boolean;
  showCpuTime: boolean;
  showSection: boolean;
  showAttributes: boolean;
  saveToFile: boolean;
  logFilePath?: string;
  maxCallStackDepth: number;
  attributes: {
    [key: string]: boolean;
  };
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  showTimestamp: true,
  showCallStack: true,
  showCpuTime: true,
  showSection: true,
  showAttributes: true,
  saveToFile: false,
  maxCallStackDepth: 5,
  attributes: {
    trace: true,
    performance: true,
    metadata: true,
    network: true,
    state: true
  }
};

import { spawn } from 'child_process';

export class DebugLogger {
  private static instance: DebugLogger;
  private currentLevel: LogLevel;
  private isDebugMode: boolean;
  private startCpuUsage: NodeJS.CpuUsage;
  private lastCpuUsage: NodeJS.CpuUsage;
  private config: LoggerConfig;
  private logFileStream?: NodeJS.WritableStream;
  private sessionId: string;
  private sessionStartTime: Date;
  private sessionStartCpu: NodeJS.CpuUsage;

  private constructor() {
    this.isDebugMode = this.detectDebugMode();
    this.currentLevel = this.isDebugMode ? LogLevel.DEBUG : LogLevel.INFO;
    this.startCpuUsage = process.cpuUsage();
    this.lastCpuUsage = this.startCpuUsage;
    this.config = { ...DEFAULT_CONFIG };
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = new Date();
    this.sessionStartCpu = process.cpuUsage();
    
    // Initialize file stream if saveToFile is enabled
    if (this.config.saveToFile && this.config.logFilePath) {
      this.initializeLogFile();
    }
    
    // Log session start
    this.logSessionStart();
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log session start
   */
  private logSessionStart(): void {
    const sessionHeader = [
      '\n',
      `${COLORS.SECTION}════════════════════════════════════════════════════════════════${COLORS.RESET}`,
      `${COLORS.SECTION}🔵 Debug Session Started${COLORS.RESET}`,
      `${COLORS.SECTION}Session ID: ${this.sessionId}${COLORS.RESET}`,
      `${COLORS.SECTION}Start Time: ${this.sessionStartTime.toISOString()}${COLORS.RESET}`,
      `${COLORS.SECTION}Debug Mode: ${this.isDebugMode ? 'ENABLED' : 'DISABLED'}${COLORS.RESET}`,
      `${COLORS.SECTION}════════════════════════════════════════════════════════════════${COLORS.RESET}`,
      '\n'
    ].join('\n');

    console.log(sessionHeader);
    if (this.config.saveToFile && this.logFileStream) {
      this.logFileStream.write(sessionHeader.replace(/\x1b\[[0-9;]*m/g, ''));
    }
  }

  /**
   * Log session end
   */
  public endSession(): void {
    if (!this.isDebugMode) return;

    const endTime = new Date();
    const duration = (endTime.getTime() - this.sessionStartTime.getTime()) / 1000;
    const cpuUsage = process.cpuUsage(this.sessionStartCpu);
    const totalCpuTime = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    const sessionEndMessage = [
      '='.repeat(64),
      '🔴 Debug Session Ended',
      `Session ID: ${this.sessionId}`,
      `End Time: ${endTime.toISOString()}`,
      `Duration: ${duration.toFixed(2)}s`,
      `Total CPU Time: ${totalCpuTime.toFixed(3)}s`,
      '='.repeat(64),
      '',
      'Stopping debugger...'
    ].join('\n');

    console.log(sessionEndMessage);

    // Simulate the debugger stop command
    if (process.platform === 'darwin') { // macOS
      spawn('osascript', [
        '-e',
        'tell application "System Events" to key code 89 using {option down}' // alt+numpad7
      ]);
    } else if (process.platform === 'win32') { // Windows
      spawn('powershell', [
        '-command',
        '[System.Windows.Forms.SendKeys]::SendWait("^{F5}")' // Ctrl+F5
      ]);
    } else { // Linux
      spawn('xdotool', ['key', 'alt+KP_7']); // alt+numpad7
    }

    // Add a small delay to allow the message to be read
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }

  /**
   * Initialize log file stream
   */
  private initializeLogFile(): void {
    if (this.config.logFilePath) {
      const fs = require('fs');
      this.logFileStream = fs.createWriteStream(this.config.logFilePath, { flags: 'a' });
    }
  }

  /**
   * Configure the logger
   */
  public configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.config.saveToFile && this.config.logFilePath && !this.logFileStream) {
      this.initializeLogFile();
    }
  }

  /**
   * Enable/disable specific attributes
   */
  public setAttribute(name: string, enabled: boolean): void {
    this.config.attributes[name] = enabled;
  }

  /**
   * Detect if we're running in debug mode
   */
  private detectDebugMode(): boolean {
    // Check for VS Code debugger
    if (process.env.VSCODE_INSPECTOR_OPTIONS) {
      return true;
    }

    // Check for Node.js debug flags
    if (process.execArgv.some(arg => 
      arg.includes('--inspect') || 
      arg.includes('--debug') || 
      arg.includes('--inspect-brk'))) {
      return true;
    }

    // Check for environment variable
    if (process.env.DEBUG === 'true' || process.env.NODE_DEBUG) {
      return true;
    }

    // Check for debugger statement in code
    try {
      // This will throw if we're not in debug mode
      debugger;
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get the singleton instance of the logger
   */
  public static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  /**
   * Set the minimum log level to display
   */
  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Check if a given log level should be displayed
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  /**
   * Convert CPU usage to seconds with 3 decimal places
   */
  private cpuUsageToSeconds(cpuUsage: NodeJS.CpuUsage): string {
    // Convert microseconds to seconds
    return ((cpuUsage.user + cpuUsage.system) / 1000000).toFixed(3);
  }

  /**
   * Calculate CPU time difference between two measurements
   */
  private getCpuTimeDiff(start: NodeJS.CpuUsage, end: NodeJS.CpuUsage): string {
    const diff = process.cpuUsage(start);
    return this.cpuUsageToSeconds(diff);
  }

  /**
   * Get the current call stack with file and line information
   */
  private getCallStack(): Array<{function: string, file: string, line: string}> {
    if (!this.config.showCallStack) return [];
    
    const stack = new Error().stack || '';
    const stackLines = stack.split('\n');
    const callStack: Array<{function: string, file: string, line: string}> = [];
    
    // Skip the first 3 lines and limit depth
    for (let i = 3; i < Math.min(stackLines.length, 3 + this.config.maxCallStackDepth); i++) {
      const line = stackLines[i].trim();
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        callStack.push({
          function: match[1],
          file: match[2].split('/').pop() || 'unknown',
          line: match[3]
        });
      }
    }
    
    return callStack;
  }

  /**
   * Format the call stack for display
   */
  private formatCallStack(callStack: Array<{function: string, file: string, line: string}>): string {
    if (!this.config.showCallStack || callStack.length === 0) return '';
    
    const stackLines = callStack.map((call, index) => {
      const indent = '  '.repeat(index);
      const arrow = index === 0 ? '└─' : '  └─';
      return `${indent}${COLORS.SEPARATOR}${arrow} ${COLORS.CALLER}${call.function} (${call.file}:${call.line})${COLORS.RESET}`;
    });
    
    return stackLines.join('\n');
  }

  /**
   * Format section header
   */
  private formatSection(section: string): string {
    if (!this.config.showSection) return '';
    return `\n${COLORS.SECTION}=== ${section} ===${COLORS.RESET}\n`;
  }

  /**
   * Format attributes
   */
  private formatAttributes(attributes: {[key: string]: any}): string {
    if (!this.config.showAttributes) return '';
    
    const enabledAttrs = Object.entries(attributes)
      .filter(([key]) => this.config.attributes[key])
      .map(([key, value]) => `${COLORS.ATTRIBUTE}${key}: ${JSON.stringify(value)}${COLORS.RESET}`)
      .join('\n');
    
    return enabledAttrs ? `\n${enabledAttrs}` : '';
  }

  private log(level: LogLevel, levelName: string, message: string, attributes: {[key: string]: any} = {}, ...args: any[]): void {
    if (!this.shouldLog(level)) return;

    const now = process.cpuUsage();
    const timestamp = new Date().toISOString();
    const totalCpu = this.getCpuTimeDiff(this.startCpuUsage, now);
    const sinceLastCpu = this.getCpuTimeDiff(this.lastCpuUsage, now);
    this.lastCpuUsage = now;
    
    // Get the current call stack
    const callStack = this.getCallStack();
    
    // Get color based on log level
    const color = COLORS[levelName as keyof typeof COLORS] || COLORS.RESET;
    
    // Format the message with emojis based on level
    const levelEmoji = {
      DEBUG: '🔍',
      INFO: 'ℹ️',
      WARNING: '⚠️',
      ERROR: '❌',
      CRITICAL: '💥'
    }[levelName];

    // Build the log message
    const logParts = [
      this.config.showTimestamp ? `${COLORS.TIMESTAMP}[${timestamp}]${COLORS.RESET}` : '',
      `${color}${levelEmoji} [${levelName}]${COLORS.RESET}`,
      `${color}${message}${COLORS.RESET}`,
      this.formatAttributes(attributes),
      this.formatCallStack(callStack),
      this.config.showCpuTime ? `\n${COLORS.SEPARATOR}  └─ ${COLORS.TIMESTAMP}CPU Time: ${totalCpu}s | Since last: ${sinceLastCpu}s${COLORS.RESET}` : ''
    ].filter(Boolean);

    const formattedMessage = logParts.join(' ');

    // Output to console
    if (args.length > 0) {
      console.log(formattedMessage, ...args);
    } else {
      console.log(formattedMessage);
    }

    // Save to file if enabled
    if (this.config.saveToFile && this.logFileStream) {
      const fileMessage = formattedMessage.replace(/\x1b\[[0-9;]*m/g, '') + '\n';
      this.logFileStream.write(fileMessage);
    }
  }

  // Log level methods with attributes
  public debug(message: string, attributes: {[key: string]: any} = {}, ...args: any[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, attributes, ...args);
  }

  public info(message: string, attributes: {[key: string]: any} = {}, ...args: any[]): void {
    this.log(LogLevel.INFO, 'INFO', message, attributes, ...args);
  }

  public warning(message: string, attributes: {[key: string]: any} = {}, ...args: any[]): void {
    this.log(LogLevel.WARNING, 'WARNING', message, attributes, ...args);
  }

  public error(message: string, attributes: {[key: string]: any} = {}, ...args: any[]): void {
    this.log(LogLevel.ERROR, 'ERROR', message, attributes, ...args);
  }

  public critical(message: string, attributes: {[key: string]: any} = {}, ...args: any[]): void {
    this.log(LogLevel.CRITICAL, 'CRITICAL', message, attributes, ...args);
  }

  /**
   * Cleanup method to be called when the application exits
   */
  public cleanup(): void {
    this.endSession();
  }
}

// Export a default instance for easy import
const logger = DebugLogger.getInstance();

// Handle process exit
process.on('exit', () => {
  logger.cleanup();
});

// Handle process termination
process.on('SIGINT', () => {
  logger.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.cleanup();
  process.exit(0);
});

export default logger; 