import { HardhatUserConfig } from "hardhat/config";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { utils } from "ethers";

import "hardhat-gas-reporter"
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
// Load env variables
dotenv.config();
const AlchemyKey = process.env.ALCHEMY_KEY;
const defaultNetwork = "hardhat";

function mnemonic() {
  try {
    return fs
      .readFileSync("./mnemonic.txt")
      .toString()
      .trim();
  } catch (e) {
    console.log(
      "☢️ WARNING: No mnemonic file created for a deploy account. Try `yarn run generate` and then `yarn run account`."
    );
  }
  return "";
}

const accounts = {
  mnemonic: mnemonic()
};
const config: HardhatUserConfig = {
  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  defaultNetwork,
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.g.alchemy.com/v2/${AlchemyKey}`,
        // ETH about 2113.80
        blockNumber: 17073835
      },
      accounts: {
        accountsBalance: utils.parseEther("10000").toString()
      }
    },
    mainnet: {
      chainId: 1,
      url: `https://eth-mainnet.g.alchemy.com/v2/${AlchemyKey}`,
      accounts
    },
    goerli: {
      chainId: 5,
      url: `https://eth-goerli.g.alchemy.com/v2/${AlchemyKey}`,
      accounts
    },
    arbitrum: {
      chainId: 42161,
      url: `https://arb-mainnet.g.alchemy.com/v2/${AlchemyKey}`,
      accounts
    },
    optimism: {
      chainId: 10,
      url: `https://opt-mainnet.g.alchemy.com/v2/${AlchemyKey}`,
      accounts
    },
    polygon: {
      chainId: 137,
      url: `https://polygon-mainnet.g.alchemy.com/v2/${AlchemyKey}`,
      accounts
    }
  },
  namedAccounts: {
    deployer: {
      default: 0 // here this will by default take the first account as deployer
    }
  },
  gasReporter: {
    enabled: true
  }
};

export default config;
