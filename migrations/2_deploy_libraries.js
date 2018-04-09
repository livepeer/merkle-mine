const MerkleProof = artifacts.require("MerkleProof")
const MerkleMine = artifacts.require("MerkleMine")

module.exports = function(deployer) {
    deployer.deploy(MerkleProof)
    deployer.link(MerkleProof, MerkleMine)
}
