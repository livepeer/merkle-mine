const expectThrow = require("./helpers/expectThrow")
const ethUtil = require("ethereumjs-util")
const RPC = require("./helpers/rpc")
const MerkleTree = require("../utils/merkleTree.js")

const MerkleMine = artifacts.require("MerkleMine")
const TestToken = artifacts.require("TestToken")
const UnsafeTestToken = artifacts.require("UnsafeTestToken")

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
            assert.equal(await merkleMine.callerAllocationPeriod.call(), callerAllocationEndBlock - callerAllocationStartBlock, "should set caller allocation period")
        })
    })

    const TOTAL_GENESIS_TOKENS = 10000000
    const TOTAL_GENESIS_RECIPIENTS = accounts.length
    const TOKENS_PER_ALLOCATION = Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS)
    const BALANCE_THRESHOLD = 1000
    const BLOCKS_TO_CALLER_CLIFF = 10
    const CALLER_ALLOCATION_PERIOD = 100

    let rpc
    let snapshotId

    let token
    let merkleMine
    let merkleTree

    let callerAllocationStartBlock
    let callerAllocationEndBlock

    before(async () => {
        rpc = new RPC(web3)

        callerAllocationStartBlock = web3.eth.blockNumber + BLOCKS_TO_CALLER_CLIFF + 1
        callerAllocationEndBlock = web3.eth.blockNumber + BLOCKS_TO_CALLER_CLIFF + CALLER_ALLOCATION_PERIOD + 1

        token = await TestToken.new()
        const sortedAccounts = [...new Set(accounts)].map(acct => ethUtil.toBuffer(ethUtil.addHexPrefix(acct))).sort(Buffer.compare)
        merkleTree = new MerkleTree(sortedAccounts)
        merkleMine = await MerkleMine.new(
            token.address,
            merkleTree.getHexRoot(),
            TOTAL_GENESIS_TOKENS,
            TOTAL_GENESIS_RECIPIENTS,
            BALANCE_THRESHOLD,
            web3.eth.blockNumber,
            callerAllocationStartBlock,
            callerAllocationEndBlock,
        )
    })

    beforeEach(async () => {
        snapshotId = await rpc.snapshot()
    })

    afterEach(async () => {
        await rpc.revert(snapshotId)
    })

    describe("start", () => {
        it("should fail if the contract has a balance < totalGenesisTokens", async () => {
            await expectThrow(merkleMine.start())
        })

        it("should fail if genesis period is already started", async () => {
            await token.mint(merkleMine.address, TOTAL_GENESIS_TOKENS)
            await merkleMine.start()

            await expectThrow(merkleMine.start())
        })

        it("should set started = true if the contract has a balance > totalGenesisTokens", async () => {
            await token.mint(merkleMine.address, TOTAL_GENESIS_TOKENS + 1)
            await merkleMine.start()

            assert.isOk(await merkleMine.started.call(), "should set started = true")
        })

        it("should set started = true if the contract has a balance == totalGenesisTokens", async () => {
            await token.mint(merkleMine.address, TOTAL_GENESIS_TOKENS)
            await merkleMine.start()

            assert.isOk(await merkleMine.started.call(), "should set started = true")
        })
    })

    describe("generate", () => {
        describe("generation period is not started", () => {
            it("should fail if generation period is not started", async () => {
                await token.mint(merkleMine.address, TOTAL_GENESIS_TOKENS)
                await expectThrow(merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0])), {from: accounts[0]})
            })
        })

        describe("generation period is started", () => {
            beforeEach(async () => {
                await token.mint(merkleMine.address, TOTAL_GENESIS_TOKENS)
                await merkleMine.start()
            })

            it("should fail if Merkle proof is invalid", async () => {
                await expectThrow(merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[1])), {from: accounts[0]})
            })

            it("should fail if recipient's allocation has already been generated", async () => {
                await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[0]})

                await expectThrow(merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0])), {from: accounts[0]})
            })

            describe("recipient == caller", () => {
                it("should fail if the token transfer returns false", async () => {
                    const unsafeToken = await UnsafeTestToken.new()
                    const badMerkleMine = await MerkleMine.new(
                        unsafeToken.address,
                        merkleTree.getHexRoot(),
                        TOTAL_GENESIS_TOKENS,
                        1,
                        BALANCE_THRESHOLD,
                        web3.eth.blockNumber,
                        web3.eth.blockNumber + 11,
                        web3.eth.blockNumber + 111
                    )

                    await unsafeToken.mint(badMerkleMine.address, TOTAL_GENESIS_TOKENS)
                    await badMerkleMine.start()
                    await badMerkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[0]})

                    // Internal token transfer should fail because contract does not have enough tokens
                    await expectThrow(badMerkleMine.generate(accounts[1], merkleTree.getHexProof(accounts[1]), {from: accounts[1]}))
                })

                it("should transfer the full allocation to the recipient and set recipient allocation as generated", async () => {
                    await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[0]})

                    assert.isOk(await merkleMine.generated.call(accounts[0]), "should set recipient allocation as generated")
                    assert.equal(
                        await token.balanceOf(accounts[0]),
                        TOKENS_PER_ALLOCATION,
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
                            TOKENS_PER_ALLOCATION,
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

                it("should fail if one of the token transfers returns false", async () => {
                    const unsafeToken = await UnsafeTestToken.new()
                    const badMerkleMine = await MerkleMine.new(
                        unsafeToken.address,
                        merkleTree.getHexRoot(),
                        TOTAL_GENESIS_TOKENS,
                        1,
                        BALANCE_THRESHOLD,
                        web3.eth.blockNumber,
                        web3.eth.blockNumber + BLOCKS_TO_CALLER_CLIFF + 1,
                        web3.eth.blockNumber + BLOCKS_TO_CALLER_CLIFF + CALLER_ALLOCATION_PERIOD + 1
                    )

                    await unsafeToken.mint(badMerkleMine.address, TOTAL_GENESIS_TOKENS)
                    await badMerkleMine.start()
                    await badMerkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[0]})
                    await rpc.waitUntilBlock(web3.eth.blockNumber + BLOCKS_TO_CALLER_CLIFF)

                    // Internal token transfer should fail because contract does not have enough tokens
                    await expectThrow(badMerkleMine.generate(accounts[1], merkleTree.getHexProof(accounts[1]), {from: accounts[2]}))
                })

                it("should set recipient allocation as generated", async () => {
                    await rpc.waitUntilBlock(callerAllocationStartBlock - 1)

                    await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                    assert.isOk(await merkleMine.generated.call(accounts[0]), "should set recipient allocation as generated")
                })

                describe("current block >= callerAllocationStartBlock and current block < callerAllocationEndBlock", () => {
                    beforeEach(async () => {
                        // Fast forward to caller allocation period
                        await rpc.waitUntilBlock(callerAllocationStartBlock - 1)
                    })

                    it("should split the allocation 100:0 (recipient:caller) when current block == callerAllocationStartBlock", async () => {
                        await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                        assert.equal(await token.balanceOf(accounts[0]), TOKENS_PER_ALLOCATION, "recipient should receive 100% of allocation")
                        assert.equal(await token.balanceOf(accounts[1]), 0, "caller should receive 0% of allocation")
                    })

                    it("should split the allocation 90:10 (recipient:caller) when a tenth way through the caller allocation period", async () => {
                        const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .1)).toNumber() - 1
                        await rpc.waitUntilBlock(generateBlockParent)

                        await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                        const recipientTokens = Math.floor(TOKENS_PER_ALLOCATION* .9)
                        const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .1)
                        assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 90% of allocation")
                        assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 10% of allocation")
                    })

                    it("should split the allocation 75:25 (recipient:caller) when a quarter way through the caller allocation period", async () => {
                        const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .25)).toNumber() - 1
                        await rpc.waitUntilBlock(generateBlockParent)

                        await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                        const recipientTokens = Math.floor(TOKENS_PER_ALLOCATION * .75)
                        const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .25)
                        assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 75% of allocation")
                        assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 25% of allocation")
                    })

                    it("should split the allocation 60:40 (recipient:caller) when a third way through the caller allocation period", async () => {
                        const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .4)).toNumber() - 1
                        await rpc.waitUntilBlock(generateBlockParent)

                        await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                        const recipientTokens = Math.floor(TOKENS_PER_ALLOCATION * .6)
                        const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .4)
                        assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 60% of allocation")
                        assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 40% of allocation")
                    })

                    it("should split the allocation 50:50 (recipient:caller) when halfway through the caller allocation period", async () => {
                        const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .5)).toNumber() - 1
                        await rpc.waitUntilBlock(generateBlockParent)

                        await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                        const recipientTokens = Math.floor(TOKENS_PER_ALLOCATION * .5)
                        const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .5)
                        assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 50% of allocation")
                        assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 50% of allocation")
                    })

                    it("should split the allocation 40:60 (recipient:caller) when two thirds way through the caller allocation period", async () => {
                        const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .6)).toNumber() - 1
                        await rpc.waitUntilBlock(generateBlockParent)

                        await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                        const recipientTokens = Math.floor(TOKENS_PER_ALLOCATION * .4)
                        const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .6)
                        assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 40% of allocation")
                        assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 60% of allocation")
                    })

                    it("should split the allocation 25:75 (recipient:caller) when three fourths way through the caller allocation period", async () => {
                        const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .75)).toNumber() - 1
                        await rpc.waitUntilBlock(generateBlockParent)

                        await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                        const recipientTokens = Math.floor(TOKENS_PER_ALLOCATION * .25)
                        const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .75)
                        assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 25% of allocation")
                        assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 75% of allocation")
                    })

                    it("should split the allocation 10:90 (recipient:caller) when nine tenths way through the caller allocation period", async () => {
                        const generateBlockParent = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .9)).toNumber() - 1
                        await rpc.waitUntilBlock(generateBlockParent)

                        await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                        const recipientTokens = Math.floor(TOKENS_PER_ALLOCATION * .1)
                        const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .9)
                        assert.equal(await token.balanceOf(accounts[0]), recipientTokens, "recipient should receive 10% of allocation")
                        assert.equal(await token.balanceOf(accounts[1]), callerTokens, "caller should receive 90% of allocation")
                    })

                    it("should emit Generate event with correct fields", async () => {
                        const recipientTokens = Math.floor(TOKENS_PER_ALLOCATION * .1)
                        const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .9)

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

                describe("current block is at or after callerAllocationEndBlock", () => {
                    it("should transfer the full allocation to the caller if current block > callerAllocationEndBlock", async () => {
                        const callerAllocationEndBlock = await merkleMine.callerAllocationEndBlock.call()
                        await rpc.waitUntilBlock(callerAllocationEndBlock.toNumber() + 1)

                        await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                        assert.equal(await token.balanceOf(accounts[0]), 0, "should not transfer any tokens to recipient")
                        assert.equal(await token.balanceOf(accounts[1]), TOKENS_PER_ALLOCATION, "should transfer full allocation to caller")
                    })

                    it("should transfer the full allocation to the caller if current block == callerAllocationEndBlock", async () => {
                        const callerAllocationEndBlock = await merkleMine.callerAllocationEndBlock.call()
                        await rpc.waitUntilBlock(callerAllocationEndBlock.toNumber())

                        await merkleMine.generate(accounts[0], merkleTree.getHexProof(accounts[0]), {from: accounts[1]})

                        assert.equal(await token.balanceOf(accounts[0]), 0, "should not transfer any tokens to recipient")
                        assert.equal(await token.balanceOf(accounts[1]), TOKENS_PER_ALLOCATION, "should transfer full allocation to caller")
                    })
                })
            })
        })
    })

    describe("callerTokenAmountAtBlock", () => {
        it("returns 0 if current block < callerAllocationStartBlock", async () => {
            assert.equal(await merkleMine.callerTokenAmountAtBlock(callerAllocationStartBlock - 1), 0, "caller should be able to claim 0 tokens")
        })

        it("returns the full tokensPerAllocation if current block > callerAllocationEndBlock", async () => {
            assert.equal(await merkleMine.callerTokenAmountAtBlock(callerAllocationEndBlock + 1), TOKENS_PER_ALLOCATION, "caller should be able to claim 100% of allocation")
        })

        it("returns the full tokensPerAllocation if current block == callerAllocationEndBlock", async () => {
            assert.equal(await merkleMine.callerTokenAmountAtBlock(callerAllocationEndBlock), TOKENS_PER_ALLOCATION, "caller should be able to claim 100% of allocation")
        })

        describe("current block >= callerAllocationStartBlock and current block < callerAllocationEndBlock", () => {
            it("should return 0 when current block == callerAllocationStartBlock", async () => {
                assert.equal(
                    await merkleMine.callerTokenAmountAtBlock(callerAllocationStartBlock),
                    0,
                    "caller should be able to claim 0 tokens"
                )
            })

            it("should return 10% of allocation when a tenth way through the caller allocation period", async () => {
                const callerBlock = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .1)).toNumber()

                const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .1)

                assert.equal(
                    await merkleMine.callerTokenAmountAtBlock(callerBlock),
                    callerTokens,
                    "caller should be able to claim 10% of allocation"
                )
            })

            it("should return 25% of allocation when a quarter way through the caller allocation period", async () => {
                const callerBlock = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .25)).toNumber()

                const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .25)

                assert.equal(
                    await merkleMine.callerTokenAmountAtBlock(callerBlock),
                    callerTokens,
                    "caller should be able to claim 25% of allocation"
                )
            })

            it("should return 40% of allocation when a third way through the caller allocation period", async () => {
                const callerBlock = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .4)).toNumber()

                const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .4)

                assert.equal(
                    await merkleMine.callerTokenAmountAtBlock(callerBlock),
                    callerTokens,
                    "caller should be able to claim 40% of allocation"
                )
            })

            it("should return 50% of allocation when halfway through the caller allocation period", async () => {
                const callerBlock = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .5)).toNumber()

                const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .5)

                assert.equal(
                    await merkleMine.callerTokenAmountAtBlock(callerBlock),
                    callerTokens,
                    "caller should be able to claim 50% of allocation"
                )
            })

            it("should return 60% of allocation when two thirds way through the caller allocation period", async () => {
                const callerBlock = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .6)).toNumber()

                const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .6)

                assert.equal(
                    await merkleMine.callerTokenAmountAtBlock(callerBlock),
                    callerTokens,
                    "caller should be able to claim 60% of allocation"
                )
            })

            it("should return 75% of allocation when three fourths way through the caller allocation period", async () => {
                const callerBlock = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .75)).toNumber()

                const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .75)

                assert.equal(
                    await merkleMine.callerTokenAmountAtBlock(callerBlock),
                    callerTokens,
                    "caller should be able to claim 75% of allocation"
                )
            })

            it("should return 90% of allocation when nine tenths way through the caller allocation period", async () => {
                const callerBlock = (await merkleMine.callerAllocationStartBlock.call()).plus(Math.floor(CALLER_ALLOCATION_PERIOD * .9)).toNumber()

                const callerTokens = Math.floor(TOKENS_PER_ALLOCATION * .9)

                assert.equal(
                    await merkleMine.callerTokenAmountAtBlock(callerBlock),
                    callerTokens,
                    "caller should be able to claim 90% of allocation"
                )
            })
        })
    })
})
