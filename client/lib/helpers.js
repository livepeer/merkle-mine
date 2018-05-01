const { promisify } = require("util")
const r2 = require("r2")
const fs = require("fs")
const MerkleTree = require("../../utils/merkleTree")
const { toBuffer, addHexPrefix } = require("ethereumjs-util")

const makeTree = async accountsBuf => {
    let accounts = []

    for (let i = 0; i < accountsBuf.length; i += 20) {
        const buf = Buffer.from(accountsBuf.slice(i, i + 20), "hex")

        accounts.push(buf)
    }

    return new MerkleTree(accounts)
}

const getAccountsBuf = async acctFile => {
    if (acctFile === undefined) {
        console.log("Accounts file not explicitly provided - defaulting to retrieving accounts from a IPFS gateway using hash QmQbvkaw5j8TFeeR7c5Cs2naDciUVq9cLWnV3iNEzE784r")

        const res = await r2.get("https://gateway.ipfs.io/ipfs/QmQbvkaw5j8TFeeR7c5Cs2naDciUVq9cLWnV3iNEzE784r").response
        return res.buffer()
    } else {
        console.log(`Using accounts in file: ${acctFile}`)
        return await promisify(fs.readFile)(acctFile)
    }
}

module.exports = {
    makeTree,
    getAccountsBuf
}
