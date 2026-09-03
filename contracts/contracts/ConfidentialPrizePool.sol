// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, euint128, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IYieldSource} from "./interfaces/IYieldSource.sol";

/**
 * @title ConfidentialPrizePool
 * @notice A confidential, no-loss prize savings pool (PoolTogether-style) built
 * on the Zama Protocol.
 *
 *  - Users deposit an ERC-7984 confidential token. Deposits, balances, and
 *    winnings are encrypted end-to-end; only the holder can decrypt them.
 *  - Principal is withdrawable at any time (outside the short draw window).
 *  - Yield accrues into an encrypted prize reserve and is awarded through
 *    periodic draws. The pool itself never learns any balance.
 *  - Winner selection runs entirely over encrypted balances:
 *        seed   = FHE random (coprocessor-generated, on-chain)
 *        ticket = floor(seed * totalWeight / 2^64)       (encrypted)
 *        winner = #{ i : cumulativeWeight_i <= ticket }  (encrypted index)
 *    so the probability of winning equals a depositor's share of the pool
 *    (weighted lottery), exactly like PoolTogether, but nobody — not even the
 *    contract owner — learns who won unless the winner chooses to reveal it.
 *  - The aggregate prize reserve is public (as PoolTogether's prize is); the
 *    total principal and every individual position stay encrypted.
 *  - Verifiability: the random seed, the prize amount and the participant
 *    snapshot size are made publicly decryptable at draw time and recorded per
 *    draw, so anyone can check that a draw happened, what was at stake and that
 *    the seed came from the coprocessor. Winners can optionally publish a
 *    proof-of-win by making their prize credit publicly decryptable.
 *  - Fairness: a depositor's weight for the current draw is
 *        min(balance at the start of the epoch, current balance)
 *    computed lazily and homomorphically, so late deposits cannot buy odds in
 *    the current draw and early withdrawals cannot keep them.
 *  - Draws are processed in bounded batches (`advanceDraw`) to stay under the
 *    FHE per-transaction compute (HCU) budget however large the pool grows.
 */
contract ConfidentialPrizePool is ZamaEthereumConfig, Ownable2Step, ReentrancyGuard {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum Phase {
        Open, // deposits & withdrawals accepted
        Selecting, // pass 1: computing the encrypted winner index
        Awarding // pass 2: crediting the prize to the (encrypted) winner
    }

    struct DrawRecord {
        uint64 startedAt;
        uint64 completedAt;
        uint32 participants;
        euint64 seed; // publicly decryptable after start
        euint64 prize; // publicly decryptable after start
    }

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    IERC7984 public immutable asset;
    IYieldSource public yieldSource;

    uint256 public drawPeriod; // seconds between draws
    uint256 public epoch; // current draw number (1-based once the first draw starts)
    uint256 public epochStart; // timestamp the current epoch opened
    uint256 public lastHarvestAt;

    Phase public phase;
    uint256 public drawCursor; // participant index the current pass resumes from

    // Encrypted aggregates
    euint64 private _totalDeposits;
    euint64 private _prizeReserve;

    // Encrypted draw scratch state
    euint64 private _ticket;
    euint64 private _cumulative;
    euint64 private _winnerIndex;
    euint64 private _drawPrize;

    // Per-user encrypted state
    mapping(address => euint64) private _balances;
    mapping(address => euint64) private _eligible; // balance at the start of `_lastTouchedEpoch`
    mapping(address => uint256) private _lastTouchedEpoch;
    mapping(address => euint64) private _winnings; // lifetime
    mapping(uint256 => mapping(address => euint64)) private _wonInDraw; // epoch => user => credit

    address[] private _participants;
    mapping(address => bool) public isParticipant;

    mapping(uint256 => DrawRecord) private _draws;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event Deposited(address indexed user, euint64 amount);
    event Withdrawn(address indexed user, euint64 amount);
    event PrizeDonated(address indexed from, euint64 amount);
    event YieldHarvested(uint256 elapsed, euint64 amount);
    event DrawStarted(uint256 indexed epoch, uint256 participants, euint64 seed, euint64 prize);
    event DrawAdvanced(uint256 indexed epoch, Phase phase, uint256 cursor);
    event DrawCompleted(uint256 indexed epoch);
    event WinRevealed(uint256 indexed epoch, address indexed user, euint64 credit);
    event DrawPeriodSet(uint256 drawPeriod);
    event YieldSourceSet(address yieldSource);

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error PoolNotOpen(Phase phase);
    error DrawNotInProgress();
    error DrawNotDue(uint256 dueAt);
    error NoParticipants();
    error NothingToReveal();
    error InvalidBatch();
    error InvalidPeriod();
    error NothingDeposited();

    // ------------------------------------------------------------------
    // Setup
    // ------------------------------------------------------------------

    constructor(IERC7984 asset_, IYieldSource yieldSource_, uint256 drawPeriod_) Ownable(msg.sender) {
        if (drawPeriod_ == 0) revert InvalidPeriod();
        asset = asset_;
        yieldSource = yieldSource_;
        drawPeriod = drawPeriod_;
        epochStart = block.timestamp;
        lastHarvestAt = block.timestamp;

        _totalDeposits = FHE.asEuint64(0);
        _prizeReserve = FHE.asEuint64(0);
        FHE.allowThis(_totalDeposits);
        FHE.allowThis(_prizeReserve);
        FHE.makePubliclyDecryptable(_prizeReserve);
    }

    function setDrawPeriod(uint256 drawPeriod_) external onlyOwner {
        if (drawPeriod_ == 0) revert InvalidPeriod();
        drawPeriod = drawPeriod_;
        emit DrawPeriodSet(drawPeriod_);
    }

    function setYieldSource(IYieldSource yieldSource_) external onlyOwner {
        yieldSource = yieldSource_;
        emit YieldSourceSet(address(yieldSource_));
    }

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier whenOpen() {
        if (phase != Phase.Open) revert PoolNotOpen(phase);
        _;
    }

    // ------------------------------------------------------------------
    // Deposits & withdrawals
    // ------------------------------------------------------------------

    /**
     * @notice Deposit an encrypted amount of `asset`. The caller must first
     * call `asset.setOperator(pool, until)` so the pool may pull the funds.
     * If the caller's confidential balance is insufficient the ERC-7984
     * transfer silently moves zero — the deposited handle emitted in
     * {Deposited} (and the caller's balance) reflect what actually moved.
     */
    function deposit(externalEuint64 encryptedAmount, bytes calldata inputProof) external whenOpen nonReentrant {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowTransient(requested, address(asset));
        euint64 moved = asset.confidentialTransferFrom(msg.sender, address(this), requested);

        _touchEligibility(msg.sender);
        _track(msg.sender);

        euint64 newBalance = FHE.add(_balances[msg.sender], moved);
        _balances[msg.sender] = newBalance;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);

        _totalDeposits = FHE.add(_totalDeposits, moved);
        FHE.allowThis(_totalDeposits);

        FHE.allow(moved, msg.sender);
        emit Deposited(msg.sender, moved);
    }

    /**
     * @notice Withdraw up to the caller's encrypted balance. Requests above
     * the balance withdraw nothing (never revert — a revert would leak the
     * balance). The actual amount moved is emitted encrypted in {Withdrawn}
     * and is decryptable by the caller.
     */
    function withdraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external whenOpen nonReentrant {
        euint64 balance = _balances[msg.sender];
        if (!FHE.isInitialized(balance)) revert NothingDeposited();
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);

        _touchEligibility(msg.sender);

        ebool ok = FHE.le(requested, balance);
        euint64 amount = FHE.select(ok, requested, FHE.asEuint64(0));

        euint64 newBalance = FHE.sub(balance, amount);
        _balances[msg.sender] = newBalance;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);

        _totalDeposits = FHE.sub(_totalDeposits, amount);
        FHE.allowThis(_totalDeposits);

        FHE.allowTransient(amount, address(asset));
        euint64 moved = asset.confidentialTransfer(msg.sender, amount);
        FHE.allow(moved, msg.sender);
        emit Withdrawn(msg.sender, moved);
    }

    /// @notice Sponsor the next prize with an encrypted donation (never enters the principal).
    function donatePrize(externalEuint64 encryptedAmount, bytes calldata inputProof) external nonReentrant {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowTransient(requested, address(asset));
        euint64 moved = asset.confidentialTransferFrom(msg.sender, address(this), requested);
        _prizeReserve = FHE.add(_prizeReserve, moved);
        FHE.allowThis(_prizeReserve);
        FHE.makePubliclyDecryptable(_prizeReserve);
        FHE.allow(moved, msg.sender);
        emit PrizeDonated(msg.sender, moved);
    }

    // ------------------------------------------------------------------
    // Yield
    // ------------------------------------------------------------------

    /// @notice Realise yield since the last harvest into the encrypted prize reserve. Anyone may call.
    function harvest() public {
        uint256 elapsed = block.timestamp - lastHarvestAt;
        if (elapsed == 0 || address(yieldSource) == address(0)) return;
        lastHarvestAt = block.timestamp;

        FHE.allowTransient(_totalDeposits, address(yieldSource));
        euint64 yielded = yieldSource.harvest(_totalDeposits, elapsed);

        _prizeReserve = FHE.add(_prizeReserve, yielded);
        FHE.allowThis(_prizeReserve);
        FHE.makePubliclyDecryptable(_prizeReserve);
        emit YieldHarvested(elapsed, yielded);
    }

    // ------------------------------------------------------------------
    // Draws
    // ------------------------------------------------------------------

    function nextDrawAt() public view returns (uint256) {
        return epochStart + drawPeriod;
    }

    function isDrawDue() public view returns (bool) {
        return phase == Phase.Open && block.timestamp >= nextDrawAt();
    }

    /**
     * @notice Open a draw once the period has elapsed. Harvests pending yield,
     * snapshots the prize, draws an on-chain FHE random seed and derives the
     * encrypted winning ticket. Anyone may call (keeper-friendly).
     */
    function startDraw() external whenOpen nonReentrant {
        if (block.timestamp < nextDrawAt()) revert DrawNotDue(nextDrawAt());
        uint256 n = _participants.length;
        if (n == 0) revert NoParticipants();

        harvest();

        epoch += 1;

        // Snapshot the prize for this draw.
        euint64 prize = _prizeReserve;
        _drawPrize = prize;
        FHE.allowThis(_drawPrize);
        FHE.makePubliclyDecryptable(prize);

        // On-chain FHE randomness from the coprocessor; published for verifiability.
        euint64 seed = FHE.randEuint64();
        FHE.allowThis(seed);
        FHE.makePubliclyDecryptable(seed);

        // ticket = floor(seed * totalWeight / 2^64) in [0, totalWeight). Computed at
        // 128 bits so the product cannot overflow. Note: totalWeight uses total
        // deposits; per-user weights below are min(eligible, balance) <= balance so
        // the sum of weights <= totalDeposits and a ticket above the weighted sum
        // simply yields "no winner" (prize rolls over) — never a wrong winner.
        euint128 wide = FHE.mul(FHE.asEuint128(seed), FHE.asEuint128(_totalDeposits));
        _ticket = FHE.asEuint64(FHE.shr(wide, 64));
        FHE.allowThis(_ticket);

        _cumulative = FHE.asEuint64(0);
        _winnerIndex = FHE.asEuint64(0);
        FHE.allowThis(_cumulative);
        FHE.allowThis(_winnerIndex);

        _draws[epoch] = DrawRecord({
            startedAt: uint64(block.timestamp),
            completedAt: 0,
            participants: uint32(n),
            seed: seed,
            prize: prize
        });

        phase = Phase.Selecting;
        drawCursor = 0;
        emit DrawStarted(epoch, n, seed, prize);
    }

    /**
     * @notice Advance the in-progress draw by up to `maxSteps` participants.
     * Call repeatedly until {isDrawComplete} — each call is bounded so it fits
     * the FHE per-tx budget regardless of pool size. Anyone may call.
     */
    function advanceDraw(uint256 maxSteps) external nonReentrant {
        if (phase == Phase.Open) revert DrawNotInProgress();
        if (maxSteps == 0) revert InvalidBatch();

        uint256 n = _participants.length;
        uint256 end = drawCursor + maxSteps;
        if (end > n) end = n;

        if (phase == Phase.Selecting) {
            euint64 cumulative = _cumulative;
            euint64 winnerIndex = _winnerIndex;
            for (uint256 i = drawCursor; i < end; i++) {
                euint64 weight = _weightOf(_participants[i]);
                cumulative = FHE.add(cumulative, weight);
                // winner = first index whose cumulative weight exceeds the ticket
                //        = count of indices whose cumulative weight <= ticket
                winnerIndex = FHE.add(winnerIndex, FHE.asEuint64(FHE.le(cumulative, _ticket)));
            }
            _cumulative = cumulative;
            _winnerIndex = winnerIndex;
            FHE.allowThis(_cumulative);
            FHE.allowThis(_winnerIndex);
            drawCursor = end;

            if (end == n) {
                phase = Phase.Awarding;
                drawCursor = 0;
            }
            emit DrawAdvanced(epoch, phase, drawCursor);
            return;
        }

        // Phase.Awarding — credit the prize to whichever index matches, encrypted.
        euint64 prize = _drawPrize;
        for (uint256 i = drawCursor; i < end; i++) {
            address user = _participants[i];
            ebool isWinner = FHE.eq(_winnerIndex, uint64(i));
            euint64 credit = FHE.select(isWinner, prize, FHE.asEuint64(0));

            euint64 newBalance = FHE.add(_balances[user], credit);
            _balances[user] = newBalance;
            FHE.allowThis(newBalance);
            FHE.allow(newBalance, user);

            euint64 lifetime = FHE.add(_winnings[user], credit);
            _winnings[user] = lifetime;
            FHE.allowThis(lifetime);
            FHE.allow(lifetime, user);

            _wonInDraw[epoch][user] = credit;
            FHE.allowThis(credit);
            FHE.allow(credit, user);
        }
        drawCursor = end;

        if (end == n) {
            // If a winner was found (index < n) the prize leaves the reserve and
            // joins the principal (it is now part of the winner's balance).
            ebool found = FHE.lt(_winnerIndex, uint64(n));
            euint64 paid = FHE.select(found, prize, FHE.asEuint64(0));
            _prizeReserve = FHE.sub(_prizeReserve, paid);
            _totalDeposits = FHE.add(_totalDeposits, paid);
            FHE.allowThis(_prizeReserve);
            FHE.allowThis(_totalDeposits);
            FHE.makePubliclyDecryptable(_prizeReserve);

            _draws[epoch].completedAt = uint64(block.timestamp);
            phase = Phase.Open;
            drawCursor = 0;
            epochStart = block.timestamp;
            emit DrawCompleted(epoch);
        } else {
            emit DrawAdvanced(epoch, phase, drawCursor);
        }
    }

    function isDrawComplete() external view returns (bool) {
        return phase == Phase.Open;
    }

    /**
     * @notice Optional proof-of-win: make the caller's prize credit for `epoch_`
     * publicly decryptable. Only the winner has a non-zero credit; anyone may
     * publish their (possibly zero) credit — a zero simply proves they did not win.
     */
    function revealWin(uint256 epoch_) external {
        euint64 credit = _wonInDraw[epoch_][msg.sender];
        if (!FHE.isInitialized(credit)) revert NothingToReveal();
        FHE.makePubliclyDecryptable(credit);
        emit WinRevealed(epoch_, msg.sender, credit);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function balanceOf(address user) external view returns (euint64) {
        return _balances[user];
    }

    function winningsOf(address user) external view returns (euint64) {
        return _winnings[user];
    }

    function wonInDraw(uint256 epoch_, address user) external view returns (euint64) {
        return _wonInDraw[epoch_][user];
    }

    /// @dev Encrypted; only the pool can decrypt (individual and aggregate deposits stay private).
    function totalDeposits() external view returns (euint64) {
        return _totalDeposits;
    }

    /**
     * @dev The aggregate prize reserve is made publicly decryptable whenever it
     * changes, so the app can show "prize up for grabs" — like PoolTogether's
     * public prize — without revealing any individual position.
     */
    function prizeReserve() external view returns (euint64) {
        return _prizeReserve;
    }

    function participantCount() external view returns (uint256) {
        return _participants.length;
    }

    function participantAt(uint256 index) external view returns (address) {
        return _participants[index];
    }

    function getDraw(uint256 epoch_) external view returns (DrawRecord memory) {
        return _draws[epoch_];
    }

    /// @notice The epoch a user's balance is currently eligible for (0 = fully eligible now).
    function lastTouchedEpoch(address user) external view returns (uint256) {
        return _lastTouchedEpoch[user];
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    /// @dev Lazily snapshot the caller's balance at the start of the current epoch.
    function _touchEligibility(address user) internal {
        uint256 current = epoch + 1; // epoch id of the *next* draw
        if (_lastTouchedEpoch[user] != current) {
            euint64 snapshot = _balances[user];
            if (!FHE.isInitialized(snapshot)) {
                snapshot = FHE.asEuint64(0);
                FHE.allowThis(snapshot);
            }
            _eligible[user] = snapshot;
            _lastTouchedEpoch[user] = current;
        }
    }

    /// @dev Weight for the in-progress draw: min(balance at epoch start, current balance).
    function _weightOf(address user) internal returns (euint64) {
        euint64 balance = _balances[user];
        if (!FHE.isInitialized(balance)) return FHE.asEuint64(0);
        if (_lastTouchedEpoch[user] == epoch) {
            // User moved funds during this epoch: only the part held all epoch counts.
            return FHE.min(_eligible[user], balance);
        }
        return balance;
    }

    function _track(address user) internal {
        if (!isParticipant[user]) {
            isParticipant[user] = true;
            _participants.push(user);
        }
    }
}
