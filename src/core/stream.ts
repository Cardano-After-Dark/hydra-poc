import { Logger } from '../utils/logger';
import { getConfig } from '../utils/config';

const logger = Logger.getInstance();

export class HydraStream {
  private ws: WebSocket;
  private url: string;
  private messageCallback: (message: any) => void;
  private errorCallback: (error: Error) => void;

  constructor(
    url: string = "ws://127.0.0.1:4002",
    messageCallback: (message: any) => void,
    errorCallback: (error: Error) => void
  ) {
    this.url = url;
    this.messageCallback = messageCallback;
    this.errorCallback = errorCallback;
    this.ws = new WebSocket(this.url);
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    this.ws.onopen = () => {
      logger.info("WebSocket connection established");
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.messageCallback(message);
      } catch (error) {
        logger.error("Error parsing WebSocket message:", error);
        this.errorCallback(error as Error);
      }
    };

    this.ws.onerror = (event) => {
      const error = new Error(`WebSocket error: ${event.type}`);
      logger.error("WebSocket error:", error);
      this.errorCallback(error);
    };

    this.ws.onclose = (event) => {
      logger.info("WebSocket connection closed:", event.code, event.reason);
      // Attempt to reconnect after a delay
      setTimeout(() => {
        logger.info("Attempting to reconnect...");
        this.ws = new WebSocket(this.url);
        this.setupWebSocket();
      }, 5000);
    };
  }

  public close(): void {
    this.ws.close();
  }
}

// Example usage:
export function startStream(
  onMessage: (message: any) => void,
  onError: (error: Error) => void
): HydraStream {
  const config = getConfig();
  const stream = new HydraStream(
    `ws://127.0.0.1:${config.aliceApiPort}`,
    onMessage,
    onError
  );
  return stream;
}
