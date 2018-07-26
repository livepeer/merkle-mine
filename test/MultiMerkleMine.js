const expectThrow = require("./helpers/expectThrow")
const ethUtil = require("ethereumjs-util")
const RPC = require("./helpers/rpc")
const MerkleTree = require("../utils/merkleTree.js")

const MultiMerkleMine = artifacts.require("MultiMerkleMine")
const MerkleMine = artifacts.require("MerkleMine")
const TestToken = artifacts.require("TestToken")

contract("MultiMerkleMine", accounts => {
    const TOTAL_GENESIS_TOKENS = 10000000
    const TOTAL_GENESIS_RECIPIENTS = 200000 
    const TOKENS_PER_ALLOCATION = Math.floor(TOTAL_GENESIS_TOKENS / TOTAL_GENESIS_RECIPIENTS)
    const BALANCE_THRESHOLD = 1000
    const BLOCKS_TO_CALLER_CLIFF = 10
    const CALLER_ALLOCATION_PERIOD = 100

    let rpc
    let snapshotId

    let token
    let merkleMine
    let multiMerkleMine
    let merkleTree

    let callerAllocationStartBlock
    let callerAllocationEndBlock

    let mockAccounts = []

    before(async () => {
        rpc = new RPC(web3)

        callerAllocationStartBlock = web3.eth.blockNumber + BLOCKS_TO_CALLER_CLIFF + 1
        callerAllocationEndBlock = web3.eth.blockNumber + BLOCKS_TO_CALLER_CLIFF + CALLER_ALLOCATION_PERIOD + 1

        // Generate mock accounts
        // Start with 0x..1 because the OpenZeppelin ERC20 token implementation does not allow
        // transfers to the null address
        for (let i = 1; i <= TOTAL_GENESIS_RECIPIENTS; i++) {
            mockAccounts.push("0x" + ethUtil.setLengthLeft(i, 20).toString("hex"))
        }

        token = await TestToken.new()
        const sortedAccounts = [...new Set(mockAccounts)].map(acct => ethUtil.toBuffer(ethUtil.addHexPrefix(acct))).sort(Buffer.compare)
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
        multiMerkleMine = await MultiMerkleMine.new()
    })

    beforeEach(async () => {
        snapshotId = await rpc.snapshot()
    })

    afterEach(async () => {
        await rpc.revert(snapshotId)
    })

    describe("multiGenerate", () => {
        describe("generation period has not started", ()=>{
            it("should fail if generation period has not yet started", async () => {
                await token.mint(merkleMine.address, TOTAL_GENESIS_TOKENS)
                await expectThrow(
                    multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        mockAccounts.slice(0, 10),
                        merkleTree.getHexBatchProofs(mockAccounts.slice(0, 10))
                    )
                )
            })
        })

    	describe("generation period has started", () => {
            beforeEach(async () => {
                await token.mint(merkleMine.address, TOTAL_GENESIS_TOKENS)
                await merkleMine.start()
            })

            describe("current blockNumber < callerAllocationStartBlock", ()=>{
                it("should fail if called before callerAllocationStartBlock", async ()=>{
                    await expectThrow(
                        multiMerkleMine.multiGenerate(
                            merkleMine.address,
                            mockAccounts.slice(0, 10),
                            merkleTree.getHexBatchProofs(mockAccounts.slice(0, 10))
                        )
                    )
                })
            })

            describe("current blockNumber >= callerAllocationStartBlock", ()=>{
                beforeEach(async () => {
                    await rpc.waitUntilBlock((await merkleMine.callerAllocationStartBlock()))
                })

                it("should fail if given incorrect proofs", async () => {
                    await expectThrow(multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        mockAccounts.slice(0, 10),
                        merkleTree.getHexBatchProofs(mockAccounts.slice(20, 30))
                    ))
                })

                it("should fail if number of proofs > number of recipients", async ()=>{
                    await expectThrow(multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        mockAccounts.slice(0, 10),
                        merkleTree.getHexBatchProofs(mockAccounts.slice(0, 11))
                    ))
                })

                it("should fail if number of proofs < number of recipients", async () => {
                    await expectThrow(multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        mockAccounts.slice(0, 10),
                        merkleTree.getHexBatchProofs(mockAccounts.slice(0, 9))
                    ))
                })

                it("should fail if number of proofs = 0 and number of recipients > 0", async () => {
                    await expectThrow(multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        mockAccounts.slice(0, 10),
                        "0x"
                    ))
                })

                it("should fail if number of proofs > 0 and number of recipients = 0", async () => {
                    await expectThrow(multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        [],
                        merkleTree.getHexBatchProofs(mockAccounts.slice(0, 10))
                    ))
                })

                it("should succeed and transfer no tokens if no proofs or recipients are provided", async () => {
                    const initBalance = (await token.balanceOf(accounts[0])).toNumber()

                    await multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        [],
                        "0x"
                    )
                    
                    const finalBalance = (await token.balanceOf(accounts[0])).toNumber()
                    assert.equal(finalBalance - initBalance, 0)
                })

                it("should update msg.sender's token balance correctly after passing in a full set of valid proofs and recipients", async () => {
                    const initBalance = (await token.balanceOf(accounts[0])).toNumber()
                    const expectedCallerTokenAmount = await merkleMine.callerTokenAmountAtBlock(web3.eth.blockNumber + 1)

                    await multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        mockAccounts.slice(0, 10),
                        merkleTree.getHexBatchProofs(mockAccounts.slice(0, 10))
                    )

                    const finalBalance = (await token.balanceOf(accounts[0])).toNumber()
                    assert.equal(finalBalance - initBalance, 10 * expectedCallerTokenAmount)
                })

                it("should update msg.sender's balance correctly in case MultiMerkleMine already has a non-zero token balance prior to generation", async () => {
                    await token.mint(multiMerkleMine.address, 10000)

                    assert.equal(await token.balanceOf(multiMerkleMine.address), 10000)

                    const initBalance = (await token.balanceOf(accounts[0])).toNumber()
                    const expectedCallerTokenAmount = await merkleMine.callerTokenAmountAtBlock(web3.eth.blockNumber + 1)
                    
                    await multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        mockAccounts.slice(0, 10),
                        merkleTree.getHexBatchProofs(mockAccounts.slice(0, 10))
                    )

                    const finalBalance = (await token.balanceOf(accounts[0])).toNumber()
                    assert.equal(finalBalance - initBalance, 10 * expectedCallerTokenAmount)
                    assert.equal(await token.balanceOf(multiMerkleMine.address), 10000)
                })

                it("should update balances of all recipients", async () => {
                    let initBalances = {} 

                    for (let acct of mockAccounts.slice(0, 10)) {
                        initBalances[acct] = (await token.balanceOf(acct)).toNumber()
                    }

                    const expectedCallerTokenAmount = (await merkleMine.callerTokenAmountAtBlock(web3.eth.blockNumber + 1)).toNumber()
                    const expectedRecipientTokenAmount = TOKENS_PER_ALLOCATION - expectedCallerTokenAmount

                    await multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        mockAccounts.slice(0, 10),
                        merkleTree.getHexBatchProofs(mockAccounts.slice(0, 10))
                    )

                    for (let acct of mockAccounts.slice(0, 10)) {
                        const finalBalance = (await token.balanceOf(acct)).toNumber()
                        assert.equal(finalBalance - initBalances[acct], expectedRecipientTokenAmount)
                    }
                })
            })

            describe("given a partially valid set of proofs and recipients", ()=>{
                beforeEach(async () => {
                    await rpc.waitUntilBlock((await merkleMine.callerAllocationStartBlock()))
                    await multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        mockAccounts.slice(0, 10),
                        merkleTree.getHexBatchProofs(mockAccounts.slice(0, 10)),
                    )
                })

                it("should not change msg.sender's token balance if allocations for all the recipients in the set have already been generated", async () => {
                    const initBalance = (await token.balanceOf(accounts[0])).toNumber()

                    await multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        mockAccounts.slice(0, 10),
                        merkleTree.getHexBatchProofs(mockAccounts.slice(0, 10)),
                    )

                    const finalBalance = (await token.balanceOf(accounts[0])).toNumber()
                    assert.equal(finalBalance, initBalance)
                })

                it("should update msg.sender's token balance correctly when allocations for first 10 of 12 recipients in the set have already been generated", async () => {
                    const initBalance = (await token.balanceOf(accounts[0])).toNumber()
                    const expectedCallerTokenAmount = await merkleMine.callerTokenAmountAtBlock(web3.eth.blockNumber + 1)

                    await multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        mockAccounts.slice(0, 12),
                        merkleTree.getHexBatchProofs(mockAccounts.slice(0, 12)),
                    )

                    const finalBalance = (await token.balanceOf(accounts[0])).toNumber()
                    assert.equal(finalBalance - initBalance, 2 * expectedCallerTokenAmount)
                })

                it("should update balances of 2 of 12 recipients in the set that have not generated", async () => {
                    let initBalances = {} 

                    for (let acct of mockAccounts.slice(0, 12)) {
                        initBalances[acct] = (await token.balanceOf(acct)).toNumber()
                    }

                    const expectedCallerTokenAmount = (await merkleMine.callerTokenAmountAtBlock(web3.eth.blockNumber + 1)).toNumber()
                    const expectedRecipientTokenAmount = TOKENS_PER_ALLOCATION - expectedCallerTokenAmount

                    await multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        mockAccounts.slice(0, 12),
                        merkleTree.getHexBatchProofs(mockAccounts.slice(0, 12))
                    )

                    for (let acct of mockAccounts.slice(0, 10)) {
                        const finalBalance = (await token.balanceOf(acct)).toNumber()
                        assert.equal(finalBalance - initBalances[acct], 0)
                    }

                    for (let acct of mockAccounts.slice(10, 12)) {
                        const finalBalance = (await token.balanceOf(acct)).toNumber()
                        assert.equal(finalBalance - initBalances[acct], expectedRecipientTokenAmount)
                    }
                })
            })
    	})
    })
})