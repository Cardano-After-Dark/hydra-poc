export class Logger {
  private static instance: Logger;
  private debugMode: boolean;

  private constructor() {
    this.debugMode = process.env.DEBUG === 'true';
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public info(message: string, ...args: any[]): void {
    console.log(`[INFO] ${message}`, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  public error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }

  public debug(message: string, ...args: any[]): void {
    if (this.debugMode) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
} 