// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestToken — a faucet-mintable ERC-20 for Sepolia.
 * @notice Real on-chain tokens (not mock data): used to seed a genuine Uniswap
 *         v3 pool on Ethereum Sepolia so the dApp swaps against live liquidity.
 */
contract TestToken is ERC20, Ownable {
    uint8 private immutable _dec;

    constructor(string memory name, string memory symbol, uint8 decimals_)
        ERC20(name, symbol)
        Ownable(msg.sender)
    {
        _dec = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    /// @notice Open faucet so demo traders and the pool can be funded on testnet.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
