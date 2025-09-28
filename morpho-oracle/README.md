# PYTH HERMES CLIENT 

A Solidity smart contract that integrates with Pyth Network price feeds to mint NFTs based on real-time ETH/USD prices. This project demonstrates how to build DeFi applications using Pyth's oracle infrastructure.

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd my_first_pyth_app/contracts
npm install
```

### 2. Environment Setup

Create a `.env` file in the project root:

```bash
# Your private key (without 0x prefix)
PRIVATE_KEY="your_private_key_here"

# Your deployed contract address (update after deployment)
DEPLOYMENT_ADDRESS="0xYourContractAddress"

# Pyth ETH/USD price feed ID for Base Sepolia
ETH_USD_ID="0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
```

### 3. Deploy Contracts

#### Deploy Main Contract

```bash
forge create src/MyFirstPythContract.sol:MyFirstPythContract \
--private-key "your_private_key" \
--rpc-url "https://sepolia.base.org" \
--broadcast \
--constructor-args "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729" "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
```

#### Deploy Morpho Oracle Factory (Optional)

```bash
forge create src/morpho-pyth/MorphoPythOracleFactory.sol:MorphoPythOracleFactory \
--private-key "your_private_key" \
--rpc-url "https://sepolia.base.org" \
--broadcast
```

### 4. Update Environment

After deployment, update your `.env` file with the new contract address.

### 5. Mint Your First NFT

```bash
npm run mint
```

## 🏗️ Contract Architecture

### MyFirstPythContract

The main contract that demonstrates Pyth integration:

```solidity
contract MyFirstPythContract {
    IPyth pyth;
    bytes32 ethUsdPriceId;
    
    function mint() public payable;
    function updateAndMint(bytes[] calldata pythPriceUpdate) external payable;
}
```

#### Key Functions

- **`mint()`**: Gets latest ETH/USD price and mints NFT if payment is sufficient
- **`updateAndMint()`**: Updates Pyth price feeds and mints in one transaction

### MorphoPythOracleFactory

Advanced oracle factory for Morpho protocol integration:

```solidity
contract MorphoPythOracleFactory {
    function createOracle(address asset, bytes32 priceId) external returns (address);
}
```

## 💻 Usage Examples

### TypeScript Integration

```typescript
import { createWalletClient, http, parseEther } from "viem";
import { HermesClient } from "@pythnetwork/hermes-client";

// Fetch price update data
const connection = new HermesClient("https://hermes.pyth.network");
const priceFeedUpdateData = await connection.getLatestPriceUpdates(priceIds);

// Call contract
const hash = await contract.write.updateAndMint(
  [[`0x${priceFeedUpdateData.binary.data[0]}`]],
  { value: parseEther("0.001") }
);
```

### Cast CLI Alternative

```bash
cast send \
  --private-key "your_private_key" \
  --rpc-url "https://sepolia.base.org" \
  --value 0.001ether \
  "0xYourContractAddress" \
  "updateAndMint(bytes[])" \
  [0x`cat price_update.txt`]
```

## 🔧 Development

### Build

```bash
forge build
```

### Test

```bash
forge test
```

### Format Code

```bash
forge fmt
```

### Gas Analysis

```bash
forge snapshot
```

### Local Development

```bash
anvil
```

## 🌐 Network Configuration

| Network | RPC URL | Pyth Contract | ETH/USD Price Feed |
|---------|---------|---------------|-------------------|
| Base Sepolia | `https://sepolia.base.org` | `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729` | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |

## 🐛 Troubleshooting

### Common Issues

#### 1. Environment Variable Errors
```
Error: ETH_USD_ID environment variable is required
```
**Solution**: Ensure your `.env` file uses `ETH_USD_ID` (not `ETH_USD_PRICE_ID`)

#### 2. Transaction Reverts
```
ContractFunctionExecutionError: The contract function "updateAndMint" reverted
```
**Solutions**:
- Send enough ETH to cover Pyth update fee + mint fee
- Verify contract address in `.env` matches deployed contract
- Check that price update data is valid

#### 3. Insufficient Fee Error
```
error InsufficientFee();
```
**Solution**: The contract requires payment equivalent to $1 USD in ETH. Current ETH price determines minimum payment.

### Getting Test ETH

Get Base Sepolia ETH from:
- [Base Sepolia Faucet](https://bridge.base.org/deposit)
- [Alchemy Faucet](https://sepoliafaucet.com/)

## 📊 Project Structure

```
contracts/
├── src/
│   ├── MyFirstPythContract.sol          # Main Pyth integration contract
│   └── morpho-pyth/
│       └── MorphoPythOracleFactory.sol  # Morpho oracle factory
├── test/
│   ├── MyFirstPythContractTest.t.sol    # Solidity tests
│   └── mintNft.ts                       # TypeScript interaction script
├── lib/
│   └── forge-std/                       # Foundry standard library
├── out/                                 # Compiled contracts
├── .env                                 # Environment variables
├── foundry.toml                         # Foundry configuration
├── package.json                         # Node.js dependencies
└── tsconfig.json                        # TypeScript configuration
```

## 🔗 Integration Examples

### With Frontend Applications

```typescript
// React/Next.js example
import { useContractWrite } from 'wagmi';

const { write: updateAndMint } = useContractWrite({
  address: '0xYourContractAddress',
  abi: contractABI,
  functionName: 'updateAndMint',
});
```

### With Other DeFi Protocols

The MorphoPythOracleFactory can be integrated with:
- Lending protocols
- DEX aggregators
- Yield farming strategies
- Risk management systems

## 📚 Learn More

- [Pyth Network Documentation](https://docs.pyth.network/)
- [Foundry Book](https://book.getfoundry.sh/)
- [Viem Documentation](https://viem.sh/)
- [Base Documentation](https://docs.base.org/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Pyth Network](https://pyth.network/) for providing reliable price feeds
- [Foundry](https://book.getfoundry.sh/) for the excellent development framework
- [Base](https://base.org/) for the testnet infrastructure

---

**Happy Building! 🎉**

For questions or support, please open an issue or reach out to the community.