import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async function(hre) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const alphaProPeriphery = await deploy("AlphaProPeriphery", {
    from: deployer,
    waitConfirmations: 1
  });

  console.log("Successfully deployed:");
  console.log("alphaProPeriphery: ", alphaProPeriphery.address);
};

export default deploy;
