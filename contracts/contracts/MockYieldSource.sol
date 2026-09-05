// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IYieldSource} from "./interfaces/IYieldSource.sol";

/// @dev Zama's Sepolia USDTMock (and our local MockUSD) expose a public mint.
interface IMintableERC20 is IERC20 {
    function mint(address to, uint256 amount) external;
}

/// @dev The wrap entry point of Zama's cUSDTMock (OpenZeppelin ERC7984ERC20Wrapper).
interface IERC7984Wrapper {
    function wrap(address to, uint256 amount) external returns (euint64);
}

/**
 * @title MockYieldSource
 * @notice Testnet stand-in for a yield strategy: an admin-funded prize drip.
 *
 * Because the pool's principal is encrypted, a mock cannot compute "APY × TVL"
 * in plaintext without leaking TVL. Instead it drips a public, fixed amount of
 * the underlying test token per second (`ratePerSecond`), mints it from the
 * official Zama USDT mock (public mint), wraps it into the official cUSDT mock
 * and hands the encrypted wrapped amount to the pool's prize reserve. The rate
 * is public; the reserve stays an encrypted (but publicly decryptable) aggregate.
 *
 * Production: replace this with an adapter that harvests real yield from an
 * ERC-4626 vault into the wrapper and calls the same `harvest` interface.
 */
contract MockYieldSource is IYieldSource, ZamaEthereumConfig, Ownable {
    IMintableERC20 public immutable underlying;
    IERC7984Wrapper public immutable wrapper;
    address public pool;
    uint256 public ratePerSecond; // underlying base units (6 decimals) per second

    event RateSet(uint256 ratePerSecond);
    event PoolSet(address pool);
    event Harvested(address indexed pool, uint256 elapsed, uint256 amount);

    error OnlyPool(address caller);

    constructor(IMintableERC20 underlying_, IERC7984Wrapper wrapper_, uint256 ratePerSecond_) Ownable(msg.sender) {
        underlying = underlying_;
        wrapper = wrapper_;
        ratePerSecond = ratePerSecond_;
    }

    function setPool(address pool_) external onlyOwner {
        pool = pool_;
        emit PoolSet(pool_);
    }

    function setRate(uint256 ratePerSecond_) external onlyOwner {
        ratePerSecond = ratePerSecond_;
        emit RateSet(ratePerSecond_);
    }

    /// @inheritdoc IYieldSource
    function harvest(euint64 /* principal — unused by the drip mock */, uint256 elapsed) external returns (euint64 yielded) {
        if (msg.sender != pool) revert OnlyPool(msg.sender);
        uint256 amount = ratePerSecond * elapsed;
        if (amount > type(uint64).max) amount = type(uint64).max;
        if (amount == 0) {
            yielded = FHE.asEuint64(0);
            FHE.allowTransient(yielded, msg.sender);
            return yielded;
        }
        underlying.mint(address(this), amount);
        underlying.approve(address(wrapper), amount);
        yielded = wrapper.wrap(msg.sender, amount); // encrypted amount minted to the pool
        FHE.allowTransient(yielded, msg.sender);
        emit Harvested(msg.sender, elapsed, amount);
    }
}
