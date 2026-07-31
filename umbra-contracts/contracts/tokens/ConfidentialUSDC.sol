// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20ToERC7984Wrapper} from "@iexec-nox/nox-confidential-contracts/contracts/token/extensions/ERC20ToERC7984Wrapper.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

/// @title cUSDC — confidential wrapper over a public USDC ERC-20.
contract ConfidentialUSDC is ERC20ToERC7984Wrapper {
    constructor(IERC20 usdc)
        ERC20ToERC7984Wrapper("Confidential USDC", "cUSDC", "https://umbra.trade/cusdc", usdc)
    {}
}
