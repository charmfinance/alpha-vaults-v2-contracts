import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { PROTOCOL_FEE } from "../utils/constants";
import { AlphaProVaultFactory } from "../typechain-types";

const deploy: DeployFunction = async function (hre) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const alphaProVault = await deploy("AlphaProVault", {
    from: deployer,
    waitConfirmations: 1,
  });

  await deploy("AlphaProVaultFactory", {
    from: deployer,
    waitConfirmations: 1,
    args: [alphaProVault.address, deployer, PROTOCOL_FEE],
  });
  const alphaProVaultFactory: AlphaProVaultFactory = await ethers.getContract(
    "AlphaProVaultFactory"
  );

  console.log("Successfully deployed:");
  console.log("alphaProVault: ", alphaProVault.address);
  console.log("alphaProVaultFactory: ", alphaProVaultFactory.address);
};

export default deploy;
