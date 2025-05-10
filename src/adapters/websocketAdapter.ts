import logger from '../utils/debugLogger';
import { SignedTransaction } from '../core/types/transaction';

export class WebSocketAdapter {
  private websocketUrl: string;
  private ws: WebSocket | null = null;
  private connectionTimeout: number = 5000;

  constructor(websocketUrl: string = "ws://127.0.0.1:4001") {
    this.websocketUrl = websocketUrl;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        logger.debug("Creating WebSocket connection", {
          connection: { url: this.websocketUrl }
        });

        this.ws = new WebSocket(this.websocketUrl);
        
        const timeout = setTimeout(() => {
          logger.error("WebSocket connection timeout", {
            connection: { 
              url: this.websocketUrl, 
              timeout: this.connectionTimeout,
              state: this.ws?.readyState
            }
          });
          this.ws?.close();
          reject(new Error("WebSocket connection timeout"));
        }, this.connectionTimeout);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          logger.info("WebSocket connection established", {
            connection: { 
              url: this.websocketUrl, 
              protocol: this.ws?.protocol,
              state: this.ws?.readyState
            }
          });
          resolve();
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          logger.error("WebSocket error:", {
            error: { 
              message: error.message,
              type: error.type,
              target: error.target ? 'WebSocket' : 'Unknown'
            },
            connection: {
              state: this.ws?.readyState
            }
          }, error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          logger.debug("WebSocket closed", {
            connection: {
              code: event.code,
              reason: event.reason,
              wasClean: event.wasClean,
              state: this.ws?.readyState
            }
          });
        };

      } catch (connectionError: any) {
        logger.error("Failed to create WebSocket connection:", {
          error: { 
            message: connectionError.message, 
            stack: connectionError.stack,
            type: connectionError.type
          }
        }, connectionError);
        reject(connectionError);
      }
    });
  }

  async sendTransaction(signedTx: SignedTransaction): Promise<void> {
    if (!this.ws) {
      throw new Error("WebSocket not connected");
    }

    const message = {
      tag: "NewTx",
      transaction: signedTx,
    };

    try {
      logger.info("Sending transaction...", {
        transaction: { type: signedTx.type }
      });
      this.ws.send(JSON.stringify(message));
    } catch (sendError: any) {
      logger.error("Error sending transaction:", {
        error: { 
          message: sendError.message, 
          stack: sendError.stack,
          type: sendError.type
        },
        connection: {
          state: this.ws.readyState
        }
      }, sendError);
      throw sendError;
    }
  }

  async close(): Promise<void> {
    if (this.ws) {
      logger.info("Closing WebSocket connection", {
        connection: { 
          url: this.websocketUrl,
          state: this.ws.readyState
        }
      });
      this.ws.close();
      logger.info("WebSocket connection closed", {
        connection: { 
          url: this.websocketUrl,
          state: this.ws.readyState
        }
      });
    }
  }

  setConnectionTimeout(timeout: number): void {
    this.connectionTimeout = timeout;
  }
} 