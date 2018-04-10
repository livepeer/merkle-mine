pragma solidity ^0.4.21;

import "zeppelin-solidity/contracts/MerkleProof.sol";
import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title MerkleMine
 * @dev Token distribution based on providing Merkle proofs of inclusion in genesis state to generate allocation
 */
contract MerkleMine {
    using SafeMath for uint256;

    // ERC20 token being distributed
    ERC20 public token;
    // Merkle root representing genesis state which encodes token recipients
    bytes32 public genesisRoot;
    // Total amount of tokens that can be generated
    uint256 public totalGenesisTokens;
    // Total number of recipients included in genesis state
    uint256 public totalGenesisRecipients;
    // Minimum ETH balance threshold for recipients included in genesis state
    uint256 public balanceThreshold;
    // Block number of genesis - used to determine which ETH accounts are included in the genesis state
    uint256 public genesisBlock;
    // Start block where a third party caller (not the recipient) can generate and split the allocation with the recipient
    // As the current block gets closer to `callerAllocationEndBlock`, the caller receives a larger precentage of the allocation
    uint256 public callerAllocationStartBlock;
    // From this block onwards, a third party caller (not the recipient) can generate and claim the recipient's full allocation
    uint256 public callerAllocationEndBlock;

    // Track the already generated allocations for recipients
    mapping (address => bool) public generated;

    // Check that a recipient's allocation has not been generated
    modifier notGenerated(address _recipient) {
        require(!generated[_recipient]);
        _;
    }

    event Generate(address indexed _recipient, address indexed _caller, uint256 _recipientTokenAmount, uint256 _callerTokenAmount, uint256 _block);

    /**
     * @dev MerkleMine constructor
     * @param _token ERC20 token being distributed
     * @param _genesisRoot Merkle root representing genesis state which encodes token recipients
     * @param _totalGenesisTokens Total amount of tokens that can be generated
     * @param _totalGenesisRecipients Total number of recipients included in genesis state
     * @param _balanceThreshold Minimum ETH balance threshold for recipients included in genesis state
     * @param _genesisBlock Block number of genesis - used to determine which ETH accounts are included in the genesis state
     * @param _callerAllocationStartBlock Start block where a third party caller (not the recipient) can generate and split the allocation with the recipient
     * @param _callerAllocationEndBlock From this block onwards, a third party caller (not the recipient) can generate and claim the recipient's full allocation
     */
    function MerkleMine(
        address _token,
        bytes32 _genesisRoot,
        uint256 _totalGenesisTokens,
        uint256 _totalGenesisRecipients,
        uint256 _balanceThreshold,
        uint256 _genesisBlock,
        uint256 _callerAllocationStartBlock,
        uint256 _callerAllocationEndBlock
    )
        public
    {
        // Address of token contract must not be null
        require(_token != address(0));
        // Number of recipients must be non-zero
        require(_totalGenesisRecipients > 0);
        // Genesis block must be before the current block
        require(_genesisBlock <= block.number);
        // Start block for caller allocation must be after current block
        require(_callerAllocationStartBlock > block.number);
        // End block for caller allocation must be after caller allocation start block
        require(_callerAllocationEndBlock > _callerAllocationStartBlock);

        token = ERC20(_token);
        genesisRoot = _genesisRoot;
        totalGenesisTokens = _totalGenesisTokens;
        totalGenesisRecipients = _totalGenesisRecipients;
        balanceThreshold = _balanceThreshold;
        genesisBlock = _genesisBlock;
        callerAllocationStartBlock = _callerAllocationStartBlock;
        callerAllocationEndBlock = _callerAllocationEndBlock;
    }

    /**
     * @dev Generate a recipient's token allocation. Starting from `callerAllocationStartBlock`
     * a third party caller (not the recipient) can invoke this function to generate the recipient's token
     * allocation and claim a percentage of it. The percentage of the allocation claimed by the
     * third party caller is determined by how many blocks have elapsed since `callerAllocationStartBlock`.
     * After `callerAllocationEndBlock`, a third party caller can claim the full allocation
     * @param _recipient Recipient of token allocation
     * @param _merkleProof Proof of recipient's inclusion in genesis state Merkle root
     */
    function generate(address _recipient, bytes _merkleProof) external notGenerated(_recipient) {
        // Check the Merkle proof
        bytes32 leaf = keccak256(_recipient);
        // _merkleProof must prove inclusion of _recipient in the genesis state root
        require(MerkleProof.verifyProof(_merkleProof, genesisRoot, leaf));

        generated[_recipient] = true;

        address caller = msg.sender;

        if (caller == _recipient) {
            // If the caller is the recipient, transfer the full allocation to the caller/recipient
            token.transfer(_recipient, tokensPerAllocation());

            emit Generate(_recipient, _recipient, tokensPerAllocation(), 0, block.number);
        } else {
            // If the caller is not the recipient, the token allocation generation
            // can only take place if we are in the caller allocation period
            require(block.number >= callerAllocationStartBlock);

            uint256 callerTokenAmount = callerTokenAmountAtBlock(block.number);
            uint256 recipientTokenAmount = tokensPerAllocation().sub(callerTokenAmount);

            if (callerTokenAmount > 0) {
                token.transfer(caller, callerTokenAmount);
            }

            if (recipientTokenAmount > 0) {
                token.transfer(_recipient, recipientTokenAmount);
            }

            emit Generate(_recipient, caller, recipientTokenAmount, callerTokenAmount, block.number);
        }
    }

    /**
     * @dev Return amount of tokens per allocation (for a recipient)
     */
    function tokensPerAllocation() public view returns (uint256) {
        return totalGenesisTokens.div(totalGenesisRecipients);
    }

    /**
     * @dev Return the amount of tokens claimable by a third party caller when generating a recipient's token allocation at a given block
     * @param _blockNumber Block at which to compute the amount of tokens claimable by a third party caller
     */
    function callerTokenAmountAtBlock(uint256 _blockNumber) internal view returns (uint256) {
        if (_blockNumber >= callerAllocationEndBlock) {
            return tokensPerAllocation();
        } else {
            uint256 blocksSinceCallerAllocationStartBlock = _blockNumber.sub(callerAllocationStartBlock);
            uint256 callerAllocationPeriod = callerAllocationEndBlock.sub(callerAllocationStartBlock);
            return tokensPerAllocation().mul(blocksSinceCallerAllocationStartBlock).div(callerAllocationPeriod);
        }
    }
}
