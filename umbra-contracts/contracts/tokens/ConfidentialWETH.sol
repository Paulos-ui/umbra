// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20ToERC7984Wrapper} from "@iexec-nox/nox-confidential-contracts/contracts/token/extensions/ERC20ToERC7984Wrapper.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

/// @title cWETH — confidential wrapper over a public WETH ERC-20.
contract ConfidentialWETH is ERC20ToERC7984Wrapper {
    constructor(IERC20 weth)
        ERC20ToERC7984Wrapper("Confidential WETH", "cWETH", "https://umbra.trade/cweth", weth)
    {}
}
