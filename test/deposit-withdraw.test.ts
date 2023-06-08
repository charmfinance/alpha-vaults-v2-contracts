import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import {
  deployFactory,
  deployFactoryWithDeposit,
  swapForwardAndBack
} from "./helpers";

describe("Deposit and Withdraw", function() {
  it("test initial deposit", async function() {
    const { vaultContract } = await loadFixture(deployFactoryWithDeposit);
    expect(await vaultContract.fullRangeWeight()).to.eq(0);
    await vaultContract.setFullRangeWeight(50000);
    expect(await vaultContract.fullRangeWeight()).to.eq(50000);
    await vaultContract.rebalance();
    await swapForwardAndBack();
    await swapForwardAndBack(true);
    await vaultContract.rebalance();
  });

  [
    [0, 1],
    [1, 0],
    [1e10, 0],
    [0, 1e10],
    [1e4, 1e10],
    [1e10, 1e10]
  ].forEach(([amount0Desired, amount1Desired]) => {
    it(`should deposit ${amount0Desired} ${amount1Desired}`, async function() {
      const {
        vaultContract,
        owner,
        usdcContract,
        wethContract
      } = await loadFixture(deployFactory);
      const [, user] = await ethers.getSigners();

      const balance0 = await usdcContract.balanceOf(user.address);
      const balance1 = await wethContract.balanceOf(user.address);
      await usdcContract
        .connect(user)
        .approve(vaultContract.address, ethers.constants.MaxUint256);
      await wethContract
        .connect(user)
        .approve(vaultContract.address, ethers.constants.MaxUint256);
      await vaultContract
        .connect(user)
        .deposit(amount0Desired, amount1Desired, 0, 0, user.address);

      const shares = await vaultContract.balanceOf(user.address);

      expect(shares).to.gt(0);
      expect(balance0.sub(await usdcContract.balanceOf(user.address))).to.eq(
        amount0Desired
      );
      expect(balance1.sub(await wethContract.balanceOf(user.address))).to.eq(
        amount1Desired
      );
    });
  });

  it("test deposit checks", async function() {
    const {
      vaultContract,
      owner,
      usdcContract,
      wethContract
    } = await loadFixture(deployFactory);

    await usdcContract.approve(
      vaultContract.address,
      ethers.constants.MaxUint256
    );
    await wethContract.approve(
      vaultContract.address,
      ethers.constants.MaxUint256
    );

    await expect(
      vaultContract.deposit(0, 0, 0, 0, owner.address)
    ).to.be.revertedWith("amount0Desired or amount1Desired");
    await expect(
      vaultContract.deposit(1e8, 1e8, 0, 0, ethers.constants.AddressZero)
    ).to.be.revertedWith("to");
    await expect(
      vaultContract.deposit(1e8, 1e8, 0, 0, vaultContract.address)
    ).to.be.revertedWith("to");
    await expect(
      vaultContract.deposit(1e8, 0, 2e8, 0, owner.address)
    ).to.be.revertedWith("amount0Min");
    await expect(
      vaultContract.deposit(0, 1e8, 0, 2e8, owner.address)
    ).to.be.revertedWith("amount1Min");
    await expect(
      vaultContract.deposit(
        1e8,
        BigNumber.from(20).mul((1e19).toString()),
        0,
        0,
        owner.address
      )
    ).to.be.revertedWith("maxTotalSupply");
  });

  it("should be able to deposit and withdraw", async function() {
    const { vaultContract, usdcContract, wethContract } = await loadFixture(
      deployFactoryWithDeposit
    );
    const [owner] = await ethers.getSigners();

    const vaultTokenBalance = await vaultContract.balanceOf(owner.address);

    expect(vaultTokenBalance).to.eq("10000000000001000000");
    expect(await vaultContract.totalSupply()).to.eq(
      "10000000000001000000"
    );

    const wethUserBalanceBefore = await wethContract.balanceOf(owner.address);
    const usdcUserBalanceBefore = await usdcContract.balanceOf(owner.address);
    const [total0, total1] = await vaultContract.getTotalAmounts();
    await vaultContract.withdraw(vaultTokenBalance, 0, 0, owner.address);

    expect(await vaultContract.balanceOf(owner.address)).to.eq(0);
    expect(await vaultContract.totalSupply()).to.eq(0);
    expect(await usdcContract.balanceOf(owner.address)).to.eq(
      total0.add(usdcUserBalanceBefore)
    );
    expect(await wethContract.balanceOf(owner.address)).to.eq(
      total1.add(wethUserBalanceBefore)
    );
  });

  it("test withdraw checks", async function() {
    const { vaultContract, usdcContract, wethContract } = await loadFixture(
      deployFactoryWithDeposit
    );
    const [owner, user] = await ethers.getSigners();

    await expect(
      vaultContract.withdraw(0, 0, 0, owner.address)
    ).to.be.revertedWith("shares");
    await expect(
      vaultContract.withdraw(1e8, 1e10, 0, owner.address)
    ).to.be.revertedWith("amount0Min");
    await expect(
      vaultContract.withdraw(1e8, 0, 1e10, owner.address)
    ).to.be.revertedWith("amount1Min");
    await expect(
      vaultContract.withdraw(1e8, 1e8, 0, ethers.constants.AddressZero)
    ).to.be.revertedWith("to");
    await expect(
      vaultContract.withdraw(1e8, 1e8, 0, vaultContract.address)
    ).to.be.revertedWith("to");
  });
});
