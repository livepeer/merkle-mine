const expectThrow = require("./helpers/expectThrow")
const RPC = require("./helpers/rpc")
const MerkleTree = require("../utils/merkleTree.js")

const MerkleMine = artifacts.require("MerkleMine")
const TestToken = artifacts.require("TestToken")

contract("MerkleMine", accounts => {
    describe("constructor", () => {
        const merkleRoot = web3.sha3("foo")
        const totalMineableTokens = 10000000
        const totalRecipients = 10
        const balanceThreshold = 1000

        it("should fail if token address is null address", async () => {
            const invalidTokenAddress = "0x0000000000000000000000000000000000000000"

            await expectThrow(
                MerkleMine.new(
                    invalidTokenAddress,
                    merkleRoot,
                    totalMineableTokens,
                    totalRecipients,
                    balanceThreshold,
                    web3.eth.blockNumber,
                    web3.eth.blockNumber + 101
                )
            )
        })

        it("should fail if totalRecipients == 0", async () => {
            const invalidTotalRecipients = 0

            await expectThrow(
                MerkleMine.new(
                    accounts[0],
                    merkleRoot,
                    totalMineableTokens,
                    invalidTotalRecipients,
                    balanceThreshold,
                    web3.eth.blockNumber,
                    web3.eth.blockNumber + 101
                )
            )
        })

        it("should fail if genesis block > the current block", async () => {
            const invalidGenesisBlock = web3.eth.blockNumber + 2

            await expectThrow(
                MerkleMine.new(
                    accounts[0],
                    merkleRoot,
                    totalMineableTokens,
                    totalRecipients,
                    balanceThreshold,
                    invalidGenesisBlock,
                    web3.eth.blockNumber + 101
                )
            )
        })

        it("should fail if end block < the current block", async () => {
            const invalidEndBlock = web3.eth.blockNumber - 5

            await expectThrow(
                MerkleMine.new(
                    accounts[0],
                    merkleRoot,
                    totalMineableTokens,
                    totalRecipients,
                    balanceThreshold,
                    web3.eth.blockNumber,
                    invalidEndBlock
                )
            )
        })

        it("should fail if end block == the current block", async () => {
            const invalidEndBlock = web3.eth.blockNumber + 1

            await expectThrow(
                MerkleMine.new(
                    accounts[0],
                    merkleRoot,
                    totalMineableTokens,
                    totalRecipients,
                    balanceThreshold,
                    web3.eth.blockNumber,
                    invalidEndBlock
                )
            )
        })

        it("should set parameters", async () => {
            const token = await TestToken.new()
            const genesisBlock = web3.eth.blockNumber
            const startBlock = web3.eth.blockNumber + 1
            const endBlock = web3.eth.blockNumber + 101

            const merkleMine = await MerkleMine.new(
                token.address,
                merkleRoot,
                totalMineableTokens,
                totalRecipients,
                balanceThreshold,
                genesisBlock,
                endBlock
            )

            assert.equal(await merkleMine.token.call(), token.address, "should set token address")
            assert.equal(await merkleMine.merkleRoot.call(), merkleRoot, "should set Merkle root")
            assert.equal(await merkleMine.totalMineableTokens.call(), totalMineableTokens, "should set total mineable tokens")
            assert.equal(await merkleMine.totalRecipients.call(), totalRecipients, "should set total recipients")
            assert.equal(await merkleMine.balanceThreshold.call(), balanceThreshold, "should set balance threshold")
            assert.equal(await merkleMine.genesisBlock.call(), genesisBlock, "should set genesis block")
            assert.equal(await merkleMine.startBlock.call(), startBlock, "should set start block")
            assert.equal(await merkleMine.endBlock.call(), endBlock, "should set end block")
        })
    })

    const TOTAL_MINEABLE_TOKENS = 10000000
    const TOTAL_RECIPIENTS = accounts.length
    const BALANCE_THRESHOLD = 1000
    const MINING_PERIOD = 100

    let rpc
    let snapshotId

    let token
    let merkleMine
    let merkleTree

    before(async () => {
        rpc = new RPC(web3)

        token = await TestToken.new()

        merkleTree = new MerkleTree(accounts.map(acct => acct.toLowerCase()))
        merkleMine = await MerkleMine.new(
            token.address,
            merkleTree.getHexRoot(),
            TOTAL_MINEABLE_TOKENS,
            TOTAL_RECIPIENTS,
            BALANCE_THRESHOLD,
            web3.eth.blockNumber,
            web3.eth.blockNumber + MINING_PERIOD + 1
        )

        await token.mint(merkleMine.address, TOTAL_MINEABLE_TOKENS)
    })

    beforeEach(async () => {
        snapshotId = await rpc.snapshot()
    })

    afterEach(async () => {
        await rpc.revert(snapshotId)
    })

    describe("mine", () => {
        it("should fail if Merkle proof is invalid", async () => {
            await expectThrow(merkleMine.mine(accounts[1], merkleTree.getHexProof(accounts[2])), {from: accounts[1]})
        })

        it("should fail if recipient's allocation has already been mined", async () => {
            await merkleMine.mine(accounts[1], merkleTree.getHexProof(accounts[1]), {from: accounts[1]})

            await expectThrow(merkleMine.mine(accounts[1], merkleTree.getHexProof(accounts[1])), {from: accounts[1]})
        })

        describe("recipient == caller", () => {
            it("should transfer the full allocation to the recipient", async () => {
                await merkleMine.mine(accounts[1], merkleTree.getHexProof(accounts[1]), {from: accounts[1]})

                assert.equal(await token.balanceOf(accounts[1]), Math.floor(TOTAL_MINEABLE_TOKENS / TOTAL_RECIPIENTS), "should update recipient's balance with full allocation")
            })
        })

        describe("recipient != caller", () => {
            describe("current block is before the end block", () => {
                it("should split the allocation 90:10 (recipient:caller) when a tenth way through the mining period", async () => {
                    const mineBlockParent = (await merkleMine.startBlock.call()).plus(Math.floor(MINING_PERIOD * .1)).toNumber() - 1
                    await rpc.waitUntilBlock(mineBlockParent)

                    await merkleMine.mine(accounts[1], merkleTree.getHexProof(accounts[1]), {from: accounts[2]})

                    const tokensPerMine = Math.floor(TOTAL_MINEABLE_TOKENS / TOTAL_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerMine * .9)
                    const callerTokens = Math.floor(tokensPerMine * .1)
                    assert.equal(await token.balanceOf(accounts[1]), recipientTokens, "recipient should receive 90% of allocation")
                    assert.equal(await token.balanceOf(accounts[2]), callerTokens, "caller should receive 10% of allocation")
                })

                it("should split the allocation 75:25 (recipient:caller) when a quarter way through the mining period", async () => {
                    const mineBlockParent = (await merkleMine.startBlock.call()).plus(Math.floor(MINING_PERIOD * .25)).toNumber() - 1
                    await rpc.waitUntilBlock(mineBlockParent)

                    await merkleMine.mine(accounts[1], merkleTree.getHexProof(accounts[1]), {from: accounts[2]})

                    const tokensPerMine = Math.floor(TOTAL_MINEABLE_TOKENS / TOTAL_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerMine * .75)
                    const callerTokens = Math.floor(tokensPerMine * .25)
                    assert.equal(await token.balanceOf(accounts[1]), recipientTokens, "recipient should receive 75% of allocation")
                    assert.equal(await token.balanceOf(accounts[2]), callerTokens, "caller should receive 25% of allocation")
                })

                it("should split the allocation 60:40 (recipient:caller) when a third way through the mining period", async () => {
                    const mineBlockParent = (await merkleMine.startBlock.call()).plus(Math.floor(MINING_PERIOD * .4)).toNumber() - 1
                    await rpc.waitUntilBlock(mineBlockParent)

                    await merkleMine.mine(accounts[1], merkleTree.getHexProof(accounts[1]), {from: accounts[2]})

                    const tokensPerMine = Math.floor(TOTAL_MINEABLE_TOKENS / TOTAL_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerMine * .6)
                    const callerTokens = Math.floor(tokensPerMine * .4)
                    assert.equal(await token.balanceOf(accounts[1]), recipientTokens, "recipient should receive 60% of allocation")
                    assert.equal(await token.balanceOf(accounts[2]), callerTokens, "caller should receive 40% of allocation")
                })

                it("should split the allocation 50:50 (recipient:caller) when halfway through the mining period", async () => {
                    const mineBlockParent = (await merkleMine.startBlock.call()).plus(Math.floor(MINING_PERIOD * .5)).toNumber() - 1
                    await rpc.waitUntilBlock(mineBlockParent)

                    await merkleMine.mine(accounts[1], merkleTree.getHexProof(accounts[1]), {from: accounts[2]})

                    const tokensPerMine = Math.floor(TOTAL_MINEABLE_TOKENS / TOTAL_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerMine * .5)
                    const callerTokens = Math.floor(tokensPerMine * .5)
                    assert.equal(await token.balanceOf(accounts[1]), recipientTokens, "recipient should receive 50% of allocation")
                    assert.equal(await token.balanceOf(accounts[2]), callerTokens, "caller should receive 50% of allocation")
                })

                it("should split the allocation 40:60 (recipient:caller) when two thirds way through the mining period", async () => {
                    const mineBlockParent = (await merkleMine.startBlock.call()).plus(Math.floor(MINING_PERIOD * .6)).toNumber() - 1
                    await rpc.waitUntilBlock(mineBlockParent)

                    await merkleMine.mine(accounts[1], merkleTree.getHexProof(accounts[1]), {from: accounts[2]})

                    const tokensPerMine = Math.floor(TOTAL_MINEABLE_TOKENS / TOTAL_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerMine * .4)
                    const callerTokens = Math.floor(tokensPerMine * .6)
                    assert.equal(await token.balanceOf(accounts[1]), recipientTokens, "recipient should receive 40% of allocation")
                    assert.equal(await token.balanceOf(accounts[2]), callerTokens, "caller should receive 60% of allocation")
                })

                it("should split the allocation 25:75 (recipient:caller) when three fourths way through the mining period", async () => {
                    const mineBlockParent = (await merkleMine.startBlock.call()).plus(Math.floor(MINING_PERIOD * .75)).toNumber() - 1
                    await rpc.waitUntilBlock(mineBlockParent)

                    await merkleMine.mine(accounts[1], merkleTree.getHexProof(accounts[1]), {from: accounts[2]})

                    const tokensPerMine = Math.floor(TOTAL_MINEABLE_TOKENS / TOTAL_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerMine * .25)
                    const callerTokens = Math.floor(tokensPerMine * .75)
                    assert.equal(await token.balanceOf(accounts[1]), recipientTokens, "recipient should receive 25% of allocation")
                    assert.equal(await token.balanceOf(accounts[2]), callerTokens, "caller should receive 75% of allocation")
                })

                it("should split the allocation 10:90 (recipient:caller) when nine tenths way through the mining period", async () => {
                    const mineBlockParent = (await merkleMine.startBlock.call()).plus(Math.floor(MINING_PERIOD * .9)).toNumber() - 1
                    await rpc.waitUntilBlock(mineBlockParent)

                    await merkleMine.mine(accounts[1], merkleTree.getHexProof(accounts[1]), {from: accounts[2]})

                    const tokensPerMine = Math.floor(TOTAL_MINEABLE_TOKENS / TOTAL_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerMine * .1)
                    const callerTokens = Math.floor(tokensPerMine * .9)
                    assert.equal(await token.balanceOf(accounts[1]), recipientTokens, "recipient should receive 10% of allocation")
                    assert.equal(await token.balanceOf(accounts[2]), callerTokens, "caller should receive 90% of allocation")
                })
            })

            describe("current block is after the end block", () => {
                it("should transfer the full allocation to the caller", async () => {
                    const endBlock = await merkleMine.endBlock.call()
                    await rpc.waitUntilBlock(endBlock.toNumber())

                    await merkleMine.mine(accounts[1], merkleTree.getHexProof(accounts[1]), {from: accounts[2]})

                    assert.equal(await token.balanceOf(accounts[2]), Math.floor(TOTAL_MINEABLE_TOKENS / TOTAL_RECIPIENTS), "should transfer full allocation to caller")
                })
            })
        })
    })

    describe("tokensPerMine", () => {
        it("should return totalMineableTokens / totalRecipients (floored)", async () => {
            assert.equal(await merkleMine.tokensPerMine.call(), Math.floor(TOTAL_MINEABLE_TOKENS / TOTAL_RECIPIENTS), "should return totalMineableTokens / totalRecipients (floored)")
        })
    })
})
