# MerkleMine Specification

The MerkleMine algorithm is a distribution mechanic for allocating token at the genesis state of the network across a large number of participants.

The distribution algorithm consists of:

* A Genesis State
* A `generate()` function

## Genesis State

A genesis state `G` is consists of:

* `genesisRoot` - the Merkle root of the genesis state
* `balanceThreshold` - the minimum ETH balance for an account's address to be included in the genesis state
* `totalGenesisTokens` - the amount of token to be distributed for the duration of the generation period
* `totalGenesisRecipients` - the # of account addresses used in the construction of the genesis state
* `genesisBlock` - the Ethereum block number at which a state dump of accounts is used to construct the genesis state
* `callerAllocationStartBlock` - the block at which a 3rd party caller can generate and split a token allocation with a recipient
* `callerAllocationEndBlock` - the block at which a 3rd party caller can generate the full token allocation of the original intended recipient

### Algorithm for generating a token allocation

*This is done offline and is repeatable by anyone to validate the `genesisRoot` and construct their own proofs to be used for token allocation generation*

1. Observe the Ethereum account state database at `genesisBlock`.
2. For each account:
    1. If `getBalance(account) > balanceThreshold && len(getCode(account)) == 0` then add the account to `candidateAccounts` array. `// Only user controlled acounts with balance greater than balanceThreshold.`
3. Sort the `candidateAccounts` array in ascending order of the hexadecimal value for each account address.
4. Use the sorted `candidateAccounts` to create the leaf nodes of a [Merkle tree](https://en.wikipedia.org/wiki/Merkle_tree). The hashing algorithm used for the
Merkle tree construction is keccak256.
    1. Each leaf node of the tree is the hash of the hexadecimal encoded account address in `candidateAccounts`. The order of the leaf nodes matches
    the order of the sorted `candidateAccounts`
    2. Each intermediary parent node of the tree is a hash calculated as `keccak256(concat(sorted([A, B])))` where `A` and `B` are child nodes (hashes) in the tree
    and they are sorted in ascending order of their hexadecimal value. When creating the parents of leaves, if there are an odd number of leaves such that a particular
    leaf `A` does not have a sibling, let the value for the parent of the leaf also be `A`
    3. Let the root of the Merkle tree be `localRoot`
5. Validate that `len(candidateAccounts) == totalGenesisRecipients`.
6. Validate that `localRoot == genesisRoot`.
7. Validate locally that the Merkle proof for the recipient is valid for the Merkle root.
8. Validate that the generation period has started.
9. Validate that `token.balanceOf(merkleMine) >= tokenAllocationAmount`.
10. Validate that the token allocation for the account has not been generated.
11. Invoke `generate()` with the Merkle proof of an account's inclusion in `genesisRoot`.
    1. The Merkle proof is an array of 32 byte hashes concatenated together

## generate() function

The `generate()` function has the following signature:

```
function generate(address _recipient, bytes _merkleProof)
```

A user who wishes to generate token passes in the address of the recipient (it may be themselves), and the Merkle proof that verifies the recipient is in the genesis state as specified by the `genesisRoot` genesis parameter.

**Validations**

The method should `throw` and revert state if the following validations do not pass:

* Tokens were not already generated for this `_recipient`
* The `_merkleProof` provided validates against the `genesisRoot`
* If the txn sender (the "caller") does not equal the `_recipient`, then make sure `block.number` is greater than or equal to `callerAllocationStartBlock`

**Generation**

Let `tokensPerAllocation` = `totalGenesisTokens` / `totalGenesisRecipients`. The starting point is that all recipients get an even distribution of token.

* If the caller is the `_recipient` then transfer `tokensPerAllocation` to the caller.
* If the caller is not the `_recipient`:
    * Calculate the caller portion using the `callerTokenAmountAtBlock` curve.
    * Calculate the recipient portion by subtracting `callerTokenAmountAtBlock` from `tokensPerAllocation`.
    * Send the caller portion to the caller and the recipient portion to the `_recipient`.
* Record state that this recipient's tokens have been generated, so that tokens can no longer be generated with this same `_recipient` argument and Merkle proof again.


### callerTokenAmountAtBlock curve

This curve indicates how much LPT is claimable by the txn sender (caller) versus how much gets distributed to the `_recipient`. This amount grows linearly with how many blocks have passed between `callerAllocationStartBlock` and `callerAllocationEndBlock`.

* If `block.number` > `callerAllocationEndBlock` then return the full `tokensPerAllocation`.
* Otherwise calculate how far proportionally you are into the period between `callerAllocationStartBlock` and `callerAllocationEndBlock`. Return the `tokensPerAllocation` multiplied by this proportional percentage.

For example if tokensPerAllocation is 10, and you are 50% into the period, return 5.

## End result

The end result of all of this is that there is a wide generation of token, potentially to all accounts encoded into the genesis state. But there are incentives for others to perform the generation on behalf of many of these accounts through the growing `callerTokenAmountAtBlock` value.

* Participation is open to all, whether you had enough ETH to be in the genesis set or not
* There is a period of time for recipients to learn about the process such that they can generate their full allocation
* The caller allocation period allows active participants to generate more tokens than passive recipients while still allowing for the possibility for passive participants
to end up with some amount of token (depending on when active participants generate allocations on behalf of recipients) that they can use to start
interacting with the protocol later
