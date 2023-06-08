import { ethers } from "hardhat";
import { expect } from "chai";
import { FACTORY_ADDRESS, ZERO_ADDR } from "../utils/constants";
import { getPoolAddress, POOL_FEE, USDC, WETH } from "./helpers";
import { AlphaProVaultFactory } from "../typechain-types/contracts/AlphaProVaultFactory";
import { AlphaProVault } from "../typechain-types/contracts/AlphaProVault";
import { IUniswapV3Factory, IUniswapV3Pool } from "../typechain-types";

describe("Factory", function() {
  it("test create vault", async function() {
    const [owner] = await ethers.getSigners();
    const AlphaProVaultFactory = await ethers.getContractFactory(
      "AlphaProVaultFactory"
    );
    const AlphaProVault = await ethers.getContractFactory("AlphaProVault");
    const alphaProVault = (await AlphaProVault.deploy()) as AlphaProVault;
    const uniswapFactory: IUniswapV3Factory = await ethers.getContractAt(
      "IUniswapV3Factory",
      FACTORY_ADDRESS,
      owner
    );
    const poolAddress = await uniswapFactory.getPool(WETH, USDC, POOL_FEE);

    const alphaProVaultFactory = (await AlphaProVaultFactory.deploy(
      alphaProVault.address,
      owner.address,
      10000
    )) as AlphaProVaultFactory;

    expect(await alphaProVaultFactory.template()).to.eq(alphaProVault.address);
    expect(await alphaProVaultFactory.governance()).to.eq(owner.address);
    expect(await alphaProVaultFactory.protocolFee()).to.eq(10000);
    expect(await alphaProVaultFactory.numVaults()).to.eq(0);

    const vaultTx = await alphaProVaultFactory.createVault({
      pool: poolAddress,
      manager: owner.address,
      managerFee: 0,
      rebalanceDelegate: ZERO_ADDR,
      maxTotalSupply: 100,
      baseThreshold: 2400,
      limitThreshold: 1200,
      fullRangeWeight: 300000,
      period: 86400,
      minTickMove: 100,
      maxTwapDeviation: 200,
      twapDuration: 60,
      name: "N",
      symbol: "S"
    });
    const rc = await vaultTx.wait();
    const address = rc?.events?.find((event: any) => event.event === "NewVault")
      ?.args?.vault;

    expect(address).to.not.be.undefined;
    const vaultContract = (await ethers.getContractAt(
      "AlphaProVault",
      address,
      owner.address
    )) as AlphaProVault;
    const poolContract = (await ethers.getContractAt(
      "IUniswapV3Pool",
      poolAddress,
      owner.address
    )) as IUniswapV3Pool;

    expect(await vaultContract.pool()).to.eq(poolContract.address);
    expect(await vaultContract.manager()).to.eq(owner.address);
    expect(await vaultContract.token0()).to.eq(await poolContract.token0());
    expect(await vaultContract.token1()).to.eq(await poolContract.token1());
    expect(await vaultContract.protocolFee()).to.eq(0);
    expect(await vaultContract.maxTotalSupply()).to.eq(100);
    expect(await vaultContract.baseThreshold()).to.eq(2400);
    expect(await vaultContract.limitThreshold()).to.eq(1200);
    expect(await vaultContract.fullRangeWeight()).to.eq(300000);
    expect(await vaultContract.period()).to.eq(86400);
    expect(await vaultContract.minTickMove()).to.eq(100);
    expect(await vaultContract.maxTwapDeviation()).to.eq(200);
    expect(await vaultContract.twapDuration()).to.eq(60);
    expect(await vaultContract.name()).to.eq("N");
    expect(await vaultContract.symbol()).to.eq("S");
    expect(await vaultContract.decimals()).to.eq(18);
    expect(await vaultContract.getTotalAmounts()).to.deep.eq([0, 0]);
    expect(await vaultContract.fullLower()).to.eq(-887220);
    expect(await vaultContract.fullUpper()).to.eq(887220);
    expect(await vaultContract.lastTick()).to.eq(0);
    expect(await vaultContract.lastTimestamp()).to.eq(0);

    expect(await alphaProVaultFactory.numVaults()).to.eq(1);
    expect(await alphaProVaultFactory.vaults(0)).to.eq(vaultContract.address);
    expect(await alphaProVaultFactory.isVault(vaultContract.address)).to.eq(
      true
    );
  });

  it("test contructor checks", async function() {
    const [owner] = await ethers.getSigners();

    const AlphaProVault = await ethers.getContractFactory("AlphaProVault");
    const alphaProVault = await AlphaProVault.deploy();
    const AlphaProVaultFactory = await ethers.getContractFactory(
      "AlphaProVaultFactory"
    );
    expect(
      AlphaProVaultFactory.deploy(alphaProVault.address, owner.address, 200001)
    ).to.be.revertedWith("protocolFee must be <= 200000");
    const alphaProVaultFactory = await AlphaProVaultFactory.deploy(
      alphaProVault.address,
      owner.address,
      10000
    );
    const poolAddress = await getPoolAddress();

    const standartVaultParams = {
      pool: poolAddress,
      manager: owner.address,
      rebalanceDelegate: ZERO_ADDR,
      maxTotalSupply: 100,
      baseThreshold: 2400,
      limitThreshold: 1200,
      fullRangeWeight: 300000,
      period: 86400,
      minTickMove: 100,
      maxTwapDeviation: 200,
      twapDuration: 60,
      name: "N",
      symbol: "S"
    };

    expect(
      alphaProVaultFactory.createVault({
        ...standartVaultParams,
        baseThreshold: 0
      })
    ).to.be.revertedWith("threshold must be > 0");
    expect(
      alphaProVaultFactory.createVault({
        ...standartVaultParams,
        limitThreshold: 0
      })
    ).to.be.revertedWith("threshold must be > 0");
    expect(
      alphaProVaultFactory.createVault({
        ...standartVaultParams,
        fullRangeWeight: 1000001
      })
    ).to.be.revertedWith("fullRangeWeight must be <= 1e6");

    expect(
      alphaProVaultFactory.createVault({
        ...standartVaultParams,
        minTickMove: -1
      })
    ).to.be.revertedWith("minTickMove must be >= 0");
    expect(
      alphaProVaultFactory.createVault({
        ...standartVaultParams,
        maxTwapDeviation: 1000001
      })
    ).to.be.revertedWith("maxTwapDeviation must be <= 1e6");
    expect(
      alphaProVaultFactory.createVault({
        ...standartVaultParams,
        twapDuration: 0
      })
    ).to.be.revertedWith("twapDuration must be > 0");
  });
});
