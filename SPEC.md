# MerkleMine Specification

The MerkleMine algorithm is a distribution mechanic for allocating token at the genesis state of the network across a large number of participants.

The distribution algorithm consists of:

* A Genesis State
* A `generate()` function

## Genesis State

A genesis state `G` is consists of:

* `genesisRoot` - the merkle root of the genesis state
* `balanceThreshold` - the minimum balance of an account who's address is used in the genesis state.
* `totalGenesisTokens` - the amount of token to be distributed for the duration of the mining period
* `totalGenesisRecipients` - the # of account addresses used in construction of the genesis state
* `genesisBlock` - the genesis Ethereum block number
* `callerAllocationStartBlock` - the block at which a 3rd party caller has an incentive to generate token on another recipient's behalf.
* `callerAllocationEndBlock` - the block at which a 3rd party caller can generate the full token allocation of the original intended recipient

### Algorithm for constructing the genesisRoot

*This is done offline and is repeatable by anyone to validate the `genesisMerkleRoot` and construct their own proofs*

1. Observe the Ethereum account state database at `genesisBlock`.
1. For each account:
    1. If `getBalance(account) > balanceThreshold && len(getCode(account)) == 0` then add the account to `candidateAccounts` array. `// Only user controlled acounts with balance greater than balanceThreshold.`
1. Sort the `candidateAccounts` array in ascending order of uint value of the account hex address.
1. Use sorted `candidateAccounts` as ordered leaf nodes of merkle tree construction. Each leaf node of the Merkle tree is the keccak256 hash of the hex encoded byte representation of a particular address string.
1. Validate that root of merkle tree == the `genesisRoot` in genesis state.

## generate() function

The `generate()` function has the following signature:

```
function generate(address _recipient, bytes _merkleProof)
```

A user who wishes to generate token passes in the address of the recipient (it may be themselves), and then merkle proof that verifies the recipient is in the genesis state as specified by the `genesisRoot` genesis parameter.

**Validations**

The method should `throw` and revert state if the following validations do not pass:

* tokens were not already generated for this `_recipient`
* the `_merkleProof` provided validates against the `genesisRoot`
* if the txn sender (the "caller") does not equal the `_recipient`, then make sure `block.number` is greater than or equal to `callerAllocationStartBlock`

**Generation**

Let `tokensPerAllocation` = `totalGenesisTokens` / `totalGenesisRecipients`. The starting point is that all recipients get an even distribution of token.

* If the caller is the `_recipient` then transfer `tokensPerAllocation` to the caller.
* If the caller is not the `_recipient`:
    * Calculate the caller portion using the `callerTokenAmountAtBlock` curve.
    * Calculate the recipient portion by subtracting `callerTokenAmountAtBlock` from `tokensPerAllocation`.
    * Send the caller portion to the caller and the recipient portion to the `_recipient`.
* Record state that this recipient's tokens have been generated, so that tokens can no longer be generated with this same `_recipient` argument and merkle proof again.


### callerTokenAmountAtBlock curve 

This curve indicates how much LPT is claimable by the txn sender (caller) versus how much gets distributed to the `_recipient`. This amount grows linearly with how many blocks have passed between `callerAllocationStartBlock` and `callerAllocationEndBlock`.

* if `block.number` > `callerAllocationEndBlock` then return the full `tokensPerAllocation`.
* Otherwise calculate how far proportionally you are into the period between `callerAllocationStartBlock` and `callerAllocationEndBlock`. Return the `tokensPerAllocation` multiplied by this proportional percentage.

For example if tokensPerAllocation is 10, and you are 50% into the period, return 5. 

## End result

The end result of all of this is that there is a wide generation of token, potentially to all accounts encoded into the genesis state. But there are incentives for others to perform the generation to many of these accounts through the growing `callerTokenAmountAtBlock` value. 

* participation is open to all, whether you had enough ETH to be in the genesis set or not
* active participants will generate more than passive recipients
* passive participants will still end up with a little bit of token that they can use to start interacting with the protocol later when they discover it.
