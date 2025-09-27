import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Pyth contract addresses for different networks
const PYTH_CONTRACT_ADDRESSES = "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729";

// ETH/USD price feed ID
const ETH_USD_PRICE_ID =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

const MyFirstPythContractModule = buildModule(
  "MyFirstPythContractModule",
  (m) => {
    // Get network chain ID to determine Pyth contract address
    const chainId = m.getParameter("chainId", "31"); // Default to Rootstock testnet
    const pythAddress = m.getParameter(
      "pythAddress",
      PYTH_CONTRACT_ADDRESSES
    );
    const ethUsdPriceId = m.getParameter("ethUsdPriceId", ETH_USD_PRICE_ID);

    const myFirstPythContract = m.contract("MyFirstPythContract", [
      pythAddress,
      ethUsdPriceId,
    ]);

    return { myFirstPythContract };
  }
);

export default MyFirstPythContractModule;
