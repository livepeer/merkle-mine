const MultiMerkleMine = artifacts.require("MultiMerkleMine")

const deploy = async (deployer, artifact, ...args) => {
    await deployer.deploy(artifact, ...args)
    return await artifact.deployed()
}

module.exports = function(deployer, network) {
    deployer.then(async () => {
        await deploy(deployer, MultiMerkleMine)
    })
}