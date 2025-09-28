import artifacts from "../out/MorphoPythOracleFactory.sol/MorphoPythOracleFactory.json";
import { ethers } from "ethers";

async function deployMorphoPythOracleFactory() {
    // Base Sepolia configuration
    const RPC_URL = "https://sepolia.base.org";
    const PRIVATE_KEY = "e9fab966e2f56c4830d0ce5b4a75ec6ff2850575054aadf0e6f60ee6380f8b01";
    
    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Deploying MorphoPythOracleFactory to Base Sepolia...");
    console.log("Deployer address:", wallet.address);
    
    // Get the contract factory
    const factory = new ethers.ContractFactory(
        artifacts.abi,
        artifacts.bytecode.object,
        wallet
    );
    
    try {
        // Deploy the contract
        console.log("Deploying contract...");
        const contract = await factory.deploy();
        
        console.log("Transaction hash:", contract.deploymentTransaction()?.hash);
        console.log("Waiting for deployment confirmation...");
        
        await contract.waitForDeployment();
        
        const contractAddress = await contract.getAddress();
        console.log("✅ MorphoPythOracleFactory deployed successfully!");
        console.log("Contract address:", contractAddress);
        console.log("Base Sepolia Explorer:", `https://sepolia.basescan.org/address/${contractAddress}`);
        
        return {
            contractAddress,
            contract,
            deploymentTx: contract.deploymentTransaction()?.hash
        };
        
    } catch (error) {
        console.error("❌ Deployment failed:", error);
        throw error;
    }
}

// Run deployment if this file is executed directly
if (require.main === module) {
    deployMorphoPythOracleFactory()
        .then((result) => {
            console.log("\n🎉 Deployment completed successfully!");
            console.log("Contract Address:", result.contractAddress);
            console.log("Transaction Hash:", result.deploymentTx);
            process.exit(0);
        })
        .catch((error) => {
            console.error("💥 Deployment failed:", error);
            process.exit(1);
        });
}

export { deployMorphoPythOracleFactory };