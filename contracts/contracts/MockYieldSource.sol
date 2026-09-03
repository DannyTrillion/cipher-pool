// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IYieldSource} from "./interfaces/IYieldSource.sol";
import {ConfidentialUSD} from "./ConfidentialUSD.sol";

/**
 * @title MockYieldSource
 * @notice Simulates a yield-bearing strategy for the testnet demo. Yield is
 * computed homomorphically over the pool's ENCRYPTED principal:
 *
 *     yield = principal * apyBps * elapsed / (10_000 * 365 days)
 *
 * and minted straight to the pool in cUSD. The APY is public (as it would be
 * for any real strategy); the principal and the resulting yield never are.
 *
 * Swap this for an adapter over a real vault to go to production — the pool
 * only depends on IYieldSource.
 */
contract MockYieldSource is IYieldSource, ZamaEthereumConfig, Ownable {
    ConfidentialUSD public immutable token;
    address public pool;
    uint256 public apyBps; // e.g. 500 = 5% APY

    uint256 private constant YEAR = 365 days;
    uint256 private constant BPS = 10_000;

    event ApySet(uint256 apyBps);
    event PoolSet(address pool);
    event Harvested(address indexed pool, uint256 elapsed);

    error OnlyPool(address caller);

    constructor(ConfidentialUSD token_, uint256 apyBps_) Ownable(msg.sender) {
        token = token_;
        apyBps = apyBps_;
    }

    function setPool(address pool_) external onlyOwner {
        pool = pool_;
        emit PoolSet(pool_);
    }

    function setApy(uint256 apyBps_) external onlyOwner {
        require(apyBps_ <= 100_000, "apy too high"); // cap 1000% for the demo
        apyBps = apyBps_;
        emit ApySet(apyBps_);
    }

    /// @inheritdoc IYieldSource
    function harvest(euint64 principal, uint256 elapsed) external returns (euint64 yielded) {
        if (msg.sender != pool) revert OnlyPool(msg.sender);
        // The pool granted us (transient) access to its encrypted principal.
        // Widen to 128 bits so principal * apyBps * elapsed cannot overflow.
        uint256 numerator = apyBps * elapsed; // fits comfortably in uint128
        euint128 wide = FHE.mul(FHE.asEuint128(principal), uint128(numerator));
        wide = FHE.div(wide, uint128(BPS * YEAR));
        yielded = FHE.asEuint64(wide);

        FHE.allowTransient(yielded, address(token));
        yielded = token.mint(msg.sender, yielded);
        // token.mint already granted msg.sender (the pool) transient access to
        // the returned handle via allowTransient in ConfidentialUSD.mint, but
        // that grant was made to *us* (its msg.sender). Re-grant to the pool.
        FHE.allowTransient(yielded, msg.sender);
        emit Harvested(msg.sender, elapsed);
    }
}
