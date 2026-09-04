// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSD (tUSD)
 * @notice Plain 6-decimal test ERC-20 for Sepolia. Anyone can take 1,000 tUSD
 * from the faucet once per hour; authorised minters (the yield mock) can mint.
 * Judges wrap tUSD into the confidential cUSD before depositing.
 */
contract MockUSD is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 1_000 * 1e6;
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address => uint256) public lastFaucetAt;
    mapping(address => bool) public isMinter;

    event FaucetClaimed(address indexed to, uint256 amount);
    event MinterSet(address indexed minter, bool allowed);

    error FaucetCooldown(uint256 availableAt);
    error NotMinter(address caller);

    constructor() ERC20("Test USD", "tUSD") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        uint256 availableAt = lastFaucetAt[msg.sender] + FAUCET_COOLDOWN;
        if (block.timestamp < availableAt) revert FaucetCooldown(availableAt);
        lastFaucetAt[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    function faucetCooldownRemaining(address account) external view returns (uint256) {
        uint256 availableAt = lastFaucetAt[account] + FAUCET_COOLDOWN;
        return block.timestamp >= availableAt ? 0 : availableAt - block.timestamp;
    }

    function setMinter(address minter, bool allowed) external onlyOwner {
        isMinter[minter] = allowed;
        emit MinterSet(minter, allowed);
    }

    function mint(address to, uint256 amount) external {
        if (!isMinter[msg.sender]) revert NotMinter(msg.sender);
        _mint(to, amount);
    }
}
