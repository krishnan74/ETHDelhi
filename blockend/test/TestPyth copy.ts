import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import contractArtifact from "../artifacts/contracts/MultiPriceFeed.sol/MultiPriceFeed.json";
import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { HermesClient } from "@pythnetwork/hermes-client";
import { getContract } from "viem";

describe("MultiPriceFeed", function () {
  // Fixture for initializing account, client, contract, and Hermes client
  async function deployFixture() {
    const privateKey = process.env["PRIVATE_KEY"] as string;
    const account = privateKeyToAccount(`0x${privateKey}`);

    const client = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(),
    });

    const deploymentAddress = process.env["DEPLOYMENT_ADDRESS"] as string;

    const contract = getContract({
      address: `0x${deploymentAddress}`,
      abi: contractArtifact.abi, // ABI for MultiPriceFeed
      client,
    });

    const hermes = new HermesClient("https://hermes.pyth.network");

    return { account, client, contract, hermes };
  }

  describe("Update and read prices", function () {
    it("Should update multiple price feeds and read them via getLatestPrices", async function () {
      const { contract, hermes } = await loadFixture(deployFixture);

      const priceIds = [
        process.env["ETH_USD_PRICE_ID"] as string,
        process.env["BTC_USD_PRICE_ID"] as string,
        process.env["USDC_USD_PRICE_ID"] as string,
        process.env["SOL_USD_PRICE_ID"] as string,
      ];

      // Fetch price updates from Hermes for all IDs
      const priceFeedUpdateData = await hermes.getLatestPriceUpdates(priceIds);
      console.log("Retrieved Pyth price update:", priceFeedUpdateData);

      // Convert price updates to 1D array of hex strings
      const updates: string[] = priceFeedUpdateData.binary.data.map(
        (d) => `0x${d}`
      );

      // Step 1: update on-chain prices
      await contract.write.updatePrices([updates], {
        value: parseEther("0.0005"),
      });

      // Step 2: read prices after confirmation
      const prices = await contract.read.getPrices();
      console.log("Prices:", prices);

      console.log("Prices from contract:", prices);
    });
  });
});
