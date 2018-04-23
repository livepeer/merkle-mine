const { makeTree } = require("./lib/helpers")

const argv = require("yargs")
      .usage("Usage: $0 --acctFile [accounts file]")
      .demandOption(["acctFile"])
      .argv

const main = async () => {
    console.log(`Creating Merkle tree with accounts in file: ${argv.acctFile}`)
    const merkleTree = await makeTree(argv.acctFile)
    console.log(`Created Merkle tree with root ${merkleTree.getHexRoot()} and ${merkleTree.getNumLeaves()} leaves`)
}

try {
    main()
} catch (err) {
    console.error(err)
}
