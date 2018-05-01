const Web3 = require("web3")
const prompt = require("prompt-sync")()
const TxKeyManager = require("./lib/TxKeyManager")
const MerkleMineGenerator = require("./lib/MerkleMineGenerator")
const { makeTree, getAccountsBuf } = require("./lib/helpers")

const argv = require("yargs")
      .usage("Usage: $0 --rinkeby --dev --generate --acctFile [accounts file] --datadir [data directory] --merkleMine [MerkleMine address] --recipient [recipient address] --caller [caller address] --gasPrice [gas price]")
      .boolean(["rinkeby", "dev", "generate"])
      .string(["merkleMine", "recipient", "caller"])
      .default("gasPrice", 5000000000)
      .demandOption(["recipient"])
      .implies("generate", ["datadir", "caller"])
      .argv

const main = async () => {
    let provider

    if (argv.dev) {
        provider = new Web3.providers.HttpProvider("http://localhost:8545")

        if (argv.merkleMine === undefined || argv.acctFile === undefined) {
            console.error("Must provide both MerkleMine contract address and accounts file when using a custom development network")
            return
        }

        console.log("Using localhost:8545")
    } else if (argv.rinkeby) {
        provider = new Web3.providers.HttpProvider("https://rinkeby.infura.io")

        if (argv.merkleMine === undefined || argv.acctFile === undefined) {
            console.error("Must provide both MerkleMine contract address and accounts file when using the Rinkeby Ethereum test network")
            return
        }

        console.log("Using the Rinkeby Ethereum test network")
    } else {
        provider = new Web3.providers.HttpProvider("https://mainnet.infura.io")

        if (argv.merkleMine === undefined) {
            // Default to known MerkleMine contract address on mainnet
            argv.merkleMine = "0x8e306b005773bee6ba6a6e8972bc79d766cc15c8"
        }

        console.log("Using the Ethereum main network")
    }

    const accountsBuf = await getAccountsBuf(argv.acctFile)
    console.log("Retrieved accounts!")

    console.log("---------------------------------------")

    console.log(`Using MerkleMine contract ${argv.merkleMine}`)

    console.log("Creating Merkle tree...")
    const merkleTree = await makeTree(accountsBuf)
    console.log(`Created Merkle tree with root ${merkleTree.getHexRoot()} and ${merkleTree.getNumLeaves()} leaves`)

    const gen = new MerkleMineGenerator(provider, merkleTree, argv.merkleMine, argv.recipient)

    try {
        await gen.performChecks()
    } catch (err) {
        console.log("Some checks failed!")
        console.log("Try using the accounts file at https://gateway.ipfs.io/ipfs/QmQbvkaw5j8TFeeR7c5Cs2naDciUVq9cLWnV3iNEzE784r")
        console.log("Please visit livepeer.org to learn how to start participating in the Livepeer network")
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
