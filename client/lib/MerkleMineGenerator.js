const Web3 = require("web3")
const ethUtil = require("ethereumjs-util")
const MerkleMineArtifact = require("./artifacts/MerkleMine.json")
const ERC20Artifact = require("./artifacts/ERC20.json")

module.exports = class MerkleMineGenerator {
    constructor(provider, txKeyManager, merkleTree, merkleMineAddress, recipientAddress, callerAddress, gasPrice) {
        this.web3 = new Web3()
        this.web3.setProvider(provider)
        this.txKeyManager = txKeyManager
        this.merkleTree = merkleTree
        this.merkleMineAddress = merkleMineAddress
        this.recipientAddress = recipientAddress
        this.callerAddress = callerAddress
        this.gasPrice = gasPrice
    }

    async performChecks() {
        const merkleMine = await this.getMerkleMine()

        // Validate len(candidateAccounts) == totalGenesisRecipients
        const numCandidateAccounts = this.merkleTree.getNumLeaves()
        const totalGenesisRecipients = await merkleMine.methods.totalGenesisRecipients().call()

        if (numCandidateAccounts == totalGenesisRecipients) {
            throw new Error(`Number of candidate accounts ${numCandidateAccounts} != totalGenesisRecipients ${totalGenesisRecipients}`)
        }

        // Validate root
        const remoteRoot = await merkleMine.methods.genesisRoot().call()
        const localRoot = this.merkleTree.getHexRoot()

        if (remoteRoot !== localRoot) {
            throw new Error(`Locally generated Merkle root ${localRoot} does not match Merkle root stored in MerkleMine contract ${remoteRoot}!`)
        }

        console.log(`Validated locally generated Merkle root ${localRoot} with Merkle root stored in MerkleMine contract!`)

        // Validate proof locally
        const validProof = this.merkleTree.verifyProof(this.recipientAddress, this.merkleTree.getProof(this.recipientAddress))

        if (!validProof) {
            throw new Error(`Local verification of Merkle proof failed!`)
        }

        // Validate that the MerkleMine contract is in a started state
        const started = await merkleMine.methods.started().call()

        if (!started) {
            throw new Error(`Generation period has not started for MerkleMine contract`)
        }

        console.log("Validated Merkle proof locally!")

        // Validate MerkleMine contract balance is sufficient for the token allocation generation
        const tokensPerAllocation = await merkleMine.methods.tokensPerAllocation().call()
        const token = await this.getToken()
        const merkleMineBalance = await token.methods.balanceOf(this.merkleMineAddress).call()

        if (merkleMineBalance < tokensPerAllocation) {
            throw new Error(`Tokens per allocation is ${tokensPerAllocation.toString()} but MerkleMine contract only has balance of ${merkleMineBalance.toString()}`)
        }

        // Validate that the recipient's token allocation has not been generated
        const generated = await merkleMine.methods.generated(this.recipientAddress).call()

        if (generated) {
            throw new Error(`Allocation for ${this.recipientAddress} already generated!`)
        }
    }

    async submitProof() {
        const merkleMine = await this.getMerkleMine()
        const generateFn = merkleMine.methods.generate(this.recipientAddress, this.merkleTree.getHexProof(ethUtil.addHexPrefix(this.recipientAddress)))
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

    async getToken() {
        if (this.token == undefined) {
            const merkleMine = await this.getMerkleMine()
            const tokenAddr = await merkleMine.methods.token().call()
            this.token = new this.web3.eth.Contract(ERC20Artifact.abi, tokenAddr)
        }

        return this.token
    }
}
