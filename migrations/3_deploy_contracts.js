const config = require("./migrations.config.js")

const MerkleMine = artifacts.require("MerkleMine")
const TestToken = artifacts.require("TestToken")

const deploy = async (deployer, artifact, ...args) => {
    await deployer.deploy(artifact, ...args)
    return await artifact.deployed()
}

const getCurrentBlock = async () => {
    return new Promise((resolve, reject) => {
        return web3.eth.getBlockNumber((err, blkNum) => {
            if (err) {
                reject(err)
            } else {
                resolve(blkNum)
            }
        })
    })
}

module.exports = function(deployer, network) {
    deployer.then(async () => {
        const currentBlock = await getCurrentBlock()

        if (network === "rinkeby" || network === "mainnet") {
            await deploy(
                deployer,
                MerkleMine,
                config.token,
                config.genesisRoot,
                config.totalGenesisTokens,
                config.totalGenesisRecipients,
                config.balanceThreshold,
                config.genesisBlock,
                currentBlock + config.blocksToCliff,
                currentBlock + config.blocksToCliff + config.callerAllocationPeriod
            )
        } else {
            deployer.logger.log("On dev network - creating test ERC20 token")

            const token = await deploy(deployer, TestToken)
            const merkleMine = await deploy(
                deployer,
                MerkleMine,
                token.address, // Use custom test ERC20 token on dev chain
                config.genesisRoot,
                config.totalGenesisTokens,
                config.totalGenesisRecipients,
                config.balanceThreshold,
                0, // Set default genesis block on a dev chain to block 0
                currentBlock + config.blocksToCliff,
                currentBlock + config.blocksToCliff + config.callerAllocationPeriod
            )

            await token.mint(merkleMine.address, config.totalGenesisTokens)
            deployer.logger.log(`Minted ${config.totalGenesisTokens} to MerkleMine`)

            await merkleMine.start()
            deployer.logger.log(`Started MerkleMine`)
        }
    })
}
