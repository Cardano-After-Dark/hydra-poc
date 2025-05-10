import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from './config';

/*
OLD LOGGER
OLD LOGGER
OLD LOGGER
*/


export class Logger {
  private static instance: Logger;
  private debugMode: boolean;
  private logFile: string;
  private logStream: fs.WriteStream;

  private constructor() {
    this.debugMode = process.env.DEBUG === 'true';
    const config = getConfig();
    const logsDir = path.join(config.projectRoot, 'logs');
    
    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logsDir, `hydra-messages-${timestamp}.log`);
    this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    
    // Write initial log entry
    this.logStream.write(`\n=== Log started at ${new Date().toISOString()} ===\n\n`);
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
    ).join(' ');
    return `[${timestamp}] [${level}] ${message} ${formattedArgs}\n`;
  }

  public info(message: string, ...args: any[]): void {
    const logMessage = this.formatMessage('INFO', message, ...args);
    this.logStream.write(logMessage);
    // Only show specific messages in console for TUI
    if (message === "Message sent successfully!") {
      console.log('✓ Message sent!');
    }
  }

  public warn(message: string, ...args: any[]): void {
    const logMessage = this.formatMessage('WARN', message, ...args);
    this.logStream.write(logMessage);
    console.warn('⚠️', message);
  }

  public error(message: string, ...args: any[]): void {
    const logMessage = this.formatMessage('ERROR', message, ...args);
    this.logStream.write(logMessage);
    console.error('❌', message);
  }

  public debug(message: string, ...args: any[]): void {
    if (this.debugMode) {
      const logMessage = this.formatMessage('DEBUG', message, ...args);
      this.logStream.write(logMessage);
    }
  }

  public close(): void {
    this.logStream.end();
  }
} 