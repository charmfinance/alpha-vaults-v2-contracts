import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
  FACTORY_ADDRESS,
  MAX_TWAP_DEVIATION,
  MIN_TICK_MOVE,
  PROTOCOL_FEE,
  TWAP_DURATION,
  ZERO_ADDR
} from "../utils/constants";
import { IUniswapV3Factory } from "../typechain-types";
import { AlphaProVaultFactory } from "../typechain-types/contracts/AlphaProVaultFactory";
import { AlphaProVault } from "../typechain-types/contracts/AlphaProVault";

const ERC20_FUNCS = [
  "function balanceOf(address account) public view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  "function deposit() external payable"
];
export const SWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
export const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
export const POOL_FEE = 3000;

export const swapToken = async ({
  tokenIn,
  tokenOut,
  recipient,
  amountIn,
  fee = POOL_FEE
}: {
  tokenIn: string;
  tokenOut: string;
  amountIn?: string | BigNumber;
  recipient?: string;
  fee?: number;
}) => {
  const [deployer] = await ethers.getSigners();
  const swapRouter = await ethers.getContractAt(
    "ISwapRouter",
    SWAP_ROUTER_ADDRESS,
    deployer
  );

  if (!recipient) recipient = deployer.address;
  if (!amountIn) amountIn = ethers.utils.parseEther("1");

  const tokenInContract = new ethers.Contract(tokenIn, ERC20_FUNCS, deployer);

  await tokenInContract.approve(
    swapRouter.address,
    ethers.constants.MaxUint256
  );

  return swapRouter.exactInputSingle({
    tokenIn,
    tokenOut,
    amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
    recipient,
    deadline: 100000000000000,
    fee
  });
};

export const swapForwardAndBack = async (reversal?: boolean) => {
  const [tokenIn, tokenOut] = reversal ? [USDC, WETH] : [WETH, USDC];
  const amountInStart = reversal
    ? ethers.utils.parseUnits("105000", 6)
    : ethers.utils.parseEther("50");

  const [deployer] = await ethers.getSigners();
  const intermediateToken = await ethers.getContractAt(
    "IERC20",
    tokenOut,
    deployer
  );
  const intermediateTokenBalanceBefore = await intermediateToken.balanceOf(
    deployer.address
  );

  await swapToken({
    tokenIn,
    tokenOut,
    amountIn: amountInStart
  });

  const intermediateAmountAfterSwap = await intermediateToken.balanceOf(
    deployer.address
  );
  const intermediateAmountDelta = intermediateAmountAfterSwap.sub(
    intermediateTokenBalanceBefore
  );

  return swapToken({
    tokenIn: tokenOut,
    tokenOut: tokenIn,
    amountIn: intermediateAmountDelta.mul(10000).div(9985)
  });
};

export const prepareTokens = async () => {
  const [owner, otherAccount] = await ethers.getSigners();
  const wethContract = new ethers.Contract(WETH, ERC20_FUNCS, owner);
  const usdcContract = new ethers.Contract(USDC, ERC20_FUNCS, owner);

  // mint 100 weth using eth for owner
  await wethContract.deposit({ value: ethers.utils.parseEther("3000") });

  // swap 10 weth to usdc
  await swapToken({
    tokenIn: WETH,
    tokenOut: USDC,
    amountIn: ethers.utils.parseEther("100"),
    fee: 500
  });

  //transfer 10,000 usdc to another account
  await usdcContract.transfer(
    otherAccount.address,
    ethers.utils.parseUnits("10000", 6)
  );
  await wethContract.transfer(
    otherAccount.address,
    ethers.utils.parseEther("30")
  );

  return { usdcContract, wethContract };
};

export const getPoolAddress = async () => {
  const [owner] = await ethers.getSigners();
  const uniswapFactory: IUniswapV3Factory = await ethers.getContractAt(
    "IUniswapV3Factory",
    FACTORY_ADDRESS,
    owner.address
  );

  return uniswapFactory.getPool(WETH, USDC, POOL_FEE);
};
export const deployFactory = async () => {
  const AlphaProVault = await ethers.getContractFactory("AlphaProVault");
  const alphaProVault = await AlphaProVault.deploy();
  const [owner] = await ethers.getSigners();

  const AlphaProVaultFactory = await ethers.getContractFactory(
    "AlphaProVaultFactory"
  );
  const alphaProVaultFactory = (await AlphaProVaultFactory.deploy(
    alphaProVault.address,
    owner.address,
    PROTOCOL_FEE
  )) as AlphaProVaultFactory;
  const poolAddress = await getPoolAddress();

  const createTx = await alphaProVaultFactory.createVault({
    pool: poolAddress,
    manager: owner.address,
    managerFee: 0,
    rebalanceDelegate: ZERO_ADDR,
    maxTotalSupply: BigNumber.from(10).pow(20),
    baseThreshold: 1200,
    limitThreshold: 600,
    fullRangeWeight: 0,
    period: 0,
    minTickMove: MIN_TICK_MOVE,
    maxTwapDeviation: MAX_TWAP_DEVIATION,
    twapDuration: TWAP_DURATION,
    name: "AV_TEST",
    symbol: "AV_TEST"
  });

  const rc = await createTx.wait();
  const vaultAddress = rc?.events?.find(
    (event: any) => event.event === "NewVault"
  )?.args?.vault;
  const vaultContract = (await ethers.getContractAt(
    "AlphaProVault",
    vaultAddress,
    owner.address
  )) as AlphaProVault;
  const { usdcContract, wethContract } = await prepareTokens();
  await usdcContract.approve(vaultAddress, ethers.constants.MaxUint256);
  await wethContract.approve(vaultAddress, ethers.constants.MaxUint256);

  return {
    alphaProVaultFactory,
    alphaProVault,
    vaultContract,
    owner,
    usdcContract,
    wethContract
  };
};
export const deployFactoryWithDeposit = async () => {
  const {
    alphaProVaultFactory,
    alphaProVault,
    vaultContract,
    owner
  } = await deployFactory();
  const { usdcContract, wethContract } = await prepareTokens();

  // should deposit 20000 usdc and 10 eth
  const usdcAmount = ethers.utils.parseUnits("21000", 6);
  const wethAmount = ethers.utils.parseEther("10");

  await usdcContract.approve(
    vaultContract.address,
    ethers.constants.MaxUint256
  );
  await wethContract.approve(
    vaultContract.address,
    ethers.constants.MaxUint256
  );

  await vaultContract.deposit(
    usdcAmount,
    wethAmount,
    usdcAmount,
    wethAmount,
    owner.address
  );

  await vaultContract.rebalance();

  return {
    alphaProVault,
    alphaProVaultFactory,
    vaultAddress: vaultContract.address,
    vaultContract,
    usdcContract,
    wethContract
  };
};

export const deployPeriphery = async () => {
  const periphery = await ethers.getContractFactory("AlphaProPeriphery");
  const peripheryContract = await periphery.deploy();

  return { peripheryContract };
};

export const deployManagerStore = async () => {
  const managerStore = await ethers.getContractFactory("ManagerStore");
  const managerStoreContract = await managerStore.deploy();

  return { managerStoreContract };
}

