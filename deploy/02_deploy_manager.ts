import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async function(hre) {
  const { deployments, getNamedAccounts, ethers, getChainId } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const chainId = await getChainId();

  // Do not deploy mock tokens to test networks
  if (137 !== +chainId) {
    console.log(`Skipping ManagerStore contract deploy since ${chainId} is not polygon`);
    return;
  }

  const managerStore = await deploy("ManagerStore", {
    from: deployer,
    waitConfirmations: 1
  });

  console.log("Successfully deployed:");
  console.log("managerStore: ", managerStore.address);
};

export default deploy;
