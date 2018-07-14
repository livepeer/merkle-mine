const expectThrow = require("./helpers/expectThrow")
const ethUtil = require("ethereumjs-util")
const RPC = require("./helpers/rpc")
const MerkleTree = require("../utils/merkleTree.js")

const MultiMerkleMine = artifacts.require("MultiMerkleMine")
const MerkleMine = artifacts.require("MerkleMine")
const TestToken = artifacts.require("TestToken")
const UnsafeTestToken = artifacts.require("UnsafeTestToken")

contract("multiMerkleMine", accounts => {

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
    let multiMerkleMine
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
                        accounts,
                        merkleTree.getExtendedHexProof(accounts),
                        {from: accounts[0]}
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
                            accounts,
                            merkleTree.getExtendedHexProof(accounts),
                            {from: accounts[0]}
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
                        accounts.slice(0,5),
                        merkleTree.getExtendedHexProof(accounts.slice(5,10)),
                        {from: accounts[0]}
                    ))
                })

                it("should fail if number of proofs != number of recipients", async ()=>{
                    await expectThrow(multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        accounts.slice(0,5),
                        merkleTree.getExtendedHexProof(accounts.slice(0,9)),
                        {from: accounts[0]}
                    ))
                })

                it("should update msg.sender's token balance correctly after passing in a full set of valid proofs and recipients", async () => {
                    const initBalance = (await token.balanceOf(accounts[0])).toNumber()
                    const expectedCallerTokenAmount = await merkleMine.callerTokenAmountAtBlock(web3.eth.blockNumber + 1)
                    
                    await multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        accounts,
                        merkleTree.getExtendedHexProof(accounts),
                        {from: accounts[0]}
                    )

                    const finalBalance = (await token.balanceOf(accounts[0])).toNumber()
                    assert.equal(finalBalance - initBalance, 9 * expectedCallerTokenAmount + TOKENS_PER_ALLOCATION)
                })

                it("should update msg.sender's balance correctly in case MultiMerkleMine already has a non-zero token balance prior to generation", async () => {
                    await token.mint(multiMerkleMine.address, 10000)

                    assert.equal(await token.balanceOf(multiMerkleMine.address), 10000)

                    const initBalance = (await token.balanceOf(accounts[0])).toNumber()
                    const expectedCallerTokenAmount = await merkleMine.callerTokenAmountAtBlock(web3.eth.blockNumber + 1)
                    
                    await multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        accounts,
                        merkleTree.getExtendedHexProof(accounts),
                        {from: accounts[0]}
                    )

                    const finalBalance = (await token.balanceOf(accounts[0])).toNumber()
                    assert.equal(finalBalance - initBalance, 9 * expectedCallerTokenAmount + TOKENS_PER_ALLOCATION)
                    assert.equal(await token.balanceOf(multiMerkleMine.address), 10000)
                })
            })

            describe("given a partially valid set of proofs and recipients", ()=>{
                beforeEach(async () => {
                    await rpc.waitUntilBlock((await merkleMine.callerAllocationStartBlock()))
                    const tx = await multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        accounts.slice(0,5),
                        merkleTree.getExtendedHexProof(accounts.slice(0,5)),
                        {from: accounts[0]}
                    )
                })

                it("should not change msg.sender's token balance if allocations for all the recipients in the set have already been generated", async () => {
                    const initBalance = (await token.balanceOf(accounts[9])).toNumber()
                    const expectedCallerTokenAmount = await merkleMine.callerTokenAmountAtBlock(web3.eth.blockNumber + 1)

                    const tx2 = await multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        accounts.slice(0,5),
                        merkleTree.getExtendedHexProof(accounts.slice(0,5)),
                        {from: accounts[9]}
                    )

                    const finalBalance = (await token.balanceOf(accounts[9])).toNumber()
                    assert.equal(finalBalance, initBalance)
                })

                it("should update msg.sender's token balance correctly when allocations for first 5 of 7 recipients in the set have already been generated", async () => {
                    const initBalance = (await token.balanceOf(accounts[9])).toNumber()
                    const expectedCallerTokenAmount = await merkleMine.callerTokenAmountAtBlock(web3.eth.blockNumber + 1)

                    const tx2 = await multiMerkleMine.multiGenerate(
                        merkleMine.address,
                        accounts.slice(0,7),
                        merkleTree.getExtendedHexProof(accounts.slice(0,7)),
                        {from: accounts[9]}
                    )

                    const finalBalance = (await token.balanceOf(accounts[9])).toNumber()
                    assert.equal(finalBalance - initBalance, 2 * expectedCallerTokenAmount)
                })

            })

    	})
    })
})