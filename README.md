# merkle-mine

## Requirements

Node.js >= 8.5.0

## Building and Testing Contracts

```
git clone https://github.com/livepeer/merkle-mine.git
cd merkle-mine
npm install

npm run compile
npm run test
```

## Running the client

```
git clone https://github.com/livepeer/merkle-mine.git
cd merkle-mine
npm install

# By default this command will use the mainnet network
# Use the --rinkeby flag to use the Rinkeby network
# Use the --dev flag to use a custom development network with an Ethereum client running on localhost
node client/index.js --acctFile [accounts file] --datadir [data directory] --merkleMine [MerkleMine address] --recipient [recipient address] --caller [caller address]
```

## Working with a local dev chain

```
# Generate `genesisRoot` and `totalGenesisRecipients`
npm run client/makeRoot.js --acctFile [accounts file]

# Configure `genesisRoot` and `totalGenesisRecipients` in `migrations/migrations.config.js`

npm run migrate -- --network=dev
```
