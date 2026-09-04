// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IYieldSource} from "./interfaces/IYieldSource.sol";
import {MockUSD} from "./MockUSD.sol";
import {ConfidentialUSD} from "./ConfidentialUSD.sol";

/**
 * @title MockYieldSource
 * @notice Testnet stand-in for a yield strategy: an admin-funded prize drip.
 *
 * Because the pool's principal is encrypted, a mock cannot compute "APY × TVL"
 * in plaintext without leaking TVL. Instead it drips a public, fixed amount of
 * tUSD per second (`ratePerSecond`), mints it, wraps it into cUSD and hands the
 * encrypted wrapped amount to the pool's prize reserve. The rate is public; the
 * reserve stays an encrypted (but publicly decryptable) aggregate.
 *
 * Production: replace this with an adapter that harvests real yield from an
 * ERC-4626 vault into the wrapper and calls the same `harvest` interface.
 */
contract MockYieldSource is IYieldSource, ZamaEthereumConfig, Ownable {
    MockUSD public immutable underlying;
    ConfidentialUSD public immutable wrapper;
    address public pool;
    uint256 public ratePerSecond; // tUSD base units (6 decimals) per second

    event RateSet(uint256 ratePerSecond);
    event PoolSet(address pool);
    event Harvested(address indexed pool, uint256 elapsed, uint256 amount);

    error OnlyPool(address caller);

    constructor(MockUSD underlying_, ConfidentialUSD wrapper_, uint256 ratePerSecond_) Ownable(msg.sender) {
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
        yielded = wrapper.wrap(msg.sender, amount); // encrypted amount minted to the pool; we may use the handle
        FHE.allowTransient(yielded, msg.sender);
        emit Harvested(msg.sender, elapsed, amount);
    }
}
