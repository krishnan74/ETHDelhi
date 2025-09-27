import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Pyth contract address for your target network
const PYTH_CONTRACT_ADDRESS = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729";

// Multiple price feed IDs from Pyth
const PRICE_FEED_IDS = [
  // ETH/USD
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  // BTC/USD
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  // USDC/USD
  "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  // SOL/USD
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
];

const MultiPriceFeedModule = buildModule("MultiPriceFeedModule", (m) => {
  // Parameters with defaults, can be overridden when deploying
  const pythAddress = m.getParameter("pythAddress", PYTH_CONTRACT_ADDRESS);
  const priceIds = m.getParameter("priceIds", PRICE_FEED_IDS);

  // Deploy MultiPriceFeed with constructor args: (pythAddress, priceIds)
  const multiPriceFeed = m.contract("MultiPriceFeed", [pythAddress, priceIds]);

  return { multiPriceFeed };
});

export default MultiPriceFeedModule;
