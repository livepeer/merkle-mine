const expectThrow = require("./helpers/expectThrow")
const RPC = require("./helpers/rpc")
const MerkleTree = require("../utils/merkleTree.js")

const MerkleMine = artifacts.require("MerkleMine")
const TestToken = artifacts.require("TestToken")

contract("MerkleMine", accounts => {
    describe("constructor", () => {
        const genesisRoot = web3.sha3("foo")
        const totalGenesisTokens = 10000000
        const totalGenesisRecipients = 10
        const balanceThreshold = 1000

        it("should fail if token address is null address", async () => {
            const invalidTokenAddress = "0x0000000000000000000000000000000000000000"

            await expectThrow(
                MerkleMine.new(
                    invalidTokenAddress,
                    genesisRoot,
                    totalGenesisTokens,
                    totalGenesisRecipients,
                    balanceThreshold,
                    web3.eth.blockNumber,
                    web3.eth.blockNumber + 11,
                    web3.eth.blockNumber + 111
                )
            )
        })

        it("should fail if totalGenesisRecipients == 0", async () => {
            const invalidTotalRecipients = 0

            await expectThrow(
                MerkleMine.new(
                    accounts[0],
                    genesisRoot,
                    totalGenesisTokens,
                    invalidTotalRecipients,
                    balanceThreshold,
                    web3.eth.blockNumber,
                    web3.eth.blockNumber + 11,
                    web3.eth.blockNumber + 101
                )
            )
        })

        it("should fail if genesisBlock > the current block", async () => {
            const invalidGenesisBlock = web3.eth.blockNumber + 2

            await expectThrow(
                MerkleMine.new(
                    accounts[0],
                    genesisRoot,
                    totalGenesisTokens,
                    totalGenesisRecipients,
                    balanceThreshold,
                    invalidGenesisBlock,
                    web3.eth.blockNumber + 11,
                    web3.eth.blockNumber + 111
                )
            )
        })

        it("should fail if callerAllocationStartBlock < the current block", async () => {
            const invalidCallerAllocationStartBlock = web3.eth.blockNumber - 5

            await expectThrow(
                MerkleMine.new(
                    accounts[0],
                    genesisRoot,
                    totalGenesisTokens,
                    totalGenesisRecipients,
                    balanceThreshold,
                    web3.eth.blockNumber,
                    invalidCallerAllocationStartBlock,
                    web3.eth.blockNumber + 111
                )
            )
        })

        it("should fail if callerAllocationStartBlock == the current block", async () => {
            const invalidCallerAllocationStartBlock = web3.eth.blockNumber + 1

            await expectThrow(
                MerkleMine.new(
                    accounts[0],
                    genesisRoot,
                    totalGenesisTokens,
                    totalGenesisRecipients,
                    balanceThreshold,
                    web3.eth.blockNumber,
                    invalidCallerAllocationStartBlock,
                    web3.eth.blockNumber + 111
                )
            )
        })

        it("should fail if callerAllocationEndBlock < callerAllocationStartBlock", async () => {
            const invalidCallerAllocationEndBlock = web3.eth.blockNumber + 10

            await expectThrow(
                MerkleMine.new(
                    accounts[0],
                    genesisRoot,
                    totalGenesisTokens,
                    totalGenesisRecipients,
                    balanceThreshold,
                    web3.eth.blockNumber,
                    web3.eth.blockNumber + 11,
                    invalidCallerAllocationEndBlock
                )
            )
        })

        it("should fail if callerAllocationEndBlock == callerAllocationStartBlock", async () => {
            const invalidCallerAllocationEndBlock = web3.eth.blockNumber + 11

            await expectThrow(
                MerkleMine.new(
                    accounts[0],
                    genesisRoot,
                    totalGenesisTokens,
                    totalGenesisRecipients,
                    balanceThreshold,
                    web3.eth.blockNumber,
                    web3.eth.blockNumber + 11,
                    invalidCallerAllocationEndBlock
                )
            )
        })

        it("should set parameters", async () => {
            const token = await TestToken.new()
            const genesisBlock = web3.eth.blockNumber
            const callerAllocationStartBlock = web3.eth.blockNumber + 11
            const callerAllocationEndBlock = web3.eth.blockNumber + 111

            const merkleMine = await MerkleMine.new(
                token.address,
                genesisRoot,
                totalGenesisTokens,
                totalGenesisRecipients,
                balanceThreshold,
                genesisBlock,
                callerAllocationStartBlock,
                callerAllocationEndBlock
            )

            assert.equal(await merkleMine.token.call(), token.address, "should set token address")
            assert.equal(await merkleMine.genesisRoot.call(), genesisRoot, "should set Merkle root")
            assert.equal(await merkleMine.totalGenesisTokens.call(), totalGenesisTokens, "should set total mineable tokens")
            assert.equal(await merkleMine.totalGenesisRecipients.call(), totalGenesisRecipients, "should set total recipients")
            assert.equal(await merkleMine.balanceThreshold.call(), balanceThreshold, "should set balance threshold")
            assert.equal(await merkleMine.genesisBlock.call(), genesisBlock, "should set genesis block")
            assert.equal(await merkleMine.callerAllocationStartBlock.call(), callerAllocationStartBlock, "should set caller allocation start block")
            assert.equal(await merkleMine.callerAllocationEndBlock.call(), callerAllocationEndBlock, "should set caller allocation end block")
        })
    })

    const TOTAL_GENESIS_TOKENS = 10000000
    const TOTAL_GENESIS_RECIPIENTS = accounts.length
    const BALANCE_THRESHOLD = 1000
    const BLOCKS_TO_CALLER_CLIFF = 10
    const CALLER_ALLOCATION_PERIOD = 100

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
            TOTAL_GENESIS_TOKENS,
            TOTAL_GENESIS_RECIPIENTS,
            BALANCE_THRESHOLD,
            web3.eth.blockNumber,
            web3.eth.blockNumber + BLOCKS_TO_CALLER_CLIFF + 1,
            web3.eth.blockNumber + BLOCKS_TO_CALLER_CLIFF + CALLER_ALLOCATION_PERIOD + 1
        )

        await token.mint(merkleMine.address, TOTAL_GENESIS_TOKENS)
    })

    beforeEach(async () => {
        snapshotId = await rpc.snapshot()
    })

    afterEach(async () => {
        await rpc.revert(snapshotId)
    })

    describe("generate", () => {
        it("should fail if Merkle proof is invalid", async () => {
            await expectThrow(merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[1])), {from: accounts[0]})
        })

        it("should fail if recipient's allocation has already been generated", async () => {
            await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[0]})

            await expectThrow(merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0])), {from: accounts[0]})
        })

        describe("recipient == caller", () => {
            it("should transfer the full allocation to the recipient and set recipient allocation as generated", async () => {
                await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[0]})

                assert.isOk(await merkleMine.generated.call(accounts[0]), "should set recipient allocation as generated")
                assert.equal(
                    await token.balanceOf(accounts[0]),
                    Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS),
                    "should update recipient's balance with full allocation"
                )
            })

            it("should emit Generate event with correct fields", async () => {
                let e = merkleMine.Generate({})
                e.watch(async (err, result) => {
                    e.stopWatching()

                    assert.equal(result.args._recipient, accounts[0], "should set recipient")
                    assert.equal(result.args._caller, accounts[0], "should set caller = recipient")
                    assert.equal(
                        result.args._recipientTokenAmount,
                        Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS),
                        "should set recipient token amount to full allocation"
                    )
                    assert.equal(result.args._callerTokenAmount, 0, "should set caller token amount to 0")
                    assert.equal(result.args._block, web3.eth.blockNumber, "should set block to current block")
                })

                await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[0]})
            })
        })

        describe("recipient != caller", () => {
            it("should fail if we are not in caller allocation period", async () => {
                await expectThrow(merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]}))
            })

            it("should set recipient allocation as generated", async () => {
                await rpc.waitUntilBlock(web3.eth.blockNumber + BLOCKS_TO_CALLER_CLIFF - 1)

                await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                assert.isOk(await merkleMine.generated.call(accounts[0]), "should set recipient allocation as generated")
            })

            describe("current block >= callerAllocationStartBlock and current block < callerAllocationEndBlock", () => {
                beforeEach(async () => {
                    // Fast forward to caller allocation period
                    await rpc.waitUntilBlock(web3.eth.blockNumber + BLOCKS_TO_CALLER_CLIFF - 2)
                })

                it("should split the allocation 100:0 (recipient:caller) when current block == callerAllocationStartBlock", async () => {
                    await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                    assert.equal(await token.balanceOf(accounts[0]), Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS), "recipient should receive 100% of allocation")
                    assert.equal(await token.balanceOf(accounts[1]), 0, "caller should receive 0% of allocation")
                })

                it("should split the allocation 90:10 (recipient:caller) when a tenth way through the caller allocation period", async () => {
                    const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .1)).toNumber() - 1
                    await rpc.waitUntilBlock(generateBlockParent)

                    await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                    const tokensPerAllocation = Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerAllocation * .9)
                    const callerTokens = Math.floor(tokensPerAllocation * .1)
                    assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 90% of allocation")
                    assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 10% of allocation")
                })

                it("should split the allocation 75:25 (recipient:caller) when a quarter way through the caller allocation period", async () => {
                    const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .25)).toNumber() - 1
                    await rpc.waitUntilBlock(generateBlockParent)

                    await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                    const tokensPerAllocation = Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerAllocation * .75)
                    const callerTokens = Math.floor(tokensPerAllocation * .25)
                    assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 75% of allocation")
                    assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 25% of allocation")
                })

                it("should split the allocation 60:40 (recipient:caller) when a third way through the caller allocation period", async () => {
                    const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .4)).toNumber() - 1
                    await rpc.waitUntilBlock(generateBlockParent)

                    await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                    const tokensPerAllocation = Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerAllocation * .6)
                    const callerTokens = Math.floor(tokensPerAllocation * .4)
                    assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 60% of allocation")
                    assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 40% of allocation")
                })

                it("should split the allocation 50:50 (recipient:caller) when halfway through the caller allocation period", async () => {
                    const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .5)).toNumber() - 1
                    await rpc.waitUntilBlock(generateBlockParent)

                    await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                    const tokensPerAllocation = Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerAllocation * .5)
                    const callerTokens = Math.floor(tokensPerAllocation * .5)
                    assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 50% of allocation")
                    assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 50% of allocation")
                })

                it("should split the allocation 40:60 (recipient:caller) when two thirds way through the caller allocation period", async () => {
                    const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .6)).toNumber() - 1
                    await rpc.waitUntilBlock(generateBlockParent)

                    await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                    const tokensPerAllocation = Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerAllocation * .4)
                    const callerTokens = Math.floor(tokensPerAllocation * .6)
                    assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 40% of allocation")
                    assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 60% of allocation")
                })

                it("should split the allocation 25:75 (recipient:caller) when three fourths way through the caller allocation period", async () => {
                    const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .75)).toNumber() - 1
                    await rpc.waitUntilBlock(generateBlockParent)

                    await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                    const tokensPerAllocation = Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerAllocation * .25)
                    const callerTokens = Math.floor(tokensPerAllocation * .75)
                    assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 25% of allocation")
                    assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 75% of allocation")
                })

                it("should split the allocation 10:90 (recipient:caller) when nine tenths way through the caller allocation period", async () => {
                    const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .9)).toNumber() - 1
                    await rpc.waitUntilBlock(generateBlockParent)

                    await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                    const tokensPerAllocation = Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerAllocation * .1)
                    const callerTokens = Math.floor(tokensPerAllocation * .9)
                    assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 10% of allocation")
                    assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 90% of allocation")
                })

                it("should emit Generate event with correct fields", async () => {
                    const tokensPerAllocation = Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS)
                    const recipientTokens = Math.floor(tokensPerAllocation * .1)
                    const callerTokens = Math.floor(tokensPerAllocation * .9)

                    let e = merkleMine.Generate({})
                    e.watch((err, result) => {
                        e.stopWatching()

                        assert.equal(result.args._recipient, accounts[0], "should set recipient")
                        assert.equal(result.args._caller, accounts[1], "should set caller")
                        assert.equal(result.args._recipientTokenAmount, recipientTokens, "should set recipient token amount")
                        assert.equal(result.args._callerTokenAmount, callerTokens, "should set caller token amount")
                    })

                    const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .9)).toNumber() - 1
                    await rpc.waitUntilBlock(generateBlockParent)

                    await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})
                })
            })

            describe("current block is after the end block", () => {
                it("should transfer the full allocation to the caller", async () => {
                    const callerAllocationEndBlock = await merkleMine.callerAllocationEndBlock.call()
                    await rpc.waitUntilBlock(callerAllocationEndBlock.toNumber())

                    await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                    assert.equal(await token.balanceOf(accounts[0]), 0, "should not transfer any tokens to recipient")
                    assert.equal(await token.balanceOf(accounts[1]), Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS), "should transfer full allocation to caller")
                })
            })
        })
    })

    describe("tokensPerAllocation", () => {
        it("should return totalGenesisTokens / totalGenesisRecipients (floored)", async () => {
            assert.equal(
                await merkleMine.tokensPerAllocation.call(),
                Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS),
                "should return totalGenesisTokens / totalGenesisRecipients (floored)"
            )
        })
    })
})
