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
  SEPARATOR: '\x1b[90m' // Gray
};

export class DebugLogger {
  private static instance: DebugLogger;
  private currentLevel: LogLevel;
  private isDebugMode: boolean;
  private startCpuUsage: NodeJS.CpuUsage;
  private lastCpuUsage: NodeJS.CpuUsage;

  private constructor() {
    this.isDebugMode = this.detectDebugMode();
    this.currentLevel = this.isDebugMode ? LogLevel.DEBUG : LogLevel.INFO;
    this.startCpuUsage = process.cpuUsage();
    this.lastCpuUsage = this.startCpuUsage;
    
    // Log the debug mode status at initialization
    if (this.isDebugMode) {
      console.log(`${COLORS.DEBUG}⚡ Debug mode ENABLED - showing all log levels${COLORS.RESET}`);
    } else {
      console.log(`${COLORS.INFO}ℹ️ Debug mode DISABLED - showing INFO and above only${COLORS.RESET}`);
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
   * Format and output a log message
   */
  private log(level: LogLevel, levelName: string, message: string, ...args: any[]): void {
    if (!this.shouldLog(level)) return;

    const now = process.cpuUsage();
    const timestamp = new Date().toISOString();
    const totalCpu = this.getCpuTimeDiff(this.startCpuUsage, now);
    const sinceLastCpu = this.getCpuTimeDiff(this.lastCpuUsage, now);
    this.lastCpuUsage = now;
    
    // Get the call stack to find where the logger was called from
    const stack = new Error().stack || '';
    const stackLines = stack.split('\n');
    const callerInfo = stackLines.length > 3 ? stackLines[3].trim() : 'unknown';
    
    // Extract file and line number from caller info
    const callerMatch = callerInfo.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
    const callerDetails = callerMatch ? {
      function: callerMatch[1],
      file: callerMatch[2].split('/').pop(),
      line: callerMatch[3]
    } : { function: 'unknown', file: 'unknown', line: '0' };

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

    // Format with timestamp, level and caller information
    const formattedMessage = [
      `${COLORS.TIMESTAMP}[${timestamp}]${COLORS.RESET}`,
      `${color}${levelEmoji} [${levelName}]${COLORS.RESET}`,
      `${color}${message}${COLORS.RESET}`,
      args.length > 0 ? args : '',
      `\n${COLORS.SEPARATOR}  └─ ${COLORS.CALLER}${callerDetails.function} (${callerDetails.file}:${callerDetails.line})${COLORS.RESET}`,
      `\n${COLORS.SEPARATOR}  └─ ${COLORS.TIMESTAMP}CPU Time: ${totalCpu}s | Since last: ${sinceLastCpu}s${COLORS.RESET}`
    ].join(' ');

    if (args.length > 0) {
      console.log(formattedMessage, ...args);
    } else {
      console.log(formattedMessage);
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