// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ConfidentialUSD (cUSD)
 * @notice Testnet ERC-7984 confidential stablecoin used as the prize pool's
 * deposit asset. Anyone can mint from the faucet (rate-limited per address);
 * an authorised minter (the yield source) can mint encrypted amounts.
 *
 * On mainnet the pool would be pointed at a registry-listed confidential token
 * (e.g. cUSDT) instead — the pool only depends on the IERC7984 interface.
 */
contract ConfidentialUSD is ERC7984, ZamaEthereumConfig, Ownable {
    uint64 public constant FAUCET_AMOUNT = 1_000 * 1e6; // 1,000 cUSD (6 decimals)
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address => uint256) public lastFaucetAt;
    mapping(address => bool) public isMinter;

    event FaucetClaimed(address indexed to, uint64 amount);
    event MinterSet(address indexed minter, bool allowed);

    error FaucetCooldown(uint256 availableAt);
    error NotMinter(address caller);

    constructor() ERC7984("Confidential USD", "cUSD", "") Ownable(msg.sender) {}

    /// @notice Mint a fixed testnet allowance to the caller, once per cooldown.
    function faucet() external {
        uint256 availableAt = lastFaucetAt[msg.sender] + FAUCET_COOLDOWN;
        if (block.timestamp < availableAt) revert FaucetCooldown(availableAt);
        lastFaucetAt[msg.sender] = block.timestamp;
        _mint(msg.sender, FHE.asEuint64(FAUCET_AMOUNT));
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Seconds until `account` may claim the faucet again (0 = now).
    function faucetCooldownRemaining(address account) external view returns (uint256) {
        uint256 availableAt = lastFaucetAt[account] + FAUCET_COOLDOWN;
        return block.timestamp >= availableAt ? 0 : availableAt - block.timestamp;
    }

    function setMinter(address minter, bool allowed) external onlyOwner {
        isMinter[minter] = allowed;
        emit MinterSet(minter, allowed);
    }

    /**
     * @notice Mint an encrypted amount. The caller must be an authorised minter
     * and must have granted this contract ACL access to `amount`.
     */
    function mint(address to, euint64 amount) external returns (euint64 transferred) {
        if (!isMinter[msg.sender]) revert NotMinter(msg.sender);
        transferred = _mint(to, amount);
        FHE.allowTransient(transferred, msg.sender);
    }
}
