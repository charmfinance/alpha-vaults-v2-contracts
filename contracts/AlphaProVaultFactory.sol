// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.7.6;

import "./CloneFactory.sol";
import "./AlphaProVault.sol";


contract AlphaProVaultFactory is CloneFactory {
    address public template;
    address[] public vaults;

    address public feeCollector;
    address public pendingFeeCollector;
    uint256 public protocolFee;

    constructor(address _template, address _feeCollector, uint256 _protocolFee) {
        template = _template;
        feeCollector = _feeCollector;
        protocolFee = _protocolFee;
    }

    function createVault(
        address pool,
        address manager,
        uint256 maxTotalSupply,
        int24 baseRadius,
        int24 limitRadius,
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
     * @notice Used to change the protocol fee charged on pool fees earned from
     * Uniswap, expressed as multiple of 1e-6.
     */
    function setProtocolFee(uint256 _protocolFee) external onlyFeeCollector {
        require(_protocolFee < 1e6, "protocolFee");
        protocolFee = _protocolFee;
    }

    /**
     * @notice Governance address is not updated until the new manager
     * address has called `acceptGovernance()` to accept this responsibility.
     */
    function setFeeCollector(address _feeCollector) external onlyFeeCollector {
        pendingFeeCollector = _feeCollector;
    }

    /**
     * @notice `setFeeCollector()` should be called by the existing fee recipient
     * address prior to calling this function.
     */
    function acceptFeeCollector() external {
        require(msg.sender == pendingFeeCollector, "pendingFeeCollector");
        feeCollector = msg.sender;
    }

    modifier onlyFeeCollector {
        require(msg.sender == feeCollector, "feeCollector");
        _;
    }
}
