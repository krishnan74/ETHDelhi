import { ethers } from "ethers";

// Configuration
const RPC_URL = "https://sepolia.base.org";
const PRIVATE_KEY = "e9fab966e2f56c4830d0ce5b4a75ec6ff2850575054aadf0e6f60ee6380f8b01";

// Contract addresses (UPDATE THESE WITH ACTUAL DEPLOYED ADDRESSES)
const MORPHO_BLUE_ADDRESS = "0x0000000000000000000000000000000000000000"; // Morpho Blue on Base Sepolia
const PYTH_ORACLE_ADDRESS = "0x0000000000000000000000000000000000000000"; // Your deployed Pyth oracle
const LOAN_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000"; // e.g., USDC on Base Sepolia
const COLLATERAL_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000"; // e.g., WETH on Base Sepolia
const IRM_ADDRESS = "0x0000000000000000000000000000000000000000"; // Interest Rate Model

// Market parameters
const LLTV = ethers.parseEther("0.8"); // 80% Loan-to-Value ratio

// Test oracle price function
async function testOraclePrice(oracleAddress: string) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    const oracleAbi = [
        "function price() external view returns (uint256)"
    ];
    
    try {
        const oracle = new ethers.Contract(oracleAddress, oracleAbi, provider);
        const price = await oracle.price();
        
        console.log("✅ Oracle price test successful");
        console.log("Raw price:", price.toString());
        console.log("Formatted price:", ethers.formatUnits(price, 36));
        
        return price;
    } catch (error) {
        console.error("❌ Oracle price test failed:", (error as Error).message);
        throw error;
    }
}

// Create Morpho Blue market with your oracle
async function createMorphoMarket() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Creating Morpho Blue market with Pyth oracle...");
    console.log("Morpho Blue address:", MORPHO_BLUE_ADDRESS);
    console.log("Oracle address:", PYTH_ORACLE_ADDRESS);
    console.log("Loan token:", LOAN_TOKEN_ADDRESS);
    console.log("Collateral token:", COLLATERAL_TOKEN_ADDRESS);
    console.log("LLTV:", ethers.formatEther(LLTV));
    
    // Validate addresses
    const addresses = [
        { name: "MORPHO_BLUE_ADDRESS", value: MORPHO_BLUE_ADDRESS },
        { name: "PYTH_ORACLE_ADDRESS", value: PYTH_ORACLE_ADDRESS },
        { name: "LOAN_TOKEN_ADDRESS", value: LOAN_TOKEN_ADDRESS },
        { name: "COLLATERAL_TOKEN_ADDRESS", value: COLLATERAL_TOKEN_ADDRESS },
        { name: "IRM_ADDRESS", value: IRM_ADDRESS }
    ];
    
    for (const addr of addresses) {
        if (addr.value === "0x0000000000000000000000000000000000000000") {
            throw new Error(`❌ Please set the ${addr.name}`);
        }
    }
    
    // Morpho Blue ABI
    const morphoAbi = [
        "function createMarket((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams) external",
        "function isCreated(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) external view returns (bool)",
        "event CreateMarket(bytes32 indexed id, (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams)"
    ];
    
    try {
        const morpho = new ethers.Contract(MORPHO_BLUE_ADDRESS, morphoAbi, wallet);
        
        // 1. Test oracle price function first
        console.log("\n1. Testing oracle price function...");
        await testOraclePrice(PYTH_ORACLE_ADDRESS);
        
        // 2. Check if market already exists
        console.log("\n2. Checking if market already exists...");
        const marketExists = await morpho.isCreated(
            LOAN_TOKEN_ADDRESS,
            COLLATERAL_TOKEN_ADDRESS,
            PYTH_ORACLE_ADDRESS,
            IRM_ADDRESS,
            LLTV
        );
        
        if (marketExists) {
            console.log("✅ Market already exists!");
            return { marketExists: true };
        }
        
        // 3. Create the market
        console.log("\n3. Creating market...");
        const marketParams = {
            loanToken: LOAN_TOKEN_ADDRESS,
            collateralToken: COLLATERAL_TOKEN_ADDRESS,
            oracle: PYTH_ORACLE_ADDRESS,
            irm: IRM_ADDRESS,
            lltv: LLTV
        };
        
        // Estimate gas
        const gasEstimate = await morpho.createMarket.estimateGas(marketParams);
        console.log("Estimated gas:", gasEstimate.toString());
        
        // Create market transaction
        const tx = await morpho.createMarket(marketParams, {
            gasLimit: gasEstimate * 120n / 100n // 20% buffer
        });
        
        console.log("Transaction hash:", tx.hash);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        console.log("✅ Market created successfully!");
        console.log("Gas used:", receipt?.gasUsed.toString());
        
        return {
            marketParams,
            transactionHash: tx.hash,
            gasUsed: receipt?.gasUsed.toString()
        };
        
    } catch (error) {
        console.error("❌ Failed to create market:", (error as Error).message);
        throw error;
    }
}

// Supply assets to the market
async function supplyToMarket(amount: string) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log(`Supplying ${amount} tokens to market...`);
    
    const morphoAbi = [
        "function supply((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes calldata data) external returns (uint256, uint256)"
    ];
    
    const tokenAbi = [
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)"
    ];
    
    try {
        const morpho = new ethers.Contract(MORPHO_BLUE_ADDRESS, morphoAbi, wallet);
        const token = new ethers.Contract(LOAN_TOKEN_ADDRESS, tokenAbi, wallet);
        
        const supplyAmount = ethers.parseUnits(amount, 6); // Assuming USDC (6 decimals)
        
        // Check balance
        const balance = await token.balanceOf(wallet.address);
        console.log("Token balance:", ethers.formatUnits(balance, 6));
        
        if (balance < supplyAmount) {
            throw new Error("Insufficient token balance");
        }
        
        // Approve tokens
        console.log("Approving tokens...");
        const approveTx = await token.approve(MORPHO_BLUE_ADDRESS, supplyAmount);
        await approveTx.wait();
        console.log("✅ Tokens approved");
        
        // Supply to market
        const marketParams = {
            loanToken: LOAN_TOKEN_ADDRESS,
            collateralToken: COLLATERAL_TOKEN_ADDRESS,
            oracle: PYTH_ORACLE_ADDRESS,
            irm: IRM_ADDRESS,
            lltv: LLTV
        };
        
        const tx = await morpho.supply(
            marketParams,
            supplyAmount, // assets
            0, // shares (0 means use assets)
            wallet.address, // onBehalf
            "0x" // data
        );
        
        console.log("Supply transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("✅ Supply successful!");
        
        return {
            transactionHash: tx.hash,
            gasUsed: receipt?.gasUsed.toString()
        };
        
    } catch (error) {
        console.error("❌ Supply failed:", (error as Error).message);
        throw error;
    }
}

// Get market information
async function getMarketInfo() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    const morphoAbi = [
        "function market(bytes32 id) external view returns ((uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee) memory)",
        "function idToMarketParams(bytes32 id) external view returns ((address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) memory)"
    ];
    
    try {
        const morpho = new ethers.Contract(MORPHO_BLUE_ADDRESS, morphoAbi, provider);
        
        // Calculate market ID (this is how Morpho identifies markets)
        const marketParams = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "address", "address", "uint256"],
            [LOAN_TOKEN_ADDRESS, COLLATERAL_TOKEN_ADDRESS, PYTH_ORACLE_ADDRESS, IRM_ADDRESS, LLTV]
        );
        const marketId = ethers.keccak256(marketParams);
        
        console.log("Market ID:", marketId);
        
        const market = await morpho.market(marketId);
        
        console.log("Market info:");
        console.log("- Total supply assets:", market.totalSupplyAssets.toString());
        console.log("- Total supply shares:", market.totalSupplyShares.toString());
        console.log("- Total borrow assets:", market.totalBorrowAssets.toString());
        console.log("- Total borrow shares:", market.totalBorrowShares.toString());
        console.log("- Last update:", new Date(Number(market.lastUpdate) * 1000).toISOString());
        console.log("- Fee:", market.fee.toString());
        
        return market;
        
    } catch (error) {
        console.error("❌ Failed to get market info:", (error as Error).message);
        throw error;
    }
}

// Main execution function
async function main() {
    const command = process.argv[2];
    
    switch (command) {
        case "test-oracle":
            if (!process.argv[3]) {
                console.log("Usage: npx ts-node morphoIntegration.ts test-oracle <oracle-address>");
                process.exit(1);
            }
            await testOraclePrice(process.argv[3]);
            break;
            
        case "create-market":
            await createMorphoMarket();
            break;
            
        case "supply":
            if (!process.argv[3]) {
                console.log("Usage: npx ts-node morphoIntegration.ts supply <amount>");
                process.exit(1);
            }
            await supplyToMarket(process.argv[3]);
            break;
            
        case "info":
            await getMarketInfo();
            break;
            
        default:
            console.log("Morpho Blue + Pyth Oracle Integration");
            console.log("\nUsage:");
            console.log("  npx ts-node morphoIntegration.ts test-oracle <address>  - Test oracle price function");
            console.log("  npx ts-node morphoIntegration.ts create-market          - Create a new market");
            console.log("  npx ts-node morphoIntegration.ts supply <amount>        - Supply tokens to market");
            console.log("  npx ts-node morphoIntegration.ts info                   - Get market information");
            console.log("\nBefore using:");
            console.log("1. Update all contract addresses in the configuration section");
            console.log("2. Ensure you have the required tokens in your wallet");
            console.log("3. Test your oracle first with: test-oracle <your-oracle-address>");
            process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main()
        .then(() => {
            console.log("\n🎉 Operation completed!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 Operation failed:", error);
            process.exit(1);
        });
}

export { testOraclePrice, createMorphoMarket, supplyToMarket, getMarketInfo };
