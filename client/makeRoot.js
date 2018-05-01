const { makeTree, getAccountsBuf } = require("./lib/helpers")

const argv = require("yargs")
      .usage("Usage: $0 --acctFile [accounts file]")
      .argv

const main = async () => {
    const accountsBuf = await getAccountsBuf(argv.acctFile)
    console.log("Retrieved accounts!")

    console.log("Creating Merkle tree...")
    const merkleTree = await makeTree(accountsBuf)
    console.log(`Created Merkle tree with root ${merkleTree.getHexRoot()} and ${merkleTree.getNumLeaves()} leaves`)
}

try {
    main()
} catch (err) {
    console.error(err)
}
