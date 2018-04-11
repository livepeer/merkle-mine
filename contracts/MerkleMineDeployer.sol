pragma solidity ^0.4.21;

import "./MerkleMine.sol";

import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract MerkleMineDeployer {
    event MerkleMineDeployed(address indexed merkleMineAddress);

    function deploy(
        address _token,
        bytes32 _genesisRoot,
        uint256 _totalGenesisTokens,
        uint256 _totalGenesisRecipients,
        uint256 _balanceThreshold,
        uint256 _genesisBlock,
        uint256 _callerAllocationStartBlock,
        uint256 _callerAllocationEndBlock
    )
        external
    {
        MerkleMine merkleMine = new MerkleMine(
            _token,
            _genesisRoot,
            _totalGenesisTokens,
            _totalGenesisRecipients,
            _balanceThreshold,
            _genesisBlock,
            _callerAllocationStartBlock,
            _callerAllocationEndBlock
        );

        ERC20 token = ERC20(_token);
        token.transferFrom(msg.sender, address(merkleMine), _totalGenesisTokens);

        emit MerkleMineDeployed(address(merkleMine));
    }
}
