// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title IYieldSource
 * @notice Yield adapter consumed by ConfidentialPrizePool. A production adapter
 * would route the pool's principal into an ERC-4626 (or confidential) vault and
 * return realised yield in the pool's ERC-7984 asset. The pool never learns the
 * yield in cleartext: `harvest` returns an encrypted amount that has already
 * been transferred to the pool and that the pool is allowed to use.
 */
interface IYieldSource {
    /**
     * @dev Realise yield on `principal` (encrypted) for `elapsed` seconds.
     * MUST transfer the yielded tokens to `msg.sender` (the pool) and MUST
     * grant `msg.sender` (at least transient) ACL access to the returned handle.
     */
    function harvest(euint64 principal, uint256 elapsed) external returns (euint64 yielded);
}
