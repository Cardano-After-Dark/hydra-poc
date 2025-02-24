import { Transaction } from "@emurgo/cardano-serialization-lib-nodejs";

const txHex = "84a400d901028182582034fb83c77b31ee106444b97858cbaddc61be3906c06896a3d93b01b432a4132501018282581d60c8fbebedd2df46fc1f78a7829e2d3c5851c025b7d66c3fcac7a11c1d1a000f424082581d603e7d858a785b81bc220389f544d06e642a04bcde0a35d9e6c5fa5f321a3b7c458002000758201869080c46a0e247652082cf2d057b39afa70f7a445ec138596777bb5a05db23a100d901028182582039e429c758b430d7df8b2bbbc6406ac5060e14ae64bec2a95fbefba6d3a6f5a75840879ed82260967a9a1b54bdf11d60425e11507f132a6d0dfc562fe6da163f6eb2688df72ed28cc7e70ab32830f51aa97e4d8862e0e1d5f8d2817e821f0f72c602f5d90103a100a1190539a46673656e64657265616c696365676d6573736167656e546869732069732061207465737469726563697069656e7463626f626974696d657374616d7074323032352d30322d32335432323a30323a35335a";

const metadataKey = '1337';

const tx = Transaction.from_bytes(Buffer.from(txHex, 'hex'));
const txValue = tx.to_js_value();
const metadata = txValue.auxiliary_data!.metadata as Record<string, any>;

function parseMetadataToObject(metadata: Record<string, any>, key: string): Record<string, string> {
    const rawData = JSON.parse(metadata.get(key)!);
    return rawData.map.reduce((acc: Record<string, string>, item: any) => {
        acc[item.k.string] = item.v.string;
        return acc;
    }, {});
}

const cleanObject = parseMetadataToObject(metadata, metadataKey);
console.log(cleanObject);