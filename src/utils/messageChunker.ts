export interface MessageChunk {
  text: string;
  chunkIndex: number;
  totalChunks: number;
}

export function chunkMessage(message: string, maxChunkSize: number = 64): MessageChunk[] {
  if (message.length <= maxChunkSize) {
    return [{
      text: message,
      chunkIndex: 0,
      totalChunks: 1
    }];
  }

  const chunks: MessageChunk[] = [];
  const totalChunks = Math.ceil(message.length / maxChunkSize);
  
  for (let i = 0; i < message.length; i += maxChunkSize) {
    chunks.push({
      text: message.slice(i, i + maxChunkSize),
      chunkIndex: chunks.length,
      totalChunks
    });
  }

  return chunks;
} 