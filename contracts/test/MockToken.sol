// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20Upgradeable.sol";

contract MockToken is ERC20Upgradeable {
    function initialize(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) public initializer {
        __ERC20_init(name, symbol);
        _setupDecimals(decimals);
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
