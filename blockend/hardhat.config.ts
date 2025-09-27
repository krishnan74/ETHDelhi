import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require("dotenv").config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",

  networks: {
    rskMainnet: {
      url: `https://rpc.mainnet.rootstock.io/${process.env.ROOTSTOCK_API_KEY}`,
      chainId: 30,
      gasPrice: 60000000,
      accounts: [process.env.PRIVATE_KEY!],
    },
    rskTestnet: {
      url: `https://rpc.testnet.rootstock.io/${process.env.ROOTSTOCK_API_KEY}`,
      chainId: 31,
      gasPrice: 60000000,
      accounts: [process.env.PRIVATE_KEY!],
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: [process.env.PRIVATE_KEY!],
    },
  },
};

export default config;
