const fs = require("fs")
const { promisify } = require("util")
const Web3 = require("web3")
const ethUtil = require("ethereumjs-util")
const MerkleTree = require("../../utils/merkleTree.js")
const MerkleMineArtifact = require("./artifacts/MerkleMine.json")

module.exports = class MerkleMineGenerator {
    constructor(provider, txKeyManager, merkleMineAddress, recipientAddress, callerAddress, gasPrice) {
        this.web3 = new Web3()
        this.web3.setProvider(provider)
        this.txKeyManager = txKeyManager
        this.merkleMineAddress = merkleMineAddress
        this.recipientAddress = recipientAddress
        this.callerAddress = callerAddress
        this.gasPrice = gasPrice
    }

    async makeTree(accountsFile) {
        const file = await promisify(fs.readFile)(accountsFile)

        const accounts = JSON.parse(file)
        // Sort accounts based on their hex bytes value
        const sortedAccounts = accounts.map(acct => ethUtil.toBuffer(acct)).sort(Buffer.compare)

        console.log(`Creating Merkle tree with accounts in file: ${accountsFile}`)

        this.merkleTree = new MerkleTree(sortedAccounts)

        console.log(`Created Merkle tree with root ${this.merkleTree.getHexRoot()}`)
    }

    async validateRoot() {
        const merkleMine = await this.getMerkleMine()
        const remoteRoot = await merkleMine.methods.genesisRoot().call()
        const localRoot = this.merkleTree.getHexRoot()

        if (remoteRoot !== localRoot) {
            throw new Error(`Locally generated Merkle root ${localRoot} does not match Merkle root stored in MerkleMine contract ${remoteRoot}!`)
        }

        console.log(`Validated locally generated Merkle root ${localRoot} with Merkle root stored in MerkleMine contract!`)
    }

    async checkStarted() {
        const merkleMine = await this.getMerkleMine()
        const started = await merkleMine.methods.started().call()

        if (!started) {
            throw new Error(`Generation period has not started for MerkleMine contract`)
        }
    }

    async checkGenerated() {
        const merkleMine = await this.getMerkleMine()
        const generated = await merkleMine.methods.generated(this.recipientAddress).call()

        if (generated) {
            throw new Error(`Allocation for ${this.recipientAddress} already mined!`)
        }
    }

    async submitProof() {
        const merkleMine = await this.getMerkleMine()
        const generateFn = merkleMine.methods.generate(this.recipientAddress, this.merkleTree.getHexProof(this.recipientAddress))
        const gas = await generateFn.estimateGas({from: this.callerAddress})
        const data = generateFn.encodeABI()
        const nonce = await this.web3.eth.getTransactionCount(this.callerAddress, "pending")
        const networkId = await this.web3.eth.net.getId()

        const signedTx = this.txKeyManager.signTransaction({
            nonce: nonce,
            gasPrice: this.gasPrice,
            gasLimit: gas,
            to: this.merkleMineAddress,
            value: 0,
            data: data,
            chainId: networkId
        })

        const receipt = await this.web3.eth.sendSignedTransaction(signedTx).on("transactionHash", txHash => {
            console.log(`Submitted tx ${txHash} to generate allocation for ${this.recipientAddress} from ${this.callerAddress}`)
        })

        if (receipt.status === "0x0") {
            throw new Error(`Failed to generate allocation for ${this.recipientAddress} from ${this.callerAddress} in tx ${receipt.transactionHash}`)
        }

        console.log(`Generated allocation for ${this.recipientAddress}`)
    }

    async getMerkleMine() {
        if (this.merkleMine == undefined) {
            this.merkleMine = new this.web3.eth.Contract(MerkleMineArtifact.abi, this.merkleMineAddress)
        }

        return this.merkleMine
    }
}
