import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployFactoryWithDeposit, swapForwardAndBack } from "./helpers";
import { ethers } from "hardhat";
import { expect } from "chai";

describe("Invariants", function() {
  it("test total amounts includes fees", async function() {
    const { vaultContract } = await loadFixture(deployFactoryWithDeposit);
    const [, user] = await ethers.getSigners();
    const [total0, total1] = await vaultContract.getTotalAmounts();

    await swapForwardAndBack();
    await swapForwardAndBack(true);

    let [total0After, total1After] = await vaultContract.getTotalAmounts();

    expect(total0After).to.be.approximately(total0, 10000);
    expect(total1After).to.be.approximately(total1, 1000000000000);
    expect(total0After).to.be.not.eq(total0);
    expect(total1After).to.be.not.eq(total1);

    // simulate poke
    await vaultContract.deposit(100, 10, 0, 0, user.address);

    [total0After, total1After] = await vaultContract.getTotalAmounts();
    expect(total0After).to.be.approximately(total0, 1000000);
    expect(total1After).to.be.approximately(total1, 1000000000000000);
    expect(total0After).to.be.gt(total0);
    expect(total1After).to.be.gt(total1);
  });
});
