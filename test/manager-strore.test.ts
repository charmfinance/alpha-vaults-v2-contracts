import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployManagerStore } from "./helpers";

describe("ManagerStore", function() {
  it("should be able to reset auth with registering again", async function() {
    const { managerStoreContract } = await loadFixture(deployManagerStore);
    const [, user] = await ethers.getSigners();

    await managerStoreContract.connect(user).registerManager("dummy1");

    await expect(
      managerStoreContract.connect(user).authorizeManager(user.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(
      managerStoreContract.deauthorizeManager(user.address)
    ).to.be.revertedWith("Manager not authorized");

    await managerStoreContract.authorizeManager(user.address);
    expect(
      (await managerStoreContract.managersMap(user.address)).isAuthorized
    ).to.be.eq(true);

    // deauth
    await managerStoreContract.deauthorizeManager(user.address);
    expect(
      (await managerStoreContract.managersMap(user.address)).isAuthorized
    ).to.be.eq(false);

    // auth back
    await managerStoreContract.authorizeManager(user.address);
    expect(
      (await managerStoreContract.managersMap(user.address)).isAuthorized
    ).to.be.eq(true);

    // registering again to reset auth
    await managerStoreContract.connect(user).registerManager("dummy2");
    expect(
      (await managerStoreContract.managersMap(user.address)).isAuthorized
    ).to.be.eq(false);
  });
});
