pragma solidity ^0.4.24;

import "./MerkleMine.sol";
import "zeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

import "./BytesUtil.sol";


contract MultiMerkleMine {

	using SafeMath for uint256;

	event AlreadyGenerated(address indexed recipient, address indexed caller);

	function multiGenerate(address _merkleMineContract, address[] _recipients, bytes _merkleProofs) public {
		MerkleMine mine = MerkleMine(_merkleMineContract);
		ERC20 token = ERC20(mine.token());

		require (block.number >= mine.callerAllocationStartBlock());
		
		uint256 initialBalance = token.balanceOf(this);
		bytes[] memory _proofs = new bytes[](_recipients.length);

		uint256 i=0;
		uint256 j=0;
		while(i < _merkleProofs.length){
			require(j < _recipients.length, 'Number of recipients != Number of proofs !');
			uint256 proofSize = uint256(_merkleProofs[i]);
		    require(proofSize % 32 == 0, 'Invalid proof detected!');
		    bytes memory proof = BytesUtil.substr(_merkleProofs, i+1, proofSize);
		    _proofs[j] = proof;
		    i = i + proofSize + 1;
		    j = j + 1; 
		}
		
		for(uint256 k=0; k < _recipients.length; k++){
			if(!mine.generated(_recipients[k])){
				mine.generate(_recipients[k], _proofs[k]);
			}else{
				emit AlreadyGenerated(_recipients[k], msg.sender);
			}
		}

		uint256 newBalanceSinceAllocation = token.balanceOf(this);
		uint256 callerTokensGenerated = newBalanceSinceAllocation.sub(initialBalance);

		if(callerTokensGenerated > 0){
			token.transfer(msg.sender, callerTokensGenerated);
		}
	}
	
}