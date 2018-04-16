const fs = require("fs")
const { promisify } = require("util")
const MerkleTree = require("../../utils/merkleTree")
const { toBuffer, addHexPrefix } = require("ethereumjs-util")

const makeTree = async accountsFile => {
    const data = await promisify(fs.readFile)(accountsFile)
    const accounts = data.toString().split("\n")
    const sortedAccounts = [...new Set(accounts)].map(acct => toBuffer(addHexPrefix(acct))).sort(Buffer.compare)

    return new MerkleTree(sortedAccounts)
}

module.exports = {
    makeTree
}
