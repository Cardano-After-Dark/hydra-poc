export interface UtxoValue {
  address: string;
  datum: null;
  datumhash: null;
  inlineDatum: null;
  inlineDatumRaw: null;
  referenceScript: null;
  value: {
    lovelace: number;
    assets?: Record<string, number>;
  };
}

export interface Utxos {
  [key: string]: UtxoValue;
} 