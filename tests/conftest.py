from brownie import chain
from math import sqrt
import pytest
from web3 import Web3


UNISWAP_V3_CORE = "Uniswap/uniswap-v3-core@1.0.0"


@pytest.fixture(scope="module")
def gov(accounts):
    yield accounts[0]


@pytest.fixture(scope="module")
def user(accounts):
    yield accounts[1]


@pytest.fixture(scope="module")
def recipient(accounts):
    yield accounts[2]


@pytest.fixture(scope="module")
def users(gov, user, recipient):
    yield [gov, user, recipient]


@pytest.fixture(scope="module")
def router(TestRouter, gov):
    yield gov.deploy(TestRouter)


@pytest.fixture
def pool(MockToken, router, pm, gov, users):
    UniswapV3Core = pm(UNISWAP_V3_CORE)

    tokenA = gov.deploy(MockToken)
    tokenB = gov.deploy(MockToken)
    tokenA.initialize("name A", "symbol A", 18)
    tokenB.initialize("name B", "symbol B", 18)
    fee = 3000

    factory = gov.deploy(UniswapV3Core.UniswapV3Factory)
    tx = factory.createPool(tokenA, tokenB, fee, {"from": gov})
    pool = UniswapV3Core.interface.IUniswapV3Pool(tx.return_value)
    token0 = MockToken.at(pool.token0())
    token1 = MockToken.at(pool.token1())

    # initialize price to 100
    price = int(sqrt(100) * (1 << 96))
    pool.initialize(price, {"from": gov})

    for u in users:
        token0.mint(u, 100e18, {"from": gov})
        token1.mint(u, 10000e18, {"from": gov})
        token0.approve(router, 100e18, {"from": u})
        token1.approve(router, 10000e18, {"from": u})

    # Add some liquidity over whole range
    max_tick = 887272 // 60 * 60
    router.mint(pool, -max_tick, max_tick, 1e16, {"from": gov})

    # Increase cardinality and fast forward so TWAP works
    pool.increaseObservationCardinalityNext(100, {"from": gov})
    chain.sleep(3600)
    yield pool


@pytest.fixture
def tokens(MockToken, pool):
    return MockToken.at(pool.token0()), MockToken.at(pool.token1())


@pytest.fixture
def factory(AlphaProVaultFactory, AlphaProVault, gov):
    template = gov.deploy(AlphaProVault)

    # protocolFee = 10000 (1%)
    yield gov.deploy(AlphaProVaultFactory, template, gov, 10000)


@pytest.fixture
def vault(AlphaProVault, factory, pool, router, tokens, gov, users):
    # maxTotalSupply = 100e18 (100 tokens)
    # baseThreshold = 2400
    # limitThreshold = 1200
    # fullWeight = 500000 (50%)
    # period = 0
    # minTickMove = 0
    # maxTwapDeviation = 200000 (just a big number)
    # twapDuration = 600 (10 minutes)
    tx = factory.createVault(
        pool,
        gov,
        100e18,
        2400,
        1200,
        500000,
        0,
        0,
        200000,
        600
    )
    vault = AlphaProVault.at(tx.return_value)

    for u in users:
        tokens[0].approve(vault, 100e18, {"from": u})
        tokens[1].approve(vault, 10000e18, {"from": u})

    yield vault


@pytest.fixture
def vaultAfterPriceMove(vault, pool, router, gov):

    # Deposit and move price to simulate existing activity
    vault.deposit(1e16, 1e18, 0, 0, gov, {"from": gov})
    prevTick = pool.slot0()[1] // 60 * 60
    router.swap(pool, True, 1e16, {"from": gov})

    # Check price did indeed move
    tick = pool.slot0()[1] // 60 * 60
    assert tick != prevTick

    # Rebalance vault
    vault.rebalance({"from": gov})

    # Check vault holds both tokens
    total0, total1 = vault.getTotalAmounts()
    assert total0 > 0 and total1 > 0

    yield vault


# returns method to set up a pool, factory and vault. can be used in
# hypothesis tests where function-scoped fixtures are not allowed
@pytest.fixture(scope="module")
def createPoolVaultStrategy(
    pm, AlphaProVaultFactory, AlphaProVault, MockToken, router, gov, users
):
    UniswapV3Core = pm(UNISWAP_V3_CORE)

    def f():
        tokenA = gov.deploy(MockToken)
        tokenB = gov.deploy(MockToken)
        tokenA.initialize("name A", "symbol A", 18)
        tokenB.initialize("name B", "symbol B", 18)
        fee = 3000

        for u in users:
            tokenA.mint(u, 100e18, {"from": gov})
            tokenB.mint(u, 10000e18, {"from": gov})
            tokenA.approve(router, 100e18, {"from": u})
            tokenB.approve(router, 10000e18, {"from": u})

        factory = gov.deploy(UniswapV3Core.UniswapV3Factory)
        tx = factory.createPool(tokenA, tokenB, fee, {"from": gov})
        pool = UniswapV3Core.interface.IUniswapV3Pool(tx.return_value)

        initialPrice = int(sqrt(100) * (1 << 96))
        pool.initialize(initialPrice, {"from": gov})

        # Increase cardinality and fast forward so TWAP works
        pool.increaseObservationCardinalityNext(100, {"from": gov})
        chain.sleep(3600)

        template = gov.deploy(AlphaProVault)

        # protocolFee = 10000 (1%)
        factory = gov.deploy(AlphaProVaultFactory, template, gov, 10000)

        # maxTotalSupply = 100e18 (100 tokens)
        # baseThreshold = 2400
        # limitThreshold = 1200
        # fullWeight = 500000 (50%)
        # period = 0
        # minTickMove = 0
        # maxTwapDeviation = 200000 (just a big number)
        # twapDuration = 600 (10 minutes)
        tx = factory.createVault(
            pool,
            gov,
            100e18,
            2400,
            1200,
            500000,
            0,
            0,
            200000,
            600
        )
        vault = AlphaProVault.at(tx.return_value)
        for u in users:
            tokenA.approve(vault, 100e18, {"from": u})
            tokenB.approve(vault, 10000e18, {"from": u})

        return pool, factory, vault

    yield f


@pytest.fixture
def getPositions(pool):
    def f(vault):
        baseKey = computePositionKey(vault, vault.baseLower(), vault.baseUpper())
        limitKey = computePositionKey(vault, vault.limitLower(), vault.limitUpper())
        return pool.positions(baseKey), pool.positions(limitKey)

    yield f


@pytest.fixture
def debug(pool, tokens):
    def f(vault):
        baseKey = computePositionKey(vault, vault.baseLower(), vault.baseUpper())
        limitKey = computePositionKey(vault, vault.limitLower(), vault.limitUpper())
        print(f"Passive position:    {pool.positions(baseKey)}")
        print(f"Rebalance position:  {pool.positions(limitKey)}")
        print(f"Spare balance 0:  {tokens[0].balanceOf(vault)}")
        print(f"Spare balance 1:  {tokens[1].balanceOf(vault)}")

    yield f


def computePositionKey(owner, tickLower, tickUpper):
    return Web3.solidityKeccak(
        ["address", "int24", "int24"], [str(owner), tickLower, tickUpper]
    )
