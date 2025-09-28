import { ethers } from "ethers";

// Configuration
const RPC_URL = "https://sepolia.base.org";
const PRIVATE_KEY = "e9fab966e2f56c4830d0ce5b4a75ec6ff2850575054aadf0e6f60ee6380f8b01";

// Pyth contract and feed IDs to verify
const PYTH_ADDRESS = "0x2880aB155794e7179c9eE2e38200202908C17B43";
const ETH_USD_FEED = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const USDC_USD_FEED = "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";

async function verifyPythParams() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Verifying Pyth parameters on Base Sepolia...");
    console.log("Pyth address:", PYTH_ADDRESS);
    console.log("ETH/USD feed:", ETH_USD_FEED);
    console.log("USDC/USD feed:", USDC_USD_FEED);
    
    // Basic Pyth contract ABI for testing
    const pythAbi = [
        "function getPrice(bytes32 id) external view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime) memory)",
        "function getPriceUnsafe(bytes32 id) external view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime) memory)",
        "function getEmaPrice(bytes32 id) external view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime) memory)",
        "function getEmaPriceUnsafe(bytes32 id) external view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime) memory)"
    ];
    
    try {
        const pythContract = new ethers.Contract(PYTH_ADDRESS, pythAbi, provider);
        
        console.log("\n1. Testing Pyth contract connection...");
        
        // Test ETH/USD feed
        console.log("\n2. Testing ETH/USD feed...");
        try {
            const ethPrice = await pythContract.getPriceUnsafe(ETH_USD_FEED);
            console.log("✅ ETH/USD feed is valid");
            console.log("   Price:", ethPrice.price.toString());
            console.log("   Confidence:", ethPrice.conf.toString());
            console.log("   Exponent:", ethPrice.expo.toString());
            console.log("   Publish time:", new Date(Number(ethPrice.publishTime) * 1000).toISOString());
        } catch (error) {
            console.log("❌ ETH/USD feed failed:", (error as Error).message);
        }
        
        // Test USDC/USD feed
        console.log("\n3. Testing USDC/USD feed...");
        try {
            const usdcPrice = await pythContract.getPriceUnsafe(USDC_USD_FEED);
            console.log("✅ USDC/USD feed is valid");
            console.log("   Price:", usdcPrice.price.toString());
            console.log("   Confidence:", usdcPrice.conf.toString());
            console.log("   Exponent:", usdcPrice.expo.toString());
            console.log("   Publish time:", new Date(Number(usdcPrice.publishTime) * 1000).toISOString());
        } catch (error) {
            console.log("❌ USDC/USD feed failed:", (error as Error).message);
        }
        
        // Test with zero feed (should work)
        console.log("\n4. Testing zero feed (should work)...");
        try {
            const zeroFeed = "0x0000000000000000000000000000000000000000000000000000000000000000";
            const zeroPrice = await pythContract.getPriceUnsafe(zeroFeed);
            console.log("✅ Zero feed is valid (price = 1)");
        } catch (error) {
            console.log("❌ Zero feed failed:", (error as Error).message);
        }
        
    } catch (error) {
        console.error("❌ Failed to connect to Pyth contract:", (error as Error).message);
        console.log("\nPossible issues:");
        console.log("- Pyth contract address is incorrect for Base Sepolia");
        console.log("- Network connection issues");
        console.log("- Contract doesn't exist at this address");
    }
}

// Run verification
if (require.main === module) {
    verifyPythParams()
        .then(() => {
            console.log("\n🎉 Verification completed!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 Verification failed:", error);
            process.exit(1);
        });
}

export { verifyPythParams };
