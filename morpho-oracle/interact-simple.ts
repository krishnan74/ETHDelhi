import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// MorphoPythOracle ABI
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

// MockPyth ABI
const MOCK_PYTH_ABI = [
  "function getPriceUnsafe(bytes32 id) external view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime))",
  "function updatePriceFeeds(bytes[] calldata updateData) external payable",
  "function createPriceFeedUpdateData(bytes32 id, int64 price, uint64 conf, int32 expo, int64 emaPrice, uint64 emaConf, uint64 publishTime, uint64 prevPublishTime) external view returns (bytes memory)"
] as const;

// Configuration for Flow testnet (where we have working oracles)
const FLOW_CONFIG = {
  rpcUrl: "https://testnet.evm.nodes.onflow.org",
  privateKey: "0xe9fab966e2f56c4830d0ce5b4a75ec6ff2850575054aadf0e6f60ee6380f8b01",
  
  // Working oracle addresses from our successful deployments
  oracles: [
    {
      name: "WBTC/USDT Oracle (Latest)",
      address: "0x42AA1C0B929A70e8C6614C06aDBa854a69D309B7",
      mockPyth: "0x9DD8C1d273bD5dD11760F2dbcE0fDcFe8dB48E52"
    },
    {
      name: "WBTC/USDT Oracle (Previous)",
      address: "0x39Ed67E99D7F44da08193f6D6861AF8B93C5a0be",
      mockPyth: "0x13Be63765DDd346c48719C9BBB9Cde1e9DAf003c"
    }
  ]
};

async function interactWithOracle(oracleAddress: string, mockPythAddress?: string) {
  try {
    console.log(`🔗 Connecting to Flow testnet...`);
    
    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(FLOW_CONFIG.rpcUrl);
    const wallet = new ethers.Wallet(FLOW_CONFIG.privateKey, provider);
    
    console.log(`👤 Connected as: ${wallet.address}`);
    console.log(`📍 Oracle address: ${oracleAddress}`);
    
    // Connect to the oracle
    const oracle = new ethers.Contract(
      oracleAddress,
      MORPHO_PYTH_ORACLE_ABI,
      provider
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
    
    // Get the current price
    console.log("\n💰 Getting current price...");
    try {
      const price = await oracle.price();
      console.log(`💎 Current WBTC/USDT price: ${price.toString()}`);
      console.log(`💎 Formatted price: ${ethers.formatUnits(price, 18)} WBTC/USDT`);
      
      // Convert to more readable format
      const priceInUsd = Number(ethers.formatUnits(price, 18));
      console.log(`💎 Price: ${priceInUsd.toLocaleString()} WBTC/USDT`);
      
    } catch (error) {
      console.error("❌ Failed to get price:", error);
    }
    
    // If we have a MockPyth address, let's interact with it
    if (mockPythAddress) {
      console.log(`\n🎭 Interacting with MockPyth: ${mockPythAddress}`);
      
      const mockPyth = new ethers.Contract(
        mockPythAddress,
        MOCK_PYTH_ABI,
        wallet
      );
      
      try {
        // Get current price from MockPyth
        const wbtcPrice = await mockPyth.getPriceUnsafe(baseFeed1);
        const usdtPrice = await mockPyth.getPriceUnsafe(quoteFeed1);
        
        console.log("📊 MockPyth Price Data:");
        console.log(`   WBTC Price: ${wbtcPrice.price} (expo: ${wbtcPrice.expo})`);
        console.log(`   USDT Price: ${usdtPrice.price} (expo: ${usdtPrice.expo})`);
        console.log(`   WBTC Publish Time: ${new Date(Number(wbtcPrice.publishTime) * 1000).toISOString()}`);
        console.log(`   USDT Publish Time: ${new Date(Number(usdtPrice.publishTime) * 1000).toISOString()}`);
        
        // Update prices with new values
        console.log("\n🔄 Updating prices in MockPyth...");
        
        const newWbtcPrice = 35000 * 1e8; // $35,000
        const newUsdtPrice = 1 * 1e6; // $1.00
        
        const updateData1 = await mockPyth.createPriceFeedUpdateData(
          baseFeed1,
          newWbtcPrice,
          0, // confidence
          -8, // expo
          newWbtcPrice, // EMA price
          0, // EMA confidence
          Math.floor(Date.now() / 1000), // current timestamp
          Math.floor(Date.now() / 1000) // previous timestamp
        );
        
        const updateData2 = await mockPyth.createPriceFeedUpdateData(
          quoteFeed1,
          newUsdtPrice,
          0, // confidence
          -6, // expo
          newUsdtPrice, // EMA price
          0, // EMA confidence
          Math.floor(Date.now() / 1000), // current timestamp
          Math.floor(Date.now() / 1000) // previous timestamp
        );
        
        const tx = await mockPyth.updatePriceFeeds([updateData1, updateData2], { value: 2 });
        await tx.wait();
        console.log("✅ Prices updated in MockPyth");
        
        // Get new price from oracle
        console.log("\n💰 Getting updated price from oracle...");
        const newPrice = await oracle.price();
        console.log(`💎 Updated WBTC/USDT price: ${newPrice.toString()}`);
        console.log(`💎 Formatted price: ${ethers.formatUnits(newPrice, 18)} WBTC/USDT`);
        
        const newPriceInUsd = Number(ethers.formatUnits(newPrice, 18));
        console.log(`💎 Price: ${newPriceInUsd.toLocaleString()} WBTC/USDT`);
        
      } catch (error) {
        console.error("❌ Failed to interact with MockPyth:", error);
      }
    }
    
    return {
      oracle,
      pythAddress,
      baseFeed1,
      quoteFeed1,
      priceFeedMaxAge,
      scaleFactor
    };
    
  } catch (error) {
    console.error("❌ Interaction failed:", error);
    throw error;
  }
}

// Function to list all available oracles
async function listOracles() {
  console.log("📋 Available Oracles on Flow Testnet:");
  console.log("");
  
  FLOW_CONFIG.oracles.forEach((oracle, index) => {
    console.log(`${index + 1}. ${oracle.name}`);
    console.log(`   Oracle: ${oracle.address}`);
    console.log(`   MockPyth: ${oracle.mockPyth}`);
    console.log("");
  });
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log("📖 Usage:");
    console.log("  npm run interact:simple list                    # List available oracles");
    console.log("  npm run interact:simple <oracle_address>        # Interact with specific oracle");
    console.log("  npm run interact:simple <oracle_address> <mock_pyth_address>  # Interact with oracle and MockPyth");
    console.log("");
    console.log("📝 Examples:");
    console.log("  npm run interact:simple list");
    console.log("  npm run interact:simple 0x42AA1C0B929A70e8C6614C06aDBa854a69D309B7");
    console.log("  npm run interact:simple 0x42AA1C0B929A70e8C6614C06aDBa854a69D309B7 0x9DD8C1d273bD5dD11760F2dbcE0fDcFe8dB48E52");
    return;
  }
  
  if (args[0] === "list") {
    await listOracles();
  } else if (args[0] && ethers.isAddress(args[0])) {
    const mockPythAddress = args[1] && ethers.isAddress(args[1]) ? args[1] : undefined;
    await interactWithOracle(args[0], mockPythAddress);
  } else {
    console.log("❌ Invalid oracle address. Use 'list' or provide a valid address.");
  }
}

// Export functions
export { interactWithOracle, listOracles, FLOW_CONFIG };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
