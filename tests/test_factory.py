from brownie import reverts, ZERO_ADDRESS


def test_create_vault(AlphaProVault, AlphaProVaultFactory, pool, gov):
    template = gov.deploy(AlphaProVault)
    factory = gov.deploy(AlphaProVaultFactory, template, gov, 10000)
    assert factory.template() == template
    assert factory.governance() == gov
    assert factory.protocolFee() == 10000
    assert factory.numVaults() == 0

    tx = factory.createVault(pool, gov, 100e18, 2400, 1200, 300000, 86400, 100, 200, 60, "N", "S")
    vault = AlphaProVault.at(tx.return_value)
    assert vault.pool() == pool
    assert vault.manager() == gov
    assert vault.token0() == pool.token0()
    assert vault.token1() == pool.token1()
    assert vault.protocolFee() == 10000
    assert vault.maxTotalSupply() == 100e18
    assert vault.baseThreshold() == 2400
    assert vault.limitThreshold() == 1200
    assert vault.fullRangeWeight() == 300000
    assert vault.period() == 86400
    assert vault.minTickMove() == 100
    assert vault.maxTwapDeviation() == 200
    assert vault.twapDuration() == 60

    assert vault.name() == "N"
    assert vault.symbol() == "S"
    assert vault.decimals() == 18

    assert vault.getTotalAmounts() == (0, 0)

    assert vault.fullLower() == -887220
    assert vault.fullUpper() == 887220
    assert vault.lastTick() == 46054

    assert factory.numVaults() == 1
    assert factory.vaults(0) == vault
    assert factory.isVault(vault)


def test_constructor_checks(AlphaProVault, AlphaProVaultFactory, pool, gov):
    template = gov.deploy(AlphaProVault)

    with reverts("protocolFee must be <= 200000"):
        gov.deploy(AlphaProVaultFactory, template, gov, 200001)

    factory = gov.deploy(AlphaProVaultFactory, template, gov, 10000)

    with reverts("threshold must be > 0"):
        factory.createVault(pool, gov, 100e18, 0, 1200, 300000, 86400, 100, 200, 60, "N", "S")

    with reverts("threshold must be > 0"):
        factory.createVault(pool, gov, 100e18, 2400, 0, 300000, 86400, 100, 200, 60, "N", "S")

    with reverts("fullRangeWeight must be <= 1e6"):
        factory.createVault(pool, gov, 100e18, 2400, 1200, 1000001, 86400, 100, 200, 60, "N", "S")

    with reverts("minTickMove must be >= 0"):
        factory.createVault(pool, gov, 100e18, 2400, 1200, 300000, 86400, -100, 200, 60, "N", "S")

    with reverts("maxTwapDeviation must be >= 0"):
        factory.createVault(pool, gov, 100e18, 2400, 1200, 300000, 86400, 100, -1, 60, "N", "S")

    with reverts("twapDuration must be > 0"):
        factory.createVault(pool, gov, 100e18, 2400, 1200, 300000, 86400, 100, 200, 0, "N", "S")

