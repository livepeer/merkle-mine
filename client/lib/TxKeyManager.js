const Web3 = require("web3")
const keythereum = require("keythereum")
const ethUtil = require("ethereumjs-util")
const EthTx = require("ethereumjs-tx")

module.exports = class TxKeyManager {
    constructor(dataDir, address) {
        this.dataDir = dataDir
        this.address = address
    }

    getAddress() {
        return this.address
    }

    unlock(password) {
        const keyObj = keythereum.importFromFile(this.address.toLowerCase(), this.dataDir)
        this.privKey = keythereum.recover(password, keyObj)
    }

    clear() {
        this.privKey = null
    }

    getPrivKey() {
        if (this.privKey === undefined) {
            throw new Error("Account must be unlocked to use keys")
        }

        return this.privKey
    }

    signTransaction(txObj) {
        const rawTx = {
            nonce: Web3.utils.toHex(txObj.nonce),
            gasPrice: Web3.utils.toHex(txObj.gasPrice),
            gasLimit: Web3.utils.toHex(txObj.gasLimit),
            to: txObj.to,
            value: Web3.utils.toHex(txObj.value),
            data: txObj.data,
            chainId: txObj.chainId
        }

        const tx = new EthTx(rawTx)

        tx.sign(this.getPrivKey())

        return "0x" + tx.serialize().toString("hex")
    }
}
