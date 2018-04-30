const fs = require("fs")
const { promisify } = require("util")
const MerkleTree = require("../../utils/merkleTree")
const { toBuffer, addHexPrefix } = require("ethereumjs-util")

const makeTree = async accountsFile => {
    const data = await promisify(fs.readFile)(accountsFile)

    let accounts = []

    for (let i = 0; i < data.length; i += 20) {
        const buf = Buffer.from(data.slice(i, i + 20), "hex")

        accounts.push(buf)
    }

    return new MerkleTree(accounts)
}

module.exports = {
    makeTree
}
