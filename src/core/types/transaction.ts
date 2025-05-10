export interface RawTransaction {
  type: string;
  description: string;
  cborHex: string;
}

export interface SignedTransaction {
  type: string;
  description: string;
  cborHex: string;
}

export interface TransactionInput {
  txHash: string;
  txIndex: number;
}

export interface TransactionOutput {
  address: string;
  amount: number;
}

export interface TransactionMetadata {
  [key: string]: any;
}

export interface Transaction {
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  metadata?: TransactionMetadata;
  fee?: number;
}

export interface CardanoCliConfig {
  network: string;
  era: string;
  protocolParamsFile: string;
} 