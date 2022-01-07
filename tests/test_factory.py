from brownie import reverts, ZERO_ADDRESS


def test_create_vault(AlphaProVault, AlphaProVaultFactory, pool, gov):
    template = gov.deploy(AlphaProVault)
    factory = gov.deploy(AlphaProVaultFactory, template, gov, 10000)
    assert factory.template() == template
    assert factory.governance() == gov
    assert factory.protocolFee() == 10000
    
    tx = factory.createVault(
        pool,
        gov,
        100e18,
        2000,
        1000,
        300000,
        86400,
        100,
        200,
        60
    )
    vault = AlphaProVault.at(tx.return_value)
    assert vault.pool() == pool
    assert vault.manager() == gov
    assert vault.token0() == pool.token0()
    assert vault.token1() == pool.token1()
    assert vault.protocolFee() == 10000
    assert vault.maxTotalSupply() == 100e18
    assert vault.baseRadius() == 2000
    assert vault.limitRadius() == 1000
    assert vault.fullRangeWeight() == 300000
    assert vault.period() == 86400
    assert vault.minTickMove() == 100
    assert vault.maxTwapDeviation() == 200
    assert vault.twapDuration() == 60

    assert vault.name() == "Alpha Vault"
    assert vault.symbol() == "AV"
    assert vault.decimals() == 18

    assert vault.getTotalAmounts() == (0, 0)

