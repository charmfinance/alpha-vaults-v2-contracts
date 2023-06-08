"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-ethers");
require("hardhat-deploy");
const fs = __importStar(require("fs"));
const dotenv = __importStar(require("dotenv"));
// Load env variables
dotenv.config();
const InfuraKey = process.env.INFURA_KEY;
const AlchemyKey = process.env.ALCHEMY_KEY;
const defaultNetwork = "localhost";
function mnemonic() {
    try {
        return fs.readFileSync("./mnemonic.txt").toString().trim();
    }
    catch (e) {
        if (defaultNetwork !== "localhost") {
            console.log("☢️ WARNING: No mnemonic file created for a deploy account. Try `yarn run generate` and then `yarn run account`.");
        }
    }
    return "";
}
const config = {
    solidity: {
        version: "0.7.6",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    defaultNetwork,
    networks: {
        goerli: {
            chainId: 5,
            // url: `https://rinkeby.infura.io/v3/${InfuraKey}`,
            url: `https://eth-goerli.g.alchemy.com/v2/${AlchemyKey}`,
            accounts: {
                mnemonic: mnemonic(),
            },
        },
    },
    namedAccounts: {
        deployer: {
            default: 0, // here this will by default take the first account as deployer
        },
    },
};
exports.default = config;
