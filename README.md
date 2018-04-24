# merkle-mine

## Requirements

Node.js >= 8.5.0

## Building

```
git clone https://github.com/livepeer/merkle-mine.git
cd merkle-mine
npm install
```

## Running Client Scripts

In the following sections, it is assumed that the user has obtained a file with a list of accounts created from steps 1 and 2 in the MerkleMine token generation algorithm
defined in the [specification](SPEC.md). This file might have been obtained from a hosted source such as IPFS or independently created by following steps 1 and 2 in the MerkleMine
token generation algorithm in the specification.

Flags
- `--rinkeby`: boolean flag to indicate that the script should use the Rinkeby Ethereum test network
- `--dev`: boolean flag to indicate that the script should use an Ethereum client running with JSON-RPC endpoints at http://localhost:8545
- `--acctFile`: path to file with list of accounts to be used for Merkle tree construction
- `--generate`: boolean flag to indicate whether the script should submit the MerkleMine contract transaction
- `--datadir`: path to data directory containing local keystore files. Required if `--generate` flag is enabled
- `--caller`: address of account used to submit the MerkleMine contract transaction. Required if `--generate` flag is enabled
- `--merkleMine`: address of MerkleMine contract
- `--recipient`: address of account that is included in the MerkleMine genesis state that is the recipient of a token allocation
- `--gasPrice`: gas price to use for submission of MerkleMine contract transaction. Default: 5 GWEI

### Generating a token allocation

Note: the `--max-old-space-size=4096` flag is to increase the Node.js memory limit from its default to ensure that the current Merkle tree construction implementation
can complete (4096 is an arbitrarily set value).

```
# By default this command will use the Ethereum main network
# Use the --rinkeby flag to use the Rinkeby Ethereum test network
# Use the --dev flag to use a custom development network with an Ethereum client (ganache-cli, Geth, Parity) running with JSON-RPC endpoints at http://localhost:8545
node --max-old-space-size=4096 client/index.js --generate --acctFile [accounts file] --datadir [data directory] --merkleMine [MerkleMine address] --recipient [recipient address] --caller [caller address]
```

This script will perform a number of validation checks in accordance with the specification, construct the Merkle proof for the given recipient and then submit
a transaction from the given caller to the MerkleMine contract to generate a token allocation for the given recipient using the constructed Merkle proof.

After you have generated your token, use the [Livepeer Protocol Explorer](https://explorer.livepeer.org/) to participate in the Livepeer network and delegate towards a transcoder.

### Constructing a Merkle proof for a recipient

```
# By default this command will use the Ethereum main network
# Use the --rinkeby flag to use the Rinkeby Ethereum test network
# Use the --dev flag to use a custom development network with an Ethereum client (ganache-cli, Geth, Parity) running with JSON-RPC endpoints at http://localhost:8545
node --max-old-space-size=4096 client/index.js --acctFile [accounts file] --merkleMine [MerkleMine address] --recipient [recipient address]
```

The script will perform a number of validation checks in accordance with the specification and then output the Merkle proof for the given recipient.

### Constructing a Merkle root

```
node --max-old-space-size=4096 client/makeRoot.js --acctFile [accounts file]
```

The script will output the Merkle root of the constructed Merkle tree and the number of leaves (recipient accounts included).

## Developing with the MerkleMine Contract

### Testing

```
npm run test
```

### Deploying

```
# Generate `genesisRoot` and `totalGenesisRecipients`
npm run client/makeRoot.js --acctFile [accounts file]

# Configure `genesisRoot` and `totalGenesisRecipients` in `migrations/migrations.config.js`

# <network-name> can take on the following values
# - `dev`: Use a custom development network with an Ethereum client (ganache-cli, Geth, Parity) running with JSON-RPC endpoints at http://localhost:8545
# - `rinkeby`: Use the Rinkeby Ethereum test network (supported by Infura)
# - `mainnet`: Use the Ethereum main network (supported by Infura)

# Set the environment variable DATA_DIR=<data-directory>
# <data-directory> is the directory in which your local keystore files live
# If using `rinkeby`, set the environment variable RINKEBY_ACCOUNT=<deployment-account>
# If using `mainnet`, set the environment variable MAINNET_ACCOUNT=<deployment-account>
# <deployment-account> is the account you would like to submit the deployment transactions with
# If using `dev`, the local Ethereum client will manage the deployment account
npm run migrate -- --network=<network-name>
```
