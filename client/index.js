const Web3 = require("web3")
const prompt = require("prompt-sync")()
const TxKeyManager = require("./lib/TxKeyManager")
const MerkleMineGenerator = require("./lib/MerkleMineGenerator")

const argv = require("yargs")
      .usage("Usage: $0 --rinkeby --dev --acctFile [accounts file] --datadir [data directory] --merkleMine [MerkleMine address] --recipient [recipient address] --caller [caller address] --gasPrice [gas price]")
      .boolean(["rinkeby", "dev"])
      .default("gasPrice", 5000000000)
      .demandOption(["acctFile", "datadir", "merkleMine", "caller"])
      .argv

const main = async () => {
    // If --recipient not provided, default to match --caller
    if (argv.recipient == undefined) {
        argv.recipient = argv.caller
    }

    let provider

    if (argv.dev) {
        provider = new Web3.providers.HttpProvider("http://localhost:8545")
    } else if (argv.rinkeby) {
        provider = new Web3.providers.HttpProvider("https://rinkeby.infura.io")
    } else {
        provider = new Web3.providers.HttpProvider("https://mainnet.infura.io")
    }

    console.log(`You must provide a password to unlock your caller account ${argv.caller}`)
    const password = prompt("Password: ", { echo: "" })

    const txKeyManager = new TxKeyManager(argv.datadir, argv.caller)
    await txKeyManager.unlock(password)
    console.log(`Unlocked caller account ${argv.caller}`)

    const gen = new MerkleMineGenerator(provider, txKeyManager, argv.merkleMine, argv.recipient, argv.caller, argv.gasPrice)
    await gen.makeTree(argv.acctFile)
    await gen.validateRoot()
    await gen.checkStarted()
    await gen.checkGenerated()
    await gen.submitProof()
}

try {
    main()
} catch (err) {
    console.error(err)
}
