import { Transaction } from "@emurgo/cardano-serialization-lib-nodejs";

const txHex = '84a400d90102818258208d6487308371279fe1e13c3971d5c3e3021578ad093703c4fd51a099756bbd9b00018182581d603e7d858a785b81bc220389f544d06e642a04bcde0a35d9e6c5fa5f321a000f42400200075820ac1b9e9b412354aaf813ed146a3fd6d28d00f1f9d260605bfeb914a9aa4d7e8ea100d901028182582039e429c758b430d7df8b2bbbc6406ac5060e14ae64bec2a95fbefba6d3a6f5a75840a97b2d0bb97762b9a9485fb7e11be47561bb513abd6d3fb5de98836f657ba37c9d33227d399d9837d9317fb78657205dca716e99c1b5099d35508aa841bd630ef5d90103a100a1190539a3636d73677748656c6c6f2066726f6d20746865207465726d696e616c666d73675f69646d313734353739333133353238306673656e646572783f616464725f746573743176716c386d707632307064637230707a7177796c3233787364656a7a357039756d633972746b30786368613937767375796e7a737a';

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