import { Logger } from '../utils/logger';
import { getConfig } from '../utils/config';

const logger = Logger.getInstance();

export class HydraStream {
  private ws: WebSocket;
  private url: string;
  private messageCallback: (message: any) => void;
  private errorCallback: (error: Error) => void;
  private connectedCallback?: () => void;

  constructor(
    url: string = "ws://127.0.0.1:4002",
    messageCallback: (message: any) => void,
    errorCallback: (error: Error) => void,
    connectedCallback?: () => void
  ) {
    this.url = url;
    this.messageCallback = messageCallback;
    this.errorCallback = errorCallback;
    this.connectedCallback = connectedCallback;
    this.ws = new WebSocket(this.url);
    this.setupWebSocket();
  }

  private setupWebSocket(): void {
    this.ws.onopen = () => {
      logger.info("WebSocket connection established");
      if (this.connectedCallback) {
        this.connectedCallback();
      }
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

/**
 * Start a WebSocket stream connection to the Hydra node
 * @param onMessage Callback for received messages
 * @param onError Callback for errors
 * @param onConnected Optional callback for when connection is established
 * @param customUrl Optional custom WebSocket URL (overrides config)
 * @returns HydraStream instance
 */
export function startStream(
  onMessage: (message: any) => void,
  onError: (error: Error) => void,
  onConnected?: () => void,
  customUrl?: string
): HydraStream {
  const config = getConfig();
  // Use custom URL if provided, otherwise use config
  const url = customUrl || `ws://127.0.0.1:${config.aliceApiPort}`;
  
  logger.info(`Starting WebSocket stream at ${url}`);
  
  const stream = new HydraStream(
    url,
    onMessage,
    onError,
    onConnected
  );
  return stream;
}
