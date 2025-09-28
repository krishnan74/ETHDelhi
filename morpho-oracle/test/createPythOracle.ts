import { ethers } from "ethers";

// Contract configuration
const FACTORY_ADDRESS = "0x8997AcB640ad1BF0B66280B70Fa0A3E753C461B2"; // Replace with actual deployed address
const RPC_URL = "https://sepolia.base.org";
const PRIVATE_KEY = "e9fab966e2f56c4830d0ce5b4a75ec6ff2850575054aadf0e6f60ee6380f8b01";

// Base Sepolia Pyth contract address (you'll need to verify this)
const PYTH_ADDRESS = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729"; // Base Sepolia Pyth

// Example feed IDs for Base Sepolia (you'll need to verify these)
const ETH_USD_FEED = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const USDC_USD_FEED = "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";

async function createPythOracle() {
    // Check if factory address is set
    
    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Creating Pyth Oracle via Factory...");
    console.log("Factory address:", FACTORY_ADDRESS);
    console.log("Deployer address:", wallet.address);
    
    // Get factory contract
    const factoryAbi = [
        "function createMorphoPythOracle(address pyth, address baseVault, uint256 baseVaultConversionSample, bytes32 baseFeed1, bytes32 baseFeed2, uint256 baseTokenDecimals, address quoteVault, uint256 quoteVaultConversionSample, bytes32 quoteFeed1, bytes32 quoteFeed2, uint256 quoteTokenDecimals, uint256 priceFeedMaxAge, bytes32 salt) external returns (address oracle)",
        "function isMorphoPythOracle(address target) external view returns (bool)",
        "event CreateMorphoPythOracle(address caller, address oracle)"
    ];
    
    const factory = new ethers.Contract(FACTORY_ADDRESS, factoryAbi, wallet);
    
    try {
        // Example: Create ETH/USDC oracle
        // Parameters for ETH (base) / USDC (quote) oracle
        const params = {
            pyth: PYTH_ADDRESS,
            baseVault: ethers.ZeroAddress, // No vault for ETH
            baseVaultConversionSample: 1,
            baseFeed1: ETH_USD_FEED,
            baseFeed2: ethers.ZeroHash, // No second feed needed
            baseTokenDecimals: 18, // ETH decimals
            quoteVault: ethers.ZeroAddress, // No vault for USDC
            quoteVaultConversionSample: 1,
            quoteFeed1: USDC_USD_FEED,
            quoteFeed2: ethers.ZeroHash, // No second feed needed
            quoteTokenDecimals: 6, // USDC decimals
            priceFeedMaxAge: 60, // 60 seconds max age
            salt: ethers.randomBytes(32) // Random salt for CREATE2
        };
        
        console.log("Creating oracle with parameters:");
        console.log("- Pyth address:", params.pyth);
        console.log("- Base feed (ETH/USD):", params.baseFeed1);
        console.log("- Quote feed (USDC/USD):", params.quoteFeed1);
        console.log("- Price feed max age:", params.priceFeedMaxAge, "seconds");
        console.log("- Salt:", ethers.hexlify(params.salt));
        
        // Estimate gas
        const gasEstimate = await factory.createMorphoPythOracle.estimateGas(
            params.pyth,
            params.baseVault,
            params.baseVaultConversionSample,
            params.baseFeed1,
            params.baseFeed2,
            params.baseTokenDecimals,
            params.quoteVault,
            params.quoteVaultConversionSample,
            params.quoteFeed1,
            params.quoteFeed2,
            params.quoteTokenDecimals,
            params.priceFeedMaxAge,
            params.salt
        );
        
        console.log("Estimated gas:", gasEstimate.toString());
        
        // Create the oracle
        console.log("Creating oracle...");
        const tx = await factory.createMorphoPythOracle(
            params.pyth,
            params.baseVault,
            params.baseVaultConversionSample,
            params.baseFeed1,
            params.baseFeed2,
            params.baseTokenDecimals,
            params.quoteVault,
            params.quoteVaultConversionSample,
            params.quoteFeed1,
            params.quoteFeed2,
            params.quoteTokenDecimals,
            params.priceFeedMaxAge,
            params.salt,
            { gasLimit: gasEstimate * 120n / 100n } // 20% buffer
        );
        
        console.log("Transaction hash:", tx.hash);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log("✅ Oracle created successfully!");
        console.log("Gas used:", receipt?.gasUsed.toString());
        
        // Find the oracle address from the event
        const event = receipt?.logs.find((log: any) => {
            try {
                const parsed = factory.interface.parseLog(log);
                return parsed?.name === "CreateMorphoPythOracle";
            } catch {
                return false;
            }
        });
        
        if (event) {
            const parsed = factory.interface.parseLog(event);
            const oracleAddress = parsed?.args.oracle;
            console.log("Oracle address:", oracleAddress);
            console.log("Base Sepolia Explorer:", `https://sepolia.basescan.org/address/${oracleAddress}`);
            
            // Verify the oracle was registered
            const isRegistered = await factory.isMorphoPythOracle(oracleAddress);
            console.log("Oracle registered in factory:", isRegistered);
            
            return {
                oracleAddress,
                transactionHash: tx.hash,
                gasUsed: receipt?.gasUsed.toString()
            };
        } else {
            console.log("⚠️ Could not find CreateMorphoPythOracle event");
            return {
                transactionHash: tx.hash,
                gasUsed: receipt?.gasUsed.toString()
            };
        }
        
    } catch (error) {
        console.error("❌ Failed to create oracle:", error);
        throw error;
    }
}

// Helper function to check if an address is a registered oracle
async function checkOracle(address: string) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const factoryAbi = ["function isMorphoPythOracle(address target) external view returns (bool)"];
    const factory = new ethers.Contract(FACTORY_ADDRESS, factoryAbi, provider);
    
    const isOracle = await factory.isMorphoPythOracle(address);
    console.log(`Address ${address} is registered oracle:`, isOracle);
    return isOracle;
}

// Run if executed directly
if (require.main === module) {
    createPythOracle()
        .then((result) => {
            console.log("\n🎉 Oracle creation completed!");
            if (result.oracleAddress) {
                console.log("Oracle Address:", result.oracleAddress);
            }
            console.log("Transaction Hash:", result.transactionHash);
            console.log("Gas Used:", result.gasUsed);
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 Oracle creation failed:", error);
            process.exit(1);
        });
}

export { createPythOracle, checkOracle };
