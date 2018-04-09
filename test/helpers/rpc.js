module.exports = class RPC {
    constructor(web3) {
        this.web3 = web3
    }

    sendAsync(method, arg) {
        const req = {
            jsonrpc: "2.0",
            method: method,
            id: new Date().getTime()
        }

        if (arg) req.params = arg

        return new Promise((resolve, reject) => {
            return this.web3.currentProvider.sendAsync(req, (err, result) => {
                if (err) {
                    reject(err)
                } else if (result && result.error) {
                    reject(new Error("RPC Error: " + (result.error.message || result.error)))
                } else {
                    resolve(result)
                }
            })
        })
    }

    // Change block time using TestRPC call evm_setTimestamp
    // https://github.com/numerai/contract/blob/master/test/numeraire.js
    increaseTime(time) {
        return this.sendAsync("evm_increaseTime", [time])
    }

    mine() {
        return this.sendAsync("evm_mine")
    }

    snapshot() {
        return this.sendAsync("evm_snapshot")
            .then(res => res.result)
    }

    revert(snapshotId) {
        return this.sendAsync("evm_revert", [snapshotId])
    }

    async wait(blocks = 1, seconds = 20) {
        let currentBlock = await this.getBlockNumberAsync()
        const targetBlock = currentBlock + blocks
        await this.waitUntilBlock(targetBlock, seconds)
    }

    async waitUntilBlock(targetBlock, seconds = 20) {
        let currentBlock = await this.getBlockNumberAsync()

        while (currentBlock < targetBlock) {
            await this.increaseTime(seconds)
            await this.mine()
            currentBlock++
        }
    }

    getBlockNumberAsync() {
        return new Promise((resolve, reject) => {
            return this.web3.eth.getBlockNumber((err, blockNum) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(blockNum)
                }
            })
        })
    }
}
