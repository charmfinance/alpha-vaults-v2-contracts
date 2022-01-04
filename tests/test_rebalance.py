from brownie import chain, reverts
import pytest
from pytest import approx

from conftest import computePositionKey


@pytest.mark.parametrize("buy", [False, True])
@pytest.mark.parametrize("big", [False, True])
def test_strategy_rebalance(
    vault,
    pool,
    tokens,
    router,
    getPositions,
    gov,
    user,
    buy,
    big,
):
    # Mint some liquidity
    vault.deposit(1e16, 1e18, 0, 0, user, {"from": user})
    vault.rebalance({"from": user})

    # Do a swap to move the price
    qty = 1e16 * [100, 1][buy] * [1, 100][big]
    router.swap(pool, buy, qty, {"from": gov})

    # fast forward 1 day
    chain.sleep(86400)

    # Store totals
    total0, total1 = vault.getTotalAmounts()
    totalSupply = vault.totalSupply()

    # Rebalance
    tx = vault.rebalance({"from": user})

    # Check ranges are set correctly
    tick = pool.slot0()[1]
    tickFloor = tick // 60 * 60
    assert vault.baseLower() == tickFloor - 2400
    assert vault.baseUpper() == tickFloor + 60 + 2400
    if buy:
        assert vault.limitLower() == tickFloor + 60
        assert vault.limitUpper() == tickFloor + 60 + 1200
    else:
        assert vault.limitLower() == tickFloor - 1200
        assert vault.limitUpper() == tickFloor

    assert vault.lastTimestamp() == tx.timestamp
    assert vault.lastTick() == tick


def test_rebalance_period_check(
    vault, pool, tokens, router, gov, user
):
    # Set period
    vault.setPeriod(86400, {"from": gov})

    # Rebalance
    vault.rebalance({"from": user})

    # Wait just under 24 hours
    chain.sleep(86400 - 10)

    # Can't rebalance
    with reverts("cannot rebalance"):
        vault.rebalance({"from": user})

    chain.sleep(10)

    # Rebalance
    vault.rebalance({"from": user})


@pytest.mark.parametrize("buy", [False, True])
def test_rebalance_min_tick_move_check(
    vault, pool, tokens, router, gov, user, buy
):
    # Rebalance
    vault.rebalance({"from": user})

    # Set min tick move
    vault.setMinTickMove(100, {"from": gov})

    # Can't rebalance
    with reverts("cannot rebalance"):
        vault.rebalance({"from": user})

    router.swap(pool, buy, 1e18, {"from": gov})

    # Rebalance
    vault.rebalance({"from": user})


@pytest.mark.parametrize("buy", [False, True])
def test_rebalance_twap_check(
    vault, pool, tokens, router, gov, user, buy
):
    # Set max deviation
    vault.setMaxTwapDeviation(500, {"from": gov})

    # Mint some liquidity
    vault.deposit(1e8, 1e10, 0, 0, user, {"from": user})

    # Do a swap to move the price a lot
    qty = 1e16 * 100 * [100, 1][buy]
    router.swap(pool, buy, qty, {"from": gov})

    # Can't rebalance
    with reverts("cannot rebalance"):
        vault.rebalance({"from": user})

    # Wait for twap period to pass and poke price
    chain.sleep(610)
    router.swap(pool, buy, 1e8, {"from": gov})

    # Rebalance
    vault.rebalance({"from": user})


def test_can_rebalance_when_vault_empty(
    vault, pool, tokens, gov, user
):
    assert tokens[0].balanceOf(vault) == 0
    assert tokens[1].balanceOf(vault) == 0
    tx = vault.rebalance({"from": user})

    # Check ranges are set correctly
    tick = pool.slot0()[1]
    tickFloor = tick // 60 * 60
    assert vault.baseLower() == tickFloor - 2400
    assert vault.baseUpper() == tickFloor + 60 + 2400
    assert vault.limitLower() == tickFloor + 60
    assert vault.limitUpper() == tickFloor + 60 + 1200

    assert vault.lastTimestamp() == tx.timestamp
    assert vault.lastTick() == tick
