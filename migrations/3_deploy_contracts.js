const config = require("./migrations.config.js")
const MerkleMine = artifacts.require("MerkleMine")

module.exports = function(deployer) {
    deployer.deploy(
        MerkleMine,
        config.token,
        config.genesisRoot,
        config.totalGenesisTokens,
        config.totalGenesisRecipients,
        config.balanceThreshold,
        config.genesisBlock,
        config.callerAllocationStartBlock,
        config.callerAllocationEndBlock
    )
}
