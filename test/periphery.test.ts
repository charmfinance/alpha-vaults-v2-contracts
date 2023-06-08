import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { expect } from "chai";
import {
  deployFactoryWithDeposit,
  deployPeriphery,
  swapForwardAndBack
} from "./helpers";
describe("Periphery", function() {
  it("check accrued fees are good", async function() {
    const { vaultContract, wethContract, usdcContract } = await loadFixture(
      deployFactoryWithDeposit
    );
    const { peripheryContract } = await loadFixture(deployPeriphery);

    let [
      [full, base, limit],
      balance0,
      balance1
    ] = await peripheryContract.getVaultPositions(vaultContract.address);
    let [total0, total1] = await vaultContract.getTotalAmounts();

    // vault total amounts should be equal to liquidity in range without fees
    // fees equal zero since no swaps yet
    expect(
      balance0
        .add(full.amount0)
        .add(limit.amount0)
        .add(base.amount0)
    ).to.be.eq(total0);
    expect(
      balance1
        .add(full.amount1)
        .add(limit.amount1)
        .add(base.amount1)
    ).to.be.eq(total1);
    expect(base.fees0).to.be.eq(0);
    expect(base.fees1).to.be.eq(0);

    await swapForwardAndBack();
    await swapForwardAndBack(true);

    [
      [full, base, limit],
      balance0,
      balance1
    ] = await peripheryContract.getVaultPositions(vaultContract.address);

    const calculatedTotal0 = [base, full, limit].reduce(
      (acc, cur) => acc.add(cur.amount0).add(cur.fees0),
      ethers.BigNumber.from(0)
    );
    const calculatedTotal1 = [base, full, limit].reduce(
      (acc, cur) => acc.add(cur.amount1).add(cur.fees1),
      ethers.BigNumber.from(0)
    );

    // since swap amount is 50eth
    await vaultContract.rebalance();

    [total0, total1] = await vaultContract.getTotalAmounts();

    // check that we knew calculated fees even before rebalance
    // add 1 wei to account for rounding errors
    expect(calculatedTotal0.add(balance0)).to.approximately(total0, 2);
    expect(calculatedTotal1.add(balance1)).to.approximately(total1, 2);
  });
});
