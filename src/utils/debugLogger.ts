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

export class DebugLogger {
  private static instance: DebugLogger;
  private currentLevel: LogLevel;
  private isDebugMode: boolean;

  private constructor() {
    // More reliable debug mode detection
    this.isDebugMode = this.detectDebugMode();
    
    // In debug mode, show everything. In normal mode, only INFO and above
    this.currentLevel = this.isDebugMode ? LogLevel.DEBUG : LogLevel.INFO;
    
    // Log the debug mode status at initialization
    if (this.isDebugMode) {
      console.log(`[DebugLogger] Debug mode ENABLED - showing all log levels`);
    } else {
      console.log(`[DebugLogger] Debug mode DISABLED - showing INFO and above only`);
    }
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
   * Format and output a log message
   */
  private log(level: LogLevel, levelName: string, message: string, ...args: any[]): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    
    // Get the call stack to find where the logger was called from
    const stack = new Error().stack || '';
    const stackLines = stack.split('\n');
    // Skip the first 3 lines (Error, log method, and the specific log level method)
    const callerInfo = stackLines.length > 3 ? stackLines[3].trim() : 'unknown';
    
    // Format with timestamp, level and caller information
    const formattedMessage = `[${timestamp}] [${levelName}] ${message}`;
    
    if (args.length > 0) {
      console.log(formattedMessage, ...args);
    } else {
      console.log(formattedMessage);
    }
    
    // For debug level, add caller information
    if (level === LogLevel.DEBUG && this.isDebugMode) {
      console.log(`  └─ called from: ${callerInfo}`);
    }
  }

  /**
   * Debug level logs - only shown in debug mode
   */
  public debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, ...args);
  }

  /**
   * Info level logs - shown in both modes
   */
  public info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, 'INFO', message, ...args);
  }

  /**
   * Warning level logs
   */
  public warning(message: string, ...args: any[]): void {
    this.log(LogLevel.WARNING, 'WARNING', message, ...args);
  }

  /**
   * Error level logs
   */
  public error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, 'ERROR', message, ...args);
  }

  /**
   * Critical error logs
   */
  public critical(message: string, ...args: any[]): void {
    this.log(LogLevel.CRITICAL, 'CRITICAL', message, ...args);
  }
}

// Export a default instance for easy import
export default DebugLogger.getInstance(); 