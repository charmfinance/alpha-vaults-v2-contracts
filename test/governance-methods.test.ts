import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { deployFactoryWithDeposit, swapForwardAndBack } from "./helpers";
import { expect } from "chai";

describe("Governance Methods", function() {
  it("test vault governance methods", async function() {
    const { vaultContract, usdcContract, wethContract } = await loadFixture(
      deployFactoryWithDeposit
    );

    const [, user] = await ethers.getSigners();

    // should revert if not called governance
    await expect(
      vaultContract.connect(user).setFullRangeWeight(100)
    ).to.be.revertedWith("manager");

    // should set full range weight
    await vaultContract.setFullRangeWeight(100);
    expect(await vaultContract.fullRangeWeight()).to.eq(100);

    // Check setting max total supply
    await expect(
      vaultContract.connect(user).setMaxTotalSupply(100)
    ).to.be.revertedWith("manager");
    await vaultContract.setMaxTotalSupply(100);
    expect(await vaultContract.maxTotalSupply()).to.eq(100);

    // Check emergency burn
    const baseLower = await vaultContract.baseLower();
    const baseUpper = await vaultContract.baseUpper();
    await expect(
      vaultContract.connect(user).emergencyBurn(baseLower, baseUpper, 1e4)
    ).to.be.revertedWith("manager");
    const balance0 = await usdcContract.balanceOf(vaultContract.address);
    const balance1 = await wethContract.balanceOf(vaultContract.address);
    const [total0, total1] = await vaultContract.getTotalAmounts();
    await vaultContract.emergencyBurn(baseLower, baseUpper, 1e10);
    const balance0After = await usdcContract.balanceOf(vaultContract.address);
    const balance1After = await wethContract.balanceOf(vaultContract.address);
    const [total0After, total1After] = await vaultContract.getTotalAmounts();
    expect(balance0After).to.gt(balance0);
    expect(balance1After).to.gt(balance1);
    expect(total0After).to.approximately(total0, 10);
    expect(total1After).to.approximately(total1, 10);

    // Check setting manager
    await expect(
      vaultContract.connect(user).setManager(user.address)
    ).to.be.revertedWith("manager");
    await vaultContract.setManager(user.address);
    expect(await vaultContract.pendingManager()).to.eq(user.address);

    // Check setting manager fee
    await expect(
      vaultContract.connect(user).setManagerFee(100)
    ).to.be.revertedWith("manager");
    await vaultContract.setManagerFee(100);
    expect(await vaultContract.pendingManagerFee()).to.eq(100);
    expect(await vaultContract.managerFee()).to.eq(0);
    await vaultContract.rebalance();
    expect(await vaultContract.managerFee()).to.eq(100);

    // Check accepting manager
    await expect(vaultContract.acceptManager()).to.be.revertedWith(
      "pendingManager"
    );
    await vaultContract.connect(user).acceptManager();
    expect(await vaultContract.manager()).to.eq(user.address);
  });

  it("test collect protocol fees", async function() {
    const { vaultContract, usdcContract, wethContract } = await loadFixture(
      deployFactoryWithDeposit
    );

    const [owner, user] = await ethers.getSigners();
    let accruedProtocolFees0 = await vaultContract.accruedProtocolFees0();
    let accruedProtocolFees1 = await vaultContract.accruedProtocolFees1();

    expect(accruedProtocolFees0).to.eq(0);
    expect(accruedProtocolFees1).to.eq(0);

    await swapForwardAndBack();
    await swapForwardAndBack(true);
    await vaultContract.rebalance();

    accruedProtocolFees0 = await vaultContract.accruedProtocolFees0();
    accruedProtocolFees1 = await vaultContract.accruedProtocolFees1();

    expect(accruedProtocolFees0).to.eq(30150);
    expect(accruedProtocolFees1).to.eq(14263705659729);

    // should revert if not called governance
    await expect(
      vaultContract.connect(user).collectProtocol(user.address)
    ).to.be.revertedWith("governance");
    //should claim governance fees
    const balanceUsdcBefore = await usdcContract.balanceOf(owner.address);
    const balanceWethBefore = await wethContract.balanceOf(owner.address);

    await vaultContract.collectProtocol(owner.address);

    const balanceUsdcAfter = await usdcContract.balanceOf(owner.address);
    const balanceWethAfter = await wethContract.balanceOf(owner.address);

    expect(balanceUsdcAfter.sub(balanceUsdcBefore)).to.eq(accruedProtocolFees0);
    expect(balanceWethAfter.sub(balanceWethBefore)).to.eq(accruedProtocolFees1);
  });

  it("test collect manager fees", async function() {
    const {
      alphaProVaultFactory,
      vaultContract,
      usdcContract,
      wethContract
    } = await loadFixture(deployFactoryWithDeposit);
    const [owner, user] = await ethers.getSigners();
    await vaultContract.setManagerFee(40000);
    await alphaProVaultFactory.setProtocolFee(10000);
    // rebalance to apply both fees for next swaps
    await vaultContract.rebalance();

    // should be 0 since
    let accruedManagerFees0 = await vaultContract.accruedManagerFees0();
    let accruedManagerFees1 = await vaultContract.accruedManagerFees1();

    expect(accruedManagerFees0).to.eq(0);
    expect(accruedManagerFees1).to.eq(0);

    await swapForwardAndBack();
    await swapForwardAndBack(true);
    await vaultContract.rebalance();

    accruedManagerFees0 = await vaultContract.accruedManagerFees0();
    accruedManagerFees1 = await vaultContract.accruedManagerFees1();
    const accruedProtocolFees0 = await vaultContract.accruedProtocolFees0();
    const accruedProtocolFees1 = await vaultContract.accruedProtocolFees1();

    expect(accruedManagerFees0).to.eq(40200);
    expect(accruedManagerFees1).to.eq(19018274212068);

    // manager fees set be 1/4 of protocol fees
    expect(accruedManagerFees0).to.eq(accruedProtocolFees0.mul(4));
    expect(accruedManagerFees1).to.eq(accruedProtocolFees1.mul(4));

    // should revert if not called governance
    await expect(
      vaultContract.connect(user).collectManager(user.address)
    ).to.be.revertedWith("manager");

    //should claim governance fees
    const balanceUsdcBefore = await usdcContract.balanceOf(owner.address);
    const balanceWethBefore = await wethContract.balanceOf(owner.address);

    const balanceUsdcVaultBefore = await usdcContract.balanceOf(
      vaultContract.address
    );
    const balanceWethVaultBefore = await wethContract.balanceOf(
      vaultContract.address
    );

    await vaultContract.collectManager(owner.address);

    const balanceUsdcAfter = await usdcContract.balanceOf(owner.address);
    const balanceWethAfter = await wethContract.balanceOf(owner.address);

    expect(balanceUsdcAfter.sub(balanceUsdcBefore)).to.eq(accruedManagerFees0);
    expect(balanceWethAfter.sub(balanceWethBefore)).to.eq(accruedManagerFees1);
  });

  it("test strategy governance methods", async function() {
    const { vaultContract, usdcContract, wethContract } = await loadFixture(
      deployFactoryWithDeposit
    );
    const [owner, user] = await ethers.getSigners();

    // Check setting base threshold
    await expect(
      vaultContract.connect(user).setBaseThreshold(100)
    ).to.be.revertedWith("manager");
    await expect(vaultContract.setBaseThreshold(1001)).to.be.revertedWith(
      "threshold must be multiple of tickSpacing"
    );
    await expect(vaultContract.setBaseThreshold(0)).to.be.revertedWith(
      "threshold must be > 0"
    );
    await expect(vaultContract.setBaseThreshold(887280)).to.be.revertedWith(
      "threshold too high"
    );
    await vaultContract.setBaseThreshold(4800);
    expect(await vaultContract.baseThreshold()).to.eq(4800);

    // Check setting limit threshold
    await expect(
      vaultContract.connect(user).setLimitThreshold(100)
    ).to.be.revertedWith("manager");
    await expect(vaultContract.setLimitThreshold(1001)).to.be.revertedWith(
      "threshold must be multiple of tickSpacing"
    );
    await expect(vaultContract.setLimitThreshold(0)).to.be.revertedWith(
      "threshold must be > 0"
    );
    await expect(vaultContract.setLimitThreshold(887280)).to.be.revertedWith(
      "threshold too high"
    );
    await vaultContract.setLimitThreshold(4800);
    expect(await vaultContract.limitThreshold()).to.eq(4800);

    // Check setting max twap deviation
    await expect(
      vaultContract.connect(user).setMaxTwapDeviation(100)
    ).to.be.revertedWith("manager");
    await expect(vaultContract.setMaxTwapDeviation(-1)).to.be.revertedWith(
      "maxTwapDeviation must be >= 0"
    );
    await vaultContract.setMaxTwapDeviation(100);
    expect(await vaultContract.maxTwapDeviation()).to.eq(100);

    // Check setting twap duration
    await expect(
      vaultContract.connect(user).setTwapDuration(100)
    ).to.be.revertedWith("manager");
    await vaultContract.setTwapDuration(100);
    expect(await vaultContract.twapDuration()).to.eq(100);
  });

  it("test factory governance methods", async function() {
    const {
      alphaProVaultFactory,
      vaultContract,
      usdcContract,
      wethContract
    } = await loadFixture(deployFactoryWithDeposit);
    const [owner, user] = await ethers.getSigners();

    // Check setting protocol fee
    await expect(
      alphaProVaultFactory.connect(user).setProtocolFee(100)
    ).to.be.revertedWith("governance");
    await expect(
      alphaProVaultFactory.setProtocolFee(200001)
    ).to.be.revertedWith("protocolFee must be <= 200000");
    await alphaProVaultFactory.setProtocolFee(0);
    expect(await alphaProVaultFactory.protocolFee()).to.eq(0);

    // Check fee change is only reflected in vault after a rebalance
    expect(await vaultContract.protocolFee()).to.not.eq(0);
    await vaultContract.rebalance();
    expect(await vaultContract.protocolFee()).to.eq(0);

    // Check setting gov
    await expect(
      alphaProVaultFactory.connect(user).setGovernance(user.address)
    ).to.be.revertedWith("governance");
    await alphaProVaultFactory.setGovernance(user.address);
    expect(await alphaProVaultFactory.pendingGovernance()).to.eq(user.address);
    expect(await alphaProVaultFactory.governance()).to.eq(owner.address);

    // Check accepting gov
    await expect(alphaProVaultFactory.acceptGovernance()).to.be.revertedWith(
      "pendingGovernance"
    );
    await alphaProVaultFactory.connect(user).acceptGovernance();
    expect(await alphaProVaultFactory.governance()).to.eq(user.address);

    // Check only new gov can collect protocol fees
    await expect(
      vaultContract.collectProtocol(owner.address)
    ).to.be.revertedWith("governance");
    await vaultContract.connect(user).collectProtocol(user.address);
  });
});
