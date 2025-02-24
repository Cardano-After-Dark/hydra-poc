import { readFileSync } from 'fs'
import { CardanoClient, makeSimpleWallet, makeBip32PrivateKey } from '@helios-lang/tx-utils'



function createWalletFromCliKeys(skPath: string, cardanoClient: CardanoClient) {
    // Read the signing key file
    const skJson = JSON.parse(readFileSync(skPath, 'utf8'))
    const skCborHex = skJson.cborHex

    // Convert the CBOR hex string to bytes
    const skCborBytes = Buffer.from(skCborHex, 'hex')
    
    // Convert the CBOR bytes to a Bip32PrivateKey
    const spendingPrivateKey = makeBip32PrivateKey(Array.from(skCborBytes))
    
    // Create the wallet using the existing makeSimpleWallet function
    // Using the 3-argument version: spendingPrivateKey, stakingPrivateKey (undefined), client
    return makeSimpleWallet(spendingPrivateKey, undefined, cardanoClient)
}

// Usage:
// const client: CardanoClient = {
//     network: "preprod",
//     socketPath: process.env.CARDANO_NODE_SOCKET_PATH || "/path/to/node.socket"
// };

// const wallet = createWalletFromCliKeys("path/to/payment.sk", client)
