# MorphoPythOracle Deployment Guide

This guide explains how to deploy the MorphoPythOracle contract using the TypeScript deployment script.

## Prerequisites

1. **Node.js and npm** installed
2. **Forge** installed for contract compilation
3. **Private key** with sufficient ETH for gas fees
4. **Network access** to your target blockchain

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Compile contracts:**
   ```bash
   forge build
   ```

3. **Configure deployment parameters:**
   Edit the `EXAMPLE_CONFIG` in `deploy.ts` with your specific parameters:

   ```typescript
   const EXAMPLE_CONFIG: DeploymentConfig = {
     // Network configuration
     rpcUrl: "https://sepolia.base.org",
     privateKey: "YOUR_PRIVATE_KEY_HERE", // ⚠️ Replace with your private key
     
     // Pyth contract address for your network
     pythAddress: "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a",
     
     // Your specific configuration...
   };
   ```

## Configuration Parameters

### Network Configuration
- `rpcUrl`: RPC endpoint for your target network
- `privateKey`: Your wallet's private key (keep secure!)

### Pyth Configuration
- `pythAddress`: Pyth contract address for your network
  - Base Sepolia: `0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a`
  - Base Mainnet: `0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a`
  - See [Pyth docs](https://docs.pyth.network/price-feeds/contract-addresses/evm) for other networks

### Base Asset Configuration
- `baseVault`: ERC-4626 vault address (use `0x0000000000000000000000000000000000000000` for direct tokens)
- `baseVaultConversionSample`: Sample amount for vault conversion (use `1` for direct tokens)
- `baseFeed1`: Primary Pyth price feed ID (see [Pyth price feeds](https://www.pyth.network/developers/price-feed-ids))
- `baseFeed2`: Secondary Pyth price feed ID (use `0x0000000000000000000000000000000000000000000000000000000000000000` for no second feed)
- `baseTokenDecimals`: Number of decimals for the base token

### Quote Asset Configuration
- `quoteVault`: ERC-4626 vault address (use `0x0000000000000000000000000000000000000000` for direct tokens)
- `quoteVaultConversionSample`: Sample amount for vault conversion (use `1` for direct tokens)
- `quoteFeed1`: Primary Pyth price feed ID
- `quoteFeed2`: Secondary Pyth price feed ID (use `0x0000000000000000000000000000000000000000000000000000000000000000` for no second feed)
- `quoteTokenDecimals`: Number of decimals for the quote token

### Oracle Configuration
- `priceFeedMaxAge`: Maximum age in seconds for price feeds (recommended: 60-300 seconds)

## Common Price Feed IDs

### Base Sepolia
- WBTC/USD: `0xc9d8b075a5c69303365ae23633d4e085199bf5c520a3b90fed1322a0342ffc33`
- ETH/USD: `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace`
- USDT/USD: `0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b`
- USDC/USD: `0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722`

## Deployment

1. **Deploy the contract:**
   ```bash
   npm run deploy
   ```

2. **Get current price from deployed contract:**
   ```bash
   npm run deploy:price <CONTRACT_ADDRESS>
   ```

## Example Deployments

### WBTC/USDT Oracle (Direct Tokens)
```typescript
const config: DeploymentConfig = {
  rpcUrl: "https://sepolia.base.org",
  privateKey: "YOUR_PRIVATE_KEY",
  pythAddress: "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a",
  
  // WBTC configuration
  baseVault: "0x0000000000000000000000000000000000000000",
  baseVaultConversionSample: 1,
  baseFeed1: "0xc9d8b075a5c69303365ae23633d4e085199bf5c520a3b90fed1322a0342ffc33", // WBTC/USD
  baseFeed2: "0x0000000000000000000000000000000000000000000000000000000000000000",
  baseTokenDecimals: 8,
  
  // USDT configuration
  quoteVault: "0x0000000000000000000000000000000000000000",
  quoteVaultConversionSample: 1,
  quoteFeed1: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b", // USDT/USD
  quoteFeed2: "0x0000000000000000000000000000000000000000000000000000000000000000",
  quoteTokenDecimals: 6,
  
  priceFeedMaxAge: 60
};
```

### ETH/USDC Oracle with Vault
```typescript
const config: DeploymentConfig = {
  rpcUrl: "https://sepolia.base.org",
  privateKey: "YOUR_PRIVATE_KEY",
  pythAddress: "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a",
  
  // ETH configuration (with vault)
  baseVault: "0xYOUR_ETH_VAULT_ADDRESS",
  baseVaultConversionSample: 1000000000000000000, // 1 ETH
  baseFeed1: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // ETH/USD
  baseFeed2: "0x0000000000000000000000000000000000000000000000000000000000000000",
  baseTokenDecimals: 18,
  
  // USDC configuration (direct token)
  quoteVault: "0x0000000000000000000000000000000000000000",
  quoteVaultConversionSample: 1,
  quoteFeed1: "0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722", // USDC/USD
  quoteFeed2: "0x0000000000000000000000000000000000000000000000000000000000000000",
  quoteTokenDecimals: 6,
  
  priceFeedMaxAge: 120
};
```

## Security Considerations

1. **Private Key Security**: Never commit private keys to version control
2. **Vault Security**: Ensure vault contracts are trusted and manipulation-resistant
3. **Price Feed Age**: Set appropriate `priceFeedMaxAge` based on asset volatility
4. **Network Fees**: Ensure sufficient ETH balance for gas fees
5. **Testing**: Always test on testnets before mainnet deployment

## Troubleshooting

### Common Issues

1. **"Insufficient balance"**: Add more ETH to your wallet
2. **"Contract not found"**: Run `forge build` first
3. **"Invalid price feed"**: Verify price feed IDs are correct for your network
4. **"Vault conversion failed"**: Check vault address and conversion sample size

### Getting Help

- Check [Pyth documentation](https://docs.pyth.network/)
- Review [Morpho Blue documentation](https://docs.morpho.org/)
- Verify network-specific contract addresses

## Output

The deployment script will:
1. Deploy the contract
2. Display the contract address and transaction hash
3. Verify the deployment by calling view functions
4. Save deployment information to a JSON file
5. Provide instructions for using the deployed contract
