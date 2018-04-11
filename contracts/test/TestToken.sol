pragma solidity ^0.4.21;

import "zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract TestToken is MintableToken {
    string public name = "Test Token";
    uint8 public decimals = 18;
}
