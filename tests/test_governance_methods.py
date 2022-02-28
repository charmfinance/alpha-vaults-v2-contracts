from brownie import reverts
from pytest import approx


def test_vault_governance_methods(MockToken, vault, tokens, gov, user, recipient):

    # Check sweep
    with reverts("token"):
        vault.sweep(tokens[0], 1e18, recipient, {"from": gov})
    with reverts("token"):
        vault.sweep(tokens[1], 1e18, recipient, {"from": gov})
    randomToken = gov.deploy(MockToken)
    randomToken.initialize("a", "a", 18)
    randomToken.mint(vault, 3e18, {"from": gov})
    with reverts("manager"):
        vault.sweep(randomToken, 1e18, recipient, {"from": user})
    balance = randomToken.balanceOf(recipient)
    vault.sweep(randomToken, 1e18, recipient, {"from": gov})
    assert randomToken.balanceOf(recipient) == balance + 1e18
    assert randomToken.balanceOf(vault) == 2e18

    # Check setting max total supply
    with reverts("manager"):
        vault.setMaxTotalSupply(1 << 255, {"from": user})
    vault.setMaxTotalSupply(1 << 255, {"from": gov})
    assert vault.maxTotalSupply() == 1 << 255

    # Check emergency burn
    vault.deposit(1e8, 1e10, 0, 0, gov, {"from": gov})
    vault.rebalance({"from": user})

    with reverts("manager"):
        vault.emergencyBurn(vault.baseLower(), vault.baseUpper(), 1e4, {"from": user})
    balance0 = tokens[0].balanceOf(vault)
    balance1 = tokens[1].balanceOf(vault)
    total0, total1 = vault.getTotalAmounts()
    vault.emergencyBurn(vault.baseLower(), vault.baseUpper(), 1e4, {"from": gov})
    assert tokens[0].balanceOf(vault) > balance0
    assert tokens[1].balanceOf(vault) > balance1
    total0After, total1After = vault.getTotalAmounts()
    assert approx(total0After) == total0
    assert approx(total1After) == total1

    # Check setting manager
    with reverts("manager"):
        vault.setManager(recipient, {"from": user})
    assert vault.pendingManager() != recipient
    vault.setManager(recipient, {"from": gov})
    assert vault.pendingManager() == recipient

    # Check accepting manager
    with reverts("pendingManager"):
        vault.acceptManager({"from": user})
    assert vault.manager() != recipient
    tx = vault.acceptManager({"from": recipient})
    assert vault.manager() == recipient
    assert tx.events["UpdateManager"] == {
        "manager": recipient,
    }


def test_collect_protocol_fees(vault, pool, router, tokens, gov, user, recipient):
    vault.setMaxTwapDeviation(1 << 20, {"from": gov})
    vault.deposit(1e18, 1e20, 0, 0, gov, {"from": gov})
    vault.rebalance({"from": user})

    router.swap(pool, True, 1e16, {"from": gov})
    router.swap(pool, False, 1e18, {"from": gov})
    vault.rebalance({"from": user})
    protocolFees0, protocolFees1 = (
        vault.accruedProtocolFees0(),
        vault.accruedProtocolFees1(),
    )

    balance0 = tokens[0].balanceOf(recipient)
    balance1 = tokens[1].balanceOf(recipient)
    with reverts("governance"):
        vault.collectProtocol(1e3, 1e4, recipient, {"from": user})
    with reverts("SafeMath: subtraction overflow"):
        vault.collectProtocol(1e18, 1e4, recipient, {"from": gov})
    with reverts("SafeMath: subtraction overflow"):
        vault.collectProtocol(1e3, 1e18, recipient, {"from": gov})
    tx = vault.collectProtocol(1e3, 1e4, recipient, {"from": gov})
    assert vault.accruedProtocolFees0() == protocolFees0 - 1e3
    assert vault.accruedProtocolFees1() == protocolFees1 - 1e4
    assert tokens[0].balanceOf(recipient) - balance0 == 1e3
    assert tokens[1].balanceOf(recipient) - balance1 == 1e4 > 0
    assert tx.events["CollectProtocol"] == {
        "amount0": 1e3,
        "amount1": 1e4,
    }


def test_strategy_governance_methods(vault, gov, user, recipient):

    # Check setting base threshold
    with reverts("manager"):
        vault.setBaseThreshold(0, {"from": user})
    with reverts("threshold must be multiple of tickSpacing"):
        vault.setBaseThreshold(2401, {"from": gov})
    with reverts("threshold must be > 0"):
        vault.setBaseThreshold(0, {"from": gov})
    with reverts("threshold too high"):
        vault.setBaseThreshold(887280, {"from": gov})
    vault.setBaseThreshold(4800, {"from": gov})
    assert vault.baseThreshold() == 4800

    # Check setting limit threshold
    with reverts("manager"):
        vault.setLimitThreshold(0, {"from": user})
    with reverts("threshold must be multiple of tickSpacing"):
        vault.setLimitThreshold(1201, {"from": gov})
    with reverts("threshold must be > 0"):
        vault.setLimitThreshold(0, {"from": gov})
    with reverts("threshold too high"):
        vault.setLimitThreshold(887280, {"from": gov})
    vault.setLimitThreshold(600, {"from": gov})
    assert vault.limitThreshold() == 600

    # Check setting max twap deviation
    with reverts("manager"):
        vault.setMaxTwapDeviation(1000, {"from": user})
    with reverts("maxTwapDeviation must be >= 0"):
        vault.setMaxTwapDeviation(-1, {"from": gov})
    vault.setMaxTwapDeviation(1000, {"from": gov})
    assert vault.maxTwapDeviation() == 1000

    # Check setting twap duration
    with reverts("manager"):
        vault.setTwapDuration(800, {"from": user})
    vault.setTwapDuration(800, {"from": gov})
    assert vault.twapDuration() == 800


def test_factory_governance_methods(factory, vault, gov, user, recipient):
    # Check setting protocol fee
    with reverts("governance"):
        factory.setProtocolFee(0, {"from": user})
    with reverts("protocolFee must be <= 200000"):
        factory.setProtocolFee(200001, {"from": gov})
    factory.setProtocolFee(0, {"from": gov})
    assert factory.protocolFee() == 0

    # Check fee change is only reflected in vault after a rebalance
    with reverts("governance"):
        factory.setProtocolFee(0, {"from": user})
    assert factory.protocolFee() == 0
    assert vault.protocolFee() != 0
    vault.rebalance({"from": user})
    assert vault.protocolFee() == 0

    # Check collecting protocol fees from vault
    with reverts("governance"):
        vault.collectProtocol(0, 0, user, {"from": user})
    vault.collectProtocol(0, 0, gov, {"from": gov})

    # Check setting gov
    with reverts("governance"):
        factory.setGovernance(recipient, {"from": user})
    assert factory.pendingGovernance() != recipient
    factory.setGovernance(recipient, {"from": gov})
    assert factory.pendingGovernance() == recipient

    # Check accepting gov
    with reverts("pendingGovernance"):
        factory.acceptGovernance({"from": user})
    assert factory.governance() != recipient
    tx = factory.acceptGovernance({"from": recipient})
    assert factory.governance() == recipient
    assert tx.events["UpdateGovernance"] == {
        "governance": recipient,
    }

    # Check only new gov can collect protocol fees
    with reverts("governance"):
        vault.collectProtocol(0, 0, gov, {"from": gov})
    vault.collectProtocol(0, 0, recipient, {"from": recipient})
