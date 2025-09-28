import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// Contract ABIs
const MORPHO_PYTH_ORACLE_FACTORY_ABI = [
  "function createMorphoPythOracle(address pyth_, address baseVault, uint256 baseVaultConversionSample, bytes32 baseFeed1, bytes32 baseFeed2, uint256 baseTokenDecimals, address quoteVault, uint256 quoteVaultConversionSample, bytes32 quoteFeed1, bytes32 quoteFeed2, uint256 quoteTokenDecimals, uint256 priceFeedMaxAge, bytes32 salt) external returns (address)",
  "function isMorphoPythOracle(address target) external view returns (bool)",
  "event CreateMorphoPythOracle(address caller, address oracle)"
] as const;

const MORPHO_PYTH_ORACLE_ABI = [
  "function price() external view returns (uint256)",
  "function BASE_VAULT() external view returns (address)",
  "function QUOTE_VAULT() external view returns (address)",
  "function BASE_FEED_1() external view returns (bytes32)",
  "function BASE_FEED_2() external view returns (bytes32)",
  "function QUOTE_FEED_1() external view returns (bytes32)",
  "function QUOTE_FEED_2() external view returns (bytes32)",
  "function PRICE_FEED_MAX_AGE() external view returns (uint256)",
  "function SCALE_FACTOR() external view returns (uint256)",
  "function pyth() external view returns (address)"
] as const;

// Configuration
const CONFIG = {
  // Base Sepolia network
  rpcUrl: "https://sepolia.base.org",
  privateKey: "0xe9fab966e2f56c4830d0ce5b4a75ec6ff2850575054aadf0e6f60ee6380f8b01",
  
  // Deployed contracts
  factoryAddress: "0xd87EF54A122Fb53623834fC4C8844cA05c532F0F", // Your deployed factory
  pythAddress: "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a", // Pyth on Base Sepolia
  
  // Oracle parameters
  baseVault: "0x0000000000000000000000000000000000000000", // No vault
  baseVaultConversionSample: 1,
  baseFeed1: "0xc9d8b075a5c69303365ae23633d4e085199bf5c520a3b90fed1322a0342ffc33", // WBTC/USD
  baseFeed2: "0x0000000000000000000000000000000000000000000000000000000000000000", // No second feed
  baseTokenDecimals: 8,
  
  quoteVault: "0x0000000000000000000000000000000000000000", // No vault
  quoteVaultConversionSample: 1,
  quoteFeed1: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b", // USDT/USD
  quoteFeed2: "0x0000000000000000000000000000000000000000000000000000000000000000", // No second feed
  quoteTokenDecimals: 6,
  
  priceFeedMaxAge: 60 // 1 minute
};

async function interactWithContracts() {
  try {
    console.log("🔗 Connecting to Base Sepolia...");
    
    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
    const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
    
    console.log(`👤 Connected as: ${wallet.address}`);
    
    // Connect to the factory
    const factory = new ethers.Contract(
      CONFIG.factoryAddress,
      MORPHO_PYTH_ORACLE_FACTORY_ABI,
      wallet
    );
    
    console.log(`🏭 Factory address: ${CONFIG.factoryAddress}`);
    
    // Generate a unique salt for this oracle
    const salt = ethers.keccak256(ethers.toUtf8Bytes(`WBTC_USDT_${Date.now()}`));
    console.log(`🧂 Using salt: ${salt}`);
    
    // Create new oracle (factory doesn't track by salt, only by address)
    console.log("🚀 Creating new MorphoPythOracle...");
    console.log("📋 Parameters:");
    console.log(`   Pyth: ${CONFIG.pythAddress}`);
    console.log(`   Base Feed 1: ${CONFIG.baseFeed1}`);
    console.log(`   Quote Feed 1: ${CONFIG.quoteFeed1}`);
    console.log(`   Price Feed Max Age: ${CONFIG.priceFeedMaxAge}s`);
    
    const tx = await factory.createMorphoPythOracle(
      CONFIG.pythAddress,
      CONFIG.baseVault,
      CONFIG.baseVaultConversionSample,
      CONFIG.baseFeed1,
      CONFIG.baseFeed2,
      CONFIG.baseTokenDecimals,
      CONFIG.quoteVault,
      CONFIG.quoteVaultConversionSample,
      CONFIG.quoteFeed1,
      CONFIG.quoteFeed2,
      CONFIG.quoteTokenDecimals,
      CONFIG.priceFeedMaxAge,
      salt
    );
    
    console.log(`⏳ Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`✅ Oracle created! Gas used: ${receipt?.gasUsed.toString()}`);
    
    // Get the oracle address from the event
    const event = receipt?.logs.find(log => {
      try {
        const parsed = factory.interface.parseLog(log);
        return parsed?.name === 'CreateMorphoPythOracle';
      } catch {
        return false;
      }
    });
    
    let oracleAddress: string;
    if (event) {
      const parsed = factory.interface.parseLog(event);
      oracleAddress = parsed?.args.oracle;
      console.log(`📍 New oracle address: ${oracleAddress}`);
    } else {
      throw new Error("Could not find CreateMorphoPythOracle event");
    }
    
    // Verify the oracle was created by the factory
    const isValidOracle = await factory.isMorphoPythOracle(oracleAddress);
    console.log(`✅ Oracle verified by factory: ${isValidOracle}`);
    
    // Connect to the oracle
    const oracle = new ethers.Contract(
      oracleAddress,
      MORPHO_PYTH_ORACLE_ABI,
      provider // Use provider for read-only operations
    );
    
    console.log("\n🔍 Reading oracle configuration...");
    
    // Read oracle configuration
    const [
      pythAddress,
      baseVault,
      quoteVault,
      baseFeed1,
      baseFeed2,
      quoteFeed1,
      quoteFeed2,
      priceFeedMaxAge,
      scaleFactor
    ] = await Promise.all([
      oracle.pyth(),
      oracle.BASE_VAULT(),
      oracle.QUOTE_VAULT(),
      oracle.BASE_FEED_1(),
      oracle.BASE_FEED_2(),
      oracle.QUOTE_FEED_1(),
      oracle.QUOTE_FEED_2(),
      oracle.PRICE_FEED_MAX_AGE(),
      oracle.SCALE_FACTOR()
    ]);
    
    console.log("📊 Oracle Configuration:");
    console.log(`   Pyth Address: ${pythAddress}`);
    console.log(`   Base Vault: ${baseVault}`);
    console.log(`   Quote Vault: ${quoteVault}`);
    console.log(`   Base Feed 1: ${baseFeed1}`);
    console.log(`   Base Feed 2: ${baseFeed2}`);
    console.log(`   Quote Feed 1: ${quoteFeed1}`);
    console.log(`   Quote Feed 2: ${quoteFeed2}`);
    console.log(`   Price Feed Max Age: ${priceFeedMaxAge.toString()}s`);
    console.log(`   Scale Factor: ${scaleFactor.toString()}`);
    
    // Try to get the current price
    console.log("\n💰 Getting current price...");
    try {
      const price = await oracle.price();
      console.log(`💎 Current WBTC/USDT price: ${price.toString()}`);
      console.log(`💎 Formatted price: ${ethers.formatUnits(price, 18)} WBTC/USDT`);
    } catch (error) {
      console.error("❌ Failed to get price:", error);
      console.log("💡 This might be because:");
      console.log("   - Price feeds are not available on Base Sepolia");
      console.log("   - Price feeds are stale (older than max age)");
      console.log("   - Network connectivity issues");
    }
    
    // Save interaction info
    const interactionInfo = {
      network: "Base Sepolia",
      factoryAddress: CONFIG.factoryAddress,
      oracleAddress,
      salt,
      timestamp: new Date().toISOString(),
      config: CONFIG
    };
    
    const interactionPath = path.join(__dirname, `interaction-${Date.now()}.json`);
    fs.writeFileSync(interactionPath, JSON.stringify(interactionInfo, null, 2));
    console.log(`💾 Interaction info saved to: ${interactionPath}`);
    
    return {
      factory,
      oracle,
      oracleAddress,
      interactionInfo
    };
    
  } catch (error) {
    console.error("❌ Interaction failed:", error);
    throw error;
  }
}

// Function to get price from a specific oracle
async function getOraclePrice(oracleAddress: string) {
  try {
    console.log(`💰 Getting price from oracle: ${oracleAddress}`);
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
    const oracle = new ethers.Contract(
      oracleAddress,
      MORPHO_PYTH_ORACLE_ABI,
      provider
    );
    
    const price = await oracle.price();
    console.log(`💎 Price: ${price.toString()}`);
    console.log(`💎 Formatted: ${ethers.formatUnits(price, 18)} WBTC/USDT`);
    
    return price;
  } catch (error) {
    console.error("❌ Failed to get price:", error);
    throw error;
  }
}

// Function to read oracle configuration
async function readOracleConfig(oracleAddress: string) {
  try {
    console.log(`🔍 Reading configuration from oracle: ${oracleAddress}`);
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
    const oracle = new ethers.Contract(
      oracleAddress,
      MORPHO_PYTH_ORACLE_ABI,
      provider
    );
    
    const [
      pythAddress,
      baseVault,
      quoteVault,
      baseFeed1,
      baseFeed2,
      quoteFeed1,
      quoteFeed2,
      priceFeedMaxAge,
      scaleFactor
    ] = await Promise.all([
      oracle.pyth(),
      oracle.BASE_VAULT(),
      oracle.QUOTE_VAULT(),
      oracle.BASE_FEED_1(),
      oracle.BASE_FEED_2(),
      oracle.QUOTE_FEED_1(),
      oracle.QUOTE_FEED_2(),
      oracle.PRICE_FEED_MAX_AGE(),
      oracle.SCALE_FACTOR()
    ]);
    
    const config = {
      pythAddress,
      baseVault,
      quoteVault,
      baseFeed1,
      baseFeed2,
      quoteFeed1,
      quoteFeed2,
      priceFeedMaxAge: priceFeedMaxAge.toString(),
      scaleFactor: scaleFactor.toString()
    };
    
    console.log("📊 Oracle Configuration:");
    console.log(JSON.stringify(config, null, 2));
    
    return config;
  } catch (error) {
    console.error("❌ Failed to read config:", error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("📖 Usage:");
    console.log("  npm run interact                    # Create oracle and interact with it");
    console.log("  npm run interact:price <address>    # Get price from specific oracle");
    console.log("  npm run interact:config <address>   # Read config from specific oracle");
    console.log("");
    console.log("📝 Examples:");
    console.log("  npm run interact:price 0x42AA1C0B929A70e8C6614C06aDBa854a69D309B7");
    console.log("  npm run interact:config 0x42AA1C0B929A70e8C6614C06aDBa854a69D309B7");
    return;
  }
  
  if (args[0] === "interact") {
    await interactWithContracts();
  } else if (args[0] === "price" && args[1]) {
    await getOraclePrice(args[1]);
  } else if (args[0] === "config" && args[1]) {
    await readOracleConfig(args[1]);
  } else {
    console.log("❌ Invalid command. Use 'interact', 'price <address>', or 'config <address>'");
  }
}

// Export functions
export { interactWithContracts, getOraclePrice, readOracleConfig, CONFIG };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
