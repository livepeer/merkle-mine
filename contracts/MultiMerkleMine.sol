pragma solidity ^0.4.24;

import "./MerkleMine.sol";
import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

contract MultiMerkleMine {

	using SafeMath for uint256;

	bytes[] private _proofs;

	event AlreadyGenerated(address indexed recipient, address indexed caller);

	function extractProofs(bytes _merkleProofs) internal returns(bytes[]) {
		require(_merkleProofs.length != 0, 'No proofs supplied!');
		for(uint256 i=0; i<_merkleProofs.length; i++){
		    uint256 proofSize = uint256(_merkleProofs[i]);
		    require(proofSize % 32 == 0, 'Invalid proof detected!');
		    bytes memory _proof = new bytes(proofSize);
		    uint256 j = 0;
		    while(j<proofSize){
		        _proof[j]=_merkleProofs[i+1];
		        i+=1;
		        j+=1;
		    }
		    _proofs.push(_proof);
		}
		
		return _proofs;
	}

	function multiGenerate(address _merkleMineContract, address[] _recipients, bytes _merkleProofs) public {
		MerkleMine mine = MerkleMine(_merkleMineContract);
		ERC20 token = ERC20(mine.token());

		require (block.number >= mine.callerAllocationStartBlock());
		
		uint256 initialBalance = token.balanceOf(this);
		bytes[] memory proofs = extractProofs(_merkleProofs);
		
		require(proofs.length == _recipients.length, 'Number of recipients and proofs is not equal!');
		
		for(uint256 i=0; i < _recipients.length; i++){
			if(!mine.generated(_recipients[i])){
				mine.generate(_recipients[i], proofs[i]);
			}else{
				emit AlreadyGenerated(_recipients[i], msg.sender);
			}
		}

		uint256 newBalanceSinceAllocation = token.balanceOf(this);
		uint256 callerTokensGenerated = newBalanceSinceAllocation.sub(initialBalance);

		if(callerTokensGenerated > 0){
			token.transfer(msg.sender, callerTokensGenerated);
		}

		delete _proofs;
	}
	
}