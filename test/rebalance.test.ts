import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  deployFactoryWithDeposit,
  swapForwardAndBack,
  swapToken,
  USDC,
  WETH
} from "./helpers";

describe("Rebalance", function() {
  it("should gain profit after rebalance", async function() {
    const { vaultContract } = await loadFixture(deployFactoryWithDeposit);
    const [deployer] = await ethers.getSigners();

    const [total0, total1] = await vaultContract.getTotalAmounts();

    await swapForwardAndBack();
    await swapForwardAndBack(true);

    const [total0After, total1After] = await vaultContract.getTotalAmounts();

    expect(total0After).to.be.approximately(total0, 1e5);
    expect(total1After).to.be.approximately(total1, 1e12);

    // make tiny deposit to simulate poke
    await vaultContract.deposit(10, 10, 1, 1, deployer.address);

    const [
      totalAfterPoke0,
      totalAfterPoke1
    ] = await vaultContract.getTotalAmounts();

    expect(totalAfterPoke0.mul(1000000).div(total0)).gt(1000001);
    expect(totalAfterPoke1.mul(1000000).div(total1)).gt(1000001);
  });

  it("manager fee is applied only to next rebalance", async function() {
    const { vaultContract } = await loadFixture(deployFactoryWithDeposit);

    //init fees amount is empty
    expect(await vaultContract.accruedManagerFees0()).to.eq(0);
    expect(await vaultContract.accruedManagerFees1()).to.eq(0);
    expect(await vaultContract.accruedProtocolFees0()).to.eq(0);
    expect(await vaultContract.accruedProtocolFees1()).to.eq(0);

    await swapForwardAndBack();
    await swapForwardAndBack(true);
    await vaultContract.rebalance();

    // management fees not set yet but protocol fees were mined
    expect(await vaultContract.accruedManagerFees0()).to.eq(0);
    expect(await vaultContract.accruedManagerFees1()).to.eq(0);
    expect(await vaultContract.accruedProtocolFees0()).to.eq(30150);
    expect(await vaultContract.accruedProtocolFees1()).to.eq(14263705659729);

    // setting and checking management fee
    expect(await vaultContract.pendingManagerFee()).to.eq(0);
    expect(await vaultContract.managerFee()).to.eq(0);
    await vaultContract.setManagerFee(12000);
    expect(await vaultContract.pendingManagerFee()).to.eq(12000);
    expect(await vaultContract.managerFee()).to.eq(0);

    await swapForwardAndBack();
    await swapForwardAndBack(true);
    await vaultContract.rebalance();

    //management fee is set as active after rebalance but will be appllied only on next rebalance
    expect(await vaultContract.pendingManagerFee()).to.eq(12000);
    expect(await vaultContract.managerFee()).to.eq(12000);

    expect(await vaultContract.accruedManagerFees0()).to.eq(0);
    expect(await vaultContract.accruedManagerFees1()).to.eq(0);
    expect(await vaultContract.accruedProtocolFees0()).to.eq(60301);
    expect(await vaultContract.accruedProtocolFees1()).to.eq(28528072482918);

    await swapForwardAndBack();
    await swapForwardAndBack(true);
    await vaultContract.rebalance();

    // management fee was set as active on previous rebalance ,so we should be able to see generated fees
    expect(await vaultContract.accruedManagerFees0()).to.eq(12061);
    expect(await vaultContract.accruedManagerFees1()).to.eq(5706011207141);
    expect(await vaultContract.accruedProtocolFees0()).to.eq(90454);
    expect(await vaultContract.accruedProtocolFees1()).to.eq(42793100500772);
  });

  it("check only delegator and manager can rebalance", async function() {
    const { vaultContract } = await loadFixture(deployFactoryWithDeposit);
    const [owner, user, otherUser] = await ethers.getSigners();

    // anyone can rebalance
    await vaultContract.rebalance();
    await vaultContract.connect(user).rebalance();
    await vaultContract.connect(otherUser).rebalance();

    // only delegator and manager can rebalance
    await vaultContract.setRebalanceDelegate(user.address);
    await expect(
      vaultContract.connect(otherUser).rebalance()
    ).to.be.revertedWith("rebalanceDelegate");
    await vaultContract.connect(user).rebalance();
    await vaultContract.connect(owner).rebalance();

    // only owner can rabanance
    await vaultContract.setRebalanceDelegate(owner.address);
    await expect(vaultContract.connect(user).rebalance()).to.be.revertedWith(
      "rebalanceDelegate"
    );
    await expect(
      vaultContract.connect(otherUser).rebalance()
    ).to.be.revertedWith("rebalanceDelegate");
  });

  it("check enough time has passed", async function() {
    const { vaultContract } = await loadFixture(deployFactoryWithDeposit);

    await vaultContract.setPeriod(100);
    await expect(vaultContract.rebalance()).to.be.revertedWith("PE");
    await ethers.provider.send("evm_increaseTime", [1000]);
    await ethers.provider.send("evm_mine", []);
    await vaultContract.rebalance();
  });

  it("check price has moved enough", async function() {
    const { vaultContract } = await loadFixture(deployFactoryWithDeposit);

    await vaultContract.setMinTickMove(1);
    await expect(vaultContract.rebalance()).to.be.revertedWith("TM");
    // should not fail if price moved enough
    await swapToken({
      tokenIn: WETH,
      tokenOut: USDC,
      amountIn: ethers.utils.parseEther("200")
    });
    await vaultContract.rebalance();
  });

  it("check price near twap", async function() {
    const { vaultContract } = await loadFixture(deployFactoryWithDeposit);

    //shold rebalance if price is near twap
    await vaultContract.setMaxTwapDeviation(10);
    await swapForwardAndBack();
    await vaultContract.rebalance();

    // should not rebalance if price is not near twap
    await swapToken({
      tokenIn: WETH,
      tokenOut: USDC,
      amountIn: ethers.utils.parseEther("200")
    });
    await expect(vaultContract.rebalance()).to.be.revertedWith("TP");

    // should rebalance if time passes
    await ethers.provider.send("evm_increaseTime", [1000]);
    await ethers.provider.send("evm_mine", []);
    await swapForwardAndBack();
    await vaultContract.rebalance();
  });
});
