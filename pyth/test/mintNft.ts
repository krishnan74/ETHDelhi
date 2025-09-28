import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { HermesClient } from "@pythnetwork/hermes-client";
import { getContract } from "viem";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();
 
export const abi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_pyth",
        type: "address",
        internalType: "address",
      },
      {
        name: "_ethUsdPriceId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "mint",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "updateAndMint",
    inputs: [
      {
        name: "pythPriceUpdate",
        type: "bytes[]",
        internalType: "bytes[]",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "error",
    name: "InsufficientFee",
    inputs: [],
  },
] as const;
 
async function run() {
  // Check if required environment variables are set
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY environment variable is required");
  }
  if (!process.env.DEPLOYMENT_ADDRESS) {
    throw new Error("DEPLOYMENT_ADDRESS environment variable is required");
  }
  if (!process.env.ETH_USD_ID) {
    throw new Error("ETH_USD_ID environment variable is required");
  }

  console.log("Environment variables loaded successfully");
  console.log("Contract address:", process.env.DEPLOYMENT_ADDRESS);
  console.log("ETH/USD Price ID:", process.env.ETH_USD_ID);
  console.log("Private key (first 10 chars):", process.env.PRIVATE_KEY?.substring(0, 10) + "...");

  const account = privateKeyToAccount(process.env.PRIVATE_KEY as any);
  const client = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });
 
  const contract = getContract({
    address: process.env["DEPLOYMENT_ADDRESS"] as any,
    abi: abi,
    client,
  });
 
  const connection = new HermesClient("https://hermes.pyth.network");
  const priceIds = [process.env["ETH_USD_ID"] as string];
  const priceFeedUpdateData = await connection.getLatestPriceUpdates(priceIds);
  console.log("Retrieved Pyth price update:");
  console.log(priceFeedUpdateData);
 
  const hash = await contract.write.updateAndMint(
    [[`0x${priceFeedUpdateData.binary.data[0]}`]] as any,
    { value: parseEther("0.0005") }
  );
  console.log("Transaction hash:");
  console.log(hash);
}
 
run();