import { Transaction } from "@emurgo/cardano-serialization-lib-nodejs";

const txHex = '84a400d9010281825820817e92be01253b016ed400b96883ac9ddcb9d474d0bcab8bff554c66af69d43500018182581d603e7d858a785b81bc220389f544d06e642a04bcde0a35d9e6c5fa5f321a000f42400200075820adab167fd91306501996adec962efc2efdbab1647fdc36092e835ff41ef78f3fa100d901028182582039e429c758b430d7df8b2bbbc6406ac5060e14ae64bec2a95fbefba6d3a6f5a75840c06436fa5071a6083d6c5cb27e4ac045a7e29c4f6c9b13b74822535b750e366a31f1c3834de1b1166773b2c28d94269029307fa2e544e550d26f8fc0e9a41502f5d90103a100a1190539a2636d7367781a6f6820736f206974206973206e6f74206976656e207468657265666d73675f69646d31373435373937313935383633';

const metadataKey = '1337';

const tx = Transaction.from_bytes(Buffer.from(txHex, 'hex'));
const txValue = tx.to_js_value();

const metadata = txValue.auxiliary_data!.metadata as Record<string, any>;
// console.log(metadata);

function parseMetadataToObject(metadata: Record<string, any>, key: string): Record<string, string> {
    const rawData = JSON.parse(metadata.get(key)!);
    return rawData.map.reduce((acc: Record<string, string>, item: any) => {
        acc[item.k.string] = item.v.string;
        return acc;
    }, {});
}

const cleanObject = parseMetadataToObject(metadata, metadataKey);
console.log(cleanObject);