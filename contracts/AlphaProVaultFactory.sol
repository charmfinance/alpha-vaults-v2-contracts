// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.7.6;

import "./CloneFactory.sol";
import "./AlphaProVault.sol";


/**
 * @title   Alpha Pro Vault Factory
 * @notice  A factory contract for creating new vaults
 */
contract AlphaProVaultFactory is CloneFactory {
    address public template;
    address[] public vaults;

    address public governance;
    address public pendingGovernance;
    uint256 public protocolFee;

    /**
     * @param _template A deployed AlphaProVault contract
     * @param _governance Charm Finance governance address
     * @param _protocolFee Fee multiplied by 1e6
     */
    constructor(address _template, address _governance, uint256 _protocolFee) {
        template = _template;
        governance = _governance;
        protocolFee = _protocolFee;
    }

    /**
     * @notice Create a new Alpha Pro Vault
     * @param pool Underlying Uniswap V3 pool address
     * @param manager Address of manager who can set parameters
     * @param maxTotalSupply Cap on total supply
     * @param baseRadius Half of the base order width in ticks
     * @param limitRadius Half of the limit order width in ticks
     * @param fullRangeWeight Proportion of liquidity in full range multiplied by 1e6
     * @param period Can only rebalance if this length of time has passed
     * @param minTickMove Can only rebalance if price has moved at least this much
     * @param maxTwapDeviation Max deviation from TWAP during rebalance
     * @param twapDuration TWAP duration in seconds for deviation check
     */
    function createVault(
        address pool,
        address manager,
        uint256 maxTotalSupply,
        int24 baseRadius,
        int24 limitRadius,
        uint256 fullRangeWeight,
        uint256 period,
        int24 minTickMove,
        int24 maxTwapDeviation,
        uint32 twapDuration
    ) external returns (address vaultAddress) {
        vaultAddress = createClone(template);
        AlphaProVault(vaultAddress).initialize(
            pool,
            manager,
            maxTotalSupply,
            baseRadius,
            limitRadius,
            fullRangeWeight,
            period,
            minTickMove,
            maxTwapDeviation,
            twapDuration,
            address(this)
        );
    }

    function numVaults() external view returns (uint256) {
        return vaults.length;
    }

    /**
     * @notice Change the protocol fee charged on pool fees earned from
     * Uniswap, expressed as multiple of 1e-6.
     */
    function setProtocolFee(uint256 _protocolFee) external onlyGovernance {
        require(_protocolFee < 1e6, "protocolFee");
        protocolFee = _protocolFee;
    }

    /**
     * @notice Governance address is not updated until the new governance
     * address has called `acceptGovernance()` to accept this responsibility.
     */
    function setGovernance(address _governance) external onlyGovernance {
        pendingGovernance = _governance;
    }

    /**
     * @notice `setGovernance()` should be called by the existing fee recipient
     * address prior to calling this function.
     */
    function acceptGovernance() external {
        require(msg.sender == pendingGovernance, "pendingGovernance");
        governance = msg.sender;
    }

    modifier onlyGovernance {
        require(msg.sender == governance, "governance");
        _;
    }
}
