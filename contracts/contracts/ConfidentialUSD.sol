// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";

/**
 * @title ConfidentialUSD (cUSD)
 * @notice ERC-7984 confidential wrapper over the tUSD test ERC-20 (OpenZeppelin
 * ERC7984ERC20Wrapper). Flow: `tUSD.approve(cUSD, amount)` → `cUSD.wrap(to, amount)`
 * mints an encrypted balance 1:1; `unwrap` + `finalizeUnwrap` return tUSD.
 *
 * The pool only depends on IERC7984, so on mainnet it can point at any
 * registry-listed confidential token (e.g. cUSDT) instead.
 */
contract ConfidentialUSD is ERC7984ERC20Wrapper, ZamaEthereumConfig {
    constructor(IERC20 underlying_) ERC7984("Confidential USD", "cUSD", "") ERC7984ERC20Wrapper(underlying_) {}
}
