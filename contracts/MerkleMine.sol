pragma solidity ^0.4.21;

import "zeppelin-solidity/contracts/MerkleProof.sol";
import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title MerkleMine
 * @dev Token distribution based on providing Merkle proofs of inclusion in genesis state
 */
contract MerkleMine {
    using SafeMath for uint256;

    // ERC20 token being distributed
    ERC20 public token;
    // Merkle root representing genesis state which encodes token recipients
    bytes32 public merkleRoot;
    // Total amount of tokens that can be mined by recipients
    uint256 public totalMineableTokens;
    // Total number of recipients included in genesis state
    uint256 public totalRecipients;
    // Minimum ETH balance threshold for recipients included in genesis state
    uint256 public balanceThreshold;
    // Block number of genesis
    uint256 public genesisBlock;
    // Start block for mining period
    uint256 public startBlock;
    // End block for mining period
    uint256 public endBlock;

    // Track the already mined allocations for recipients
    mapping (address => bool) public mined;

    // Check that a recipient's allocation has not been mined
    modifier notMined(address _recipient) {
        require(!mined[_recipient]);
        _;
    }

    event Mine(address indexed _recipient, address indexed _caller, uint256 _recipientTokenAmount, uint256 _callerTokenAmount, uint256 _block);

    function MerkleMine(
        address _token,
        bytes32 _merkleRoot,
        uint256 _totalMineableTokens,
        uint256 _totalRecipients,
        uint256 _balanceThreshold,
        uint256 _genesisBlock,
        uint256 _endBlock
    )
        public
    {
        // Address of token contract must not be null
        require(_token != address(0));
        // Number of recipients must be non-zero
        require(_totalRecipients > 0);
        // Genesis block must be before the current block
        require(_genesisBlock <= block.number);
        // End block must be after the current block
        require(_endBlock > block.number);

        token = ERC20(_token);
        merkleRoot = _merkleRoot;
        totalMineableTokens = _totalMineableTokens;
        totalRecipients = _totalRecipients;
        balanceThreshold = _balanceThreshold;
        genesisBlock = _genesisBlock;
        startBlock = block.number;
        endBlock = _endBlock;
    }

    function mine(address _recipient, bytes _merkleProof) external notMined(_recipient) {
        // Check the Merkle proof
        bytes32 leaf = keccak256(_recipient);
        require(MerkleProof.verifyProof(_merkleProof, merkleRoot, leaf));

        mined[_recipient] = true;

        address caller = msg.sender;

        if (caller == _recipient) {
            token.transfer(_recipient, tokensPerMine());

            emit Mine(_recipient, _recipient, tokensPerMine(), 0, block.number);
        } else {
            uint256 callerTokenAmount = callerTokenAmountAtBlock(block.number);
            uint256 recipientTokenAmount = tokensPerMine().sub(callerTokenAmount);

            if (callerTokenAmount > 0) {
                token.transfer(caller, callerTokenAmount);
            }

            if (recipientTokenAmount > 0) {
                token.transfer(_recipient, recipientTokenAmount);
            }

            emit Mine(_recipient, caller, recipientTokenAmount, callerTokenAmount, block.number);
        }
    }

    function tokensPerMine() public view returns (uint256) {
        return totalMineableTokens.div(totalRecipients);
    }

    function callerTokenAmountAtBlock(uint256 _blockNumber) internal view returns (uint256) {
        if (_blockNumber >= endBlock) {
            return tokensPerMine();
        } else {
            uint256 blocksSinceStart = _blockNumber.sub(startBlock);
            uint256 miningPeriod = endBlock.sub(startBlock);
            return tokensPerMine().mul(blocksSinceStart).div(miningPeriod);
        }
    }
}
