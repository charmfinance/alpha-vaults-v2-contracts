import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { encodePriceSqrt, getMaxTick, getMinTick } from "../utils";
import {
  BASE_THRESHOLD,
  FACTORY_ADDRESS,
  LIMIT_THRESHOLD,
  MAX_TOTAL_SUPPLY,
  MAX_TWAP_DEVIATION,
  MIN_TICK_MOVE,
  PERIOD,
  TWAP_DURATION,
  ZERO_ADDR
} from "../utils/constants";
import {
  AlphaProVaultFactory,
  IUniswapV3Factory,
  IUniswapV3Pool,
  TestRouter,
  ERC20Mock
} from "../typechain-types";

const debugMock = (e: Error) => {
  console.log(e);
  debugger;
};

const MAIN_NETWORKS = [1, 10, 137, 42161];

const deployMock = async (
  hre: HardhatRuntimeEnvironment,
  token: string,
  decimals: number
) => {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const contractName = `${token}Mock`;

  const deployed = await deploy(contractName, {
    args: [token, token, decimals, deployer, (100 * 1e18).toString()],
    from: deployer,
    contract: "ERC20Mock",
    waitConfirmations: 1
  });

  console.log(`Deployed ${contractName}: `, deployed.address);

  const mock: ERC20Mock = await ethers.getContract(contractName);

  return mock;
};

const deploy: DeployFunction = async function(hre) {
  const { deployments, getNamedAccounts, ethers, network, getChainId } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const chainId = await getChainId();

  // Do not deploy mock tokens to test networks
  if (MAIN_NETWORKS.includes(+chainId)) {
    console.log(`Skipping mock contracts deploy since ${chainId} is a mainnet`);
    return;
  }

  const usdcMock = await deployMock(hre, "USDC", 6);
  const wethMock = await deployMock(hre, "WETH", 18);

  const uniswapFactory: IUniswapV3Factory = await ethers.getContractAt(
    "IUniswapV3Factory",
    FACTORY_ADDRESS,
    deployer
  );

  let poolAddress = await uniswapFactory.getPool(
    wethMock.address,
    usdcMock.address,
    3000
  );

  if (poolAddress === ZERO_ADDR) {
    await uniswapFactory
      .createPool(wethMock.address, usdcMock.address, 3000, { from: deployer })
      .then(tx => tx.wait(1));

    poolAddress = await uniswapFactory.getPool(
      wethMock.address,
      usdcMock.address,
      3000
    );

    const pool: IUniswapV3Pool = await ethers.getContractAt(
      "IUniswapV3Pool",
      poolAddress,
      deployer
    );
    const inverse = (await pool.token0()) === usdcMock.address;
    const priceRatio: [number, number] = [2000e6, 1e18];
    if (inverse) priceRatio.reverse();
    const priceX96 = encodePriceSqrt(...priceRatio);

    await pool
      .initialize(priceX96, {
        from: deployer
      })
      .then(tx => tx.wait())
      .catch(debugMock);

    await pool
      .increaseObservationCardinalityNext(100, { from: deployer })
      .then(tx => tx.wait());
    console.log("observability increased");
  }

  await deploy("TestRouter", { from: deployer }).catch(debugMock);

  const router: TestRouter = await ethers.getContract("TestRouter", deployer);

  await wethMock
    .approve(router.address, ethers.constants.MaxUint256, {
      from: deployer
    })
    .catch(debugMock);

  await usdcMock
    .approve(router.address, ethers.constants.MaxUint256, {
      from: deployer
    })
    .then(tx => tx.wait(1));

  await router
    .mint(poolAddress, getMinTick(60), getMaxTick(60), 1e14, {
      from: deployer
    })
    .then(tx => tx.wait());

  const alphaProVaultFactory: AlphaProVaultFactory = await ethers.getContract(
    "AlphaProVaultFactory"
  );

  await alphaProVaultFactory.createVault({
    pool: poolAddress,
    manager: deployer,
    managerFee: 0,
    rebalanceDelegate: ZERO_ADDR,
    maxTotalSupply: MAX_TOTAL_SUPPLY,
    baseThreshold: BASE_THRESHOLD,
    limitThreshold: LIMIT_THRESHOLD,
    fullRangeWeight: 0,
    period: PERIOD,
    minTickMove: MIN_TICK_MOVE,
    maxTwapDeviation: MAX_TWAP_DEVIATION,
    twapDuration: TWAP_DURATION,
    name: "AV_TEST",
    symbol: "AV_TEST"
  });

  console.log("Successfully deployed:");
  console.log("usdcMock: ", usdcMock.address);
  console.log("wethMock: ", wethMock.address);
  console.log("pool: ", poolAddress);
};

export default deploy;

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });
