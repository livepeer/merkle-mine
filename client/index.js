const Web3 = require("web3")
const prompt = require("prompt-sync")()
const TxKeyManager = require("./lib/TxKeyManager")
const MerkleMineGenerator = require("./lib/MerkleMineGenerator")
const { makeTree } = require("./lib/helpers")

const argv = require("yargs")
      .usage("Usage: $0 --rinkeby --dev --generate --acctFile [accounts file] --datadir [data directory] --merkleMine [MerkleMine address] --recipient [recipient address] --caller [caller address] --gasPrice [gas price]")
      .boolean(["rinkeby", "dev", "generate"])
      .string(["merkleMine", "recipient", "caller"])
      .default("gasPrice", 5000000000)
      .demandOption(["acctFile", "merkleMine", "recipient"])
      .implies("generate", ["datadir", "caller"])
      .argv

const main = async () => {
    let provider

    if (argv.dev) {
        provider = new Web3.providers.HttpProvider("http://localhost:8545")
    } else if (argv.rinkeby) {
        provider = new Web3.providers.HttpProvider("https://rinkeby.infura.io")
    } else {
        provider = new Web3.providers.HttpProvider("https://mainnet.infura.io")
    }

    console.log(`Creating Merkle tree with accounts in file: ${argv.acctFile}`)
    const merkleTree = await makeTree(argv.acctFile)
    console.log(`Created Merkle tree with root ${merkleTree.getHexRoot()}`)

    const gen = new MerkleMineGenerator(provider, merkleTree, argv.merkleMine, argv.recipient)

    try {
        await gen.performChecks()
    } catch (err) {
        console.log("Some checks failed - see below for more details. Please visit livepeer.org to learn how to start participating in the Livepeer network and earning tokens.\n")
        console.error(err)
        return
    }

    if (argv.generate) {
        try {
            console.log(`You must provide a password to unlock your caller account ${argv.caller}`)
            const password = prompt("Password: ", { echo: "" })

            const txKeyManager = new TxKeyManager(argv.datadir, argv.caller)
            await txKeyManager.unlock(password)
            console.log(`Unlocked caller account ${argv.caller}`)

            await gen.submitProof(txKeyManager, argv.caller, argv.gasPrice)

            console.log("You have successfully generated Livepeer Token! Visit explorer.livepeer.org to use use your token in the Livepeer delegation protocol.")
        } catch (err) {
            console.error(err)
            return
        }
    }
}

main()
