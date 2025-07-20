/**
 * Advanced Logging System for AI-Assisted Development
 * Provides comprehensive runtime visibility and debugging capabilities
 */

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  stack?: string;
  source?: string;
  executionContext?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  enableColors: boolean;
  enableTimestamps: boolean;
  enableStackTrace: boolean;
  enableRuntimeInspection: boolean;
  outputFormat: 'json' | 'pretty' | 'compact';
}

class AdvancedLogger {
  private config: LoggerConfig;
  private logHistory: LogEntry[] = [];
  private startTime: number = Date.now();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.DEBUG,
      enableColors: true,
      enableTimestamps: true,
      enableStackTrace: false,
      enableRuntimeInspection: true,
      outputFormat: 'pretty',
      ...config
    };
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const colors = {
      [LogLevel.TRACE]: '\x1b[90m',    // Gray
      [LogLevel.DEBUG]: '\x1b[36m',    // Cyan
      [LogLevel.INFO]: '\x1b[32m',     // Green
      [LogLevel.WARN]: '\x1b[33m',     // Yellow
      [LogLevel.ERROR]: '\x1b[31m',    // Red
      [LogLevel.FATAL]: '\x1b[35m'     // Magenta
    };

    const reset = '\x1b[0m';
    const levelNames = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    
    let formatted = '';

    if (this.config.enableTimestamps) {
      const elapsed = Date.now() - this.startTime;
      formatted += `[${new Date().toISOString()}] [+${elapsed}ms] `;
    }

    const levelName = levelNames[level];
    if (this.config.enableColors) {
      formatted += `${colors[level]}[${levelName}]${reset} `;
    } else {
      formatted += `[${levelName}] `;
    }

    formatted += message;

    if (data !== undefined) {
      if (this.config.outputFormat === 'json') {
        formatted += '\n' + JSON.stringify(data, null, 2);
      } else if (this.config.outputFormat === 'pretty') {
        formatted += '\n📊 Data: ' + this.prettyPrint(data);
      } else {
        formatted += ` | Data: ${JSON.stringify(data)}`;
      }
    }

    return formatted;
  }

  private prettyPrint(obj: any, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj === 'string') return `"${obj}"`;
    if (typeof obj === 'number' || typeof obj === 'boolean') return obj.toString();
    
    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      let result = '[\n';
      obj.forEach((item, index) => {
        result += `${spaces}  ${index}: ${this.prettyPrint(item, indent + 1)}`;
        if (index < obj.length - 1) result += ',';
        result += '\n';
      });
      result += `${spaces}]`;
      return result;
    }
    
    if (typeof obj === 'object') {
      const keys = Object.keys(obj);
      if (keys.length === 0) return '{}';
      let result = '{\n';
      keys.forEach((key, index) => {
        result += `${spaces}  ${key}: ${this.prettyPrint(obj[key], indent + 1)}`;
        if (index < keys.length - 1) result += ',';
        result += '\n';
      });
      result += `${spaces}}`;
      return result;
    }
    
    return obj.toString();
  }

  private getStackTrace(): string {
    const stack = new Error().stack || '';
    return stack.split('\n').slice(3).join('\n'); // Remove first 3 lines (Error, this function, caller)
  }

  private getExecutionContext(): string {
    const stack = new Error().stack || '';
    const lines = stack.split('\n');
    const callerLine = lines[4] || ''; // Get the actual caller context
    const match = callerLine.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/);
    if (match) {
      return `${match[1]} @ ${match[2]}:${match[3]}`;
    }
    return 'unknown';
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.config.level) return;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      source: this.getExecutionContext()
    };

    if (this.config.enableStackTrace) {
      logEntry.stack = this.getStackTrace();
    }

    if (this.config.enableRuntimeInspection) {
      logEntry.executionContext = this.getExecutionContext();
    }

    this.logHistory.push(logEntry);

    // Output to console
    const formatted = this.formatMessage(level, message, data);
    console.log(formatted);

    if (this.config.enableStackTrace && level >= LogLevel.ERROR) {
      console.log('📍 Stack Trace:', logEntry.stack);
    }
  }

  // Public logging methods
  public trace(message: string, data?: any): void {
    this.log(LogLevel.TRACE, `🔍 ${message}`, data);
  }

  public debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, `🐛 ${message}`, data);
  }

  public info(message: string, data?: any): void {
    this.log(LogLevel.INFO, `ℹ️  ${message}`, data);
  }

  public warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, `⚠️  ${message}`, data);
  }

  public error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, `❌ ${message}`, data);
  }

  public fatal(message: string, data?: any): void {
    this.log(LogLevel.FATAL, `💀 ${message}`, data);
  }

  // Special methods for AI development
  public functionEntry(functionName: string, args?: any): void {
    this.debug(`→ Entering function: ${functionName}`, { arguments: args });
  }

  public functionExit(functionName: string, result?: any): void {
    this.debug(`← Exiting function: ${functionName}`, { result });
  }

  public stateSnapshot(label: string, state: any): void {
    this.info(`📸 State Snapshot: ${label}`, state);
  }

  public performance(label: string, startTime: number): void {
    const duration = Date.now() - startTime;
    this.info(`⏱️  Performance: ${label} took ${duration}ms`);
  }

  public heliosCall(operation: string, input?: any, output?: any): void {
    this.debug(`🏛️  Helios Operation: ${operation}`, { input, output });
  }

  public testResult(testName: string, passed: boolean, details?: any): void {
    const emoji = passed ? '✅' : '❌';
    this.info(`${emoji} Test: ${testName}`, { passed, details });
  }

  // Utility methods for debugging
  public getLogHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  public clearHistory(): void {
    this.logHistory = [];
  }

  public exportLogs(): string {
    return JSON.stringify(this.logHistory, null, 2);
  }

  public filterLogs(level: LogLevel): LogEntry[] {
    return this.logHistory.filter(entry => entry.level >= level);
  }

  public getErrorSummary(): LogEntry[] {
    return this.filterLogs(LogLevel.ERROR);
  }

  public setLevel(level: LogLevel): void {
    this.config.level = level;
    this.info(`Logger level changed to: ${LogLevel[level]}`);
  }

  public enableDebugMode(): void {
    this.config.level = LogLevel.TRACE;
    this.config.enableStackTrace = true;
    this.config.enableRuntimeInspection = true;
    this.info('🔬 Debug mode enabled - maximum visibility');
  }
}

// Global logger instance
export const logger = new AdvancedLogger();

// Helper function to create child loggers with different configs
export function createLogger(config: Partial<LoggerConfig>): AdvancedLogger {
  return new AdvancedLogger(config);
}

// Decorator for automatic function logging
export function loggedFunction(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = function (...args: any[]) {
    logger.functionEntry(propertyName, args);
    const startTime = Date.now();
    
    try {
      const result = method.apply(this, args);
      
      if (result instanceof Promise) {
        return result
          .then(res => {
            logger.performance(propertyName, startTime);
            logger.functionExit(propertyName, res);
            return res;
          })
          .catch(err => {
            logger.error(`Function ${propertyName} failed`, err);
            throw err;
          });
      } else {
        logger.performance(propertyName, startTime);
        logger.functionExit(propertyName, result);
        return result;
      }
    } catch (error) {
      logger.error(`Function ${propertyName} failed`, error);
      throw error;
    }
  };

  return descriptor;
} 