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
 *  - Prizes are tiered like PoolTogether: each draw pays several winner slots
 *    (e.g. 1 grand prize at 40%, 2 at 20%, 2 at 10%). Every slot gets its own
 *    coprocessor random seed, and selection runs entirely over encrypted balances:
 *        seed_k   = FHE random (coprocessor-generated, on-chain)
 *        ticket_k = floor(seed_k * totalWeight / 2^64)       (encrypted)
 *        winner_k = #{ i : cumulativeWeight_i <= ticket_k }  (encrypted index)
 *    so the probability of taking a slot equals a depositor's share of the pool
 *    (weighted lottery, with replacement), but nobody — not even the contract
 *    owner — learns who won unless the winner chooses to reveal it.
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

    struct Tier {
        uint16 shareBps; // share of the draw prize allocated to this tier
        uint8 winners; // number of winner slots in this tier
    }

    struct DrawRecord {
        uint64 startedAt;
        uint64 completedAt;
        uint32 participants;
        uint8 winnerSlots;
        euint64 prize; // publicly decryptable after start
        Tier[] tiers; // snapshot of the tier structure used
    }

    uint256 public constant MAX_WINNERS = 8;
    uint256 public constant MAX_TIERS = 4;

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

    // Prize tiers (owner-configurable between draws)
    Tier[] private _tiers;

    // Encrypted draw scratch state (one entry per winner slot)
    uint256 private _activeSlots;
    euint64[MAX_WINNERS] private _slotTicket;
    euint64[MAX_WINNERS] private _slotWinner;
    euint64[MAX_WINNERS] private _slotAmount;
    euint64 private _cumulative;
    euint64 private _drawPrize;
    mapping(uint256 => euint64[]) private _drawSeeds; // epoch => per-slot seeds (public)

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
    event DrawStarted(uint256 indexed epoch, uint256 participants, uint256 winnerSlots, euint64 prize);
    event TiersSet(uint16[] shareBps, uint8[] winners);
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
    error InvalidTiers();

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

        // Default structure: 1 grand prize (40%), 2 × 20%, 2 × 10% — five winners per draw.
        _tiers.push(Tier({shareBps: 4000, winners: 1}));
        _tiers.push(Tier({shareBps: 4000, winners: 2}));
        _tiers.push(Tier({shareBps: 2000, winners: 2}));
    }

    /**
     * @notice Configure the prize tiers used from the next draw on. `shareBps`
     * is the share of the draw prize for the whole tier, split equally among
     * its `winners`. Shares must sum to at most 10,000 (dust stays in reserve).
     */
    function setTiers(uint16[] calldata shareBps, uint8[] calldata winners) external onlyOwner whenOpen {
        if (shareBps.length == 0 || shareBps.length != winners.length || shareBps.length > MAX_TIERS) revert InvalidTiers();
        uint256 totalBps;
        uint256 totalWinners;
        for (uint256 i = 0; i < shareBps.length; i++) {
            if (shareBps[i] == 0 || winners[i] == 0) revert InvalidTiers();
            totalBps += shareBps[i];
            totalWinners += winners[i];
        }
        if (totalBps > 10_000 || totalWinners > MAX_WINNERS) revert InvalidTiers();
        delete _tiers;
        for (uint256 i = 0; i < shareBps.length; i++) {
            _tiers.push(Tier({shareBps: shareBps[i], winners: winners[i]}));
        }
        emit TiersSet(shareBps, winners);
    }

    function getTiers() external view returns (Tier[] memory) {
        return _tiers;
    }

    function winnerSlots() public view returns (uint256 n) {
        for (uint256 i = 0; i < _tiers.length; i++) n += _tiers[i].winners;
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

        // Per-slot prize amounts and tickets. Each slot draws its own on-chain FHE
        // seed (published for verifiability). ticket = floor(seed * totalWeight / 2^64)
        // in [0, totalWeight), computed at 128 bits so the product cannot overflow.
        // Per-user weights are min(eligible, balance) <= balance, so the sum of weights
        // is <= totalDeposits; a ticket beyond the weighted sum simply yields "no
        // winner" for that slot (its amount rolls over) — never a wrong winner.
        euint128 total128 = FHE.asEuint128(_totalDeposits);
        euint128 prize128 = FHE.asEuint128(prize);
        euint64[] storage seeds = _drawSeeds[epoch];
        uint256 slot;
        for (uint256 t = 0; t < _tiers.length; t++) {
            Tier memory tier = _tiers[t];
            euint64 perWinner = FHE.asEuint64(
                FHE.div(FHE.mul(prize128, uint128(tier.shareBps)), uint128(10_000 * uint256(tier.winners)))
            );
            FHE.allowThis(perWinner);
            for (uint256 w = 0; w < tier.winners; w++) {
                euint64 seed = FHE.randEuint64();
                FHE.allowThis(seed);
                FHE.makePubliclyDecryptable(seed);
                seeds.push(seed);

                euint64 ticket = FHE.asEuint64(FHE.shr(FHE.mul(FHE.asEuint128(seed), total128), 64));
                FHE.allowThis(ticket);
                _slotTicket[slot] = ticket;
                _slotAmount[slot] = perWinner;
                euint64 zeroIdx = FHE.asEuint64(0);
                FHE.allowThis(zeroIdx);
                _slotWinner[slot] = zeroIdx;
                slot++;
            }
        }
        _activeSlots = slot;

        _cumulative = FHE.asEuint64(0);
        FHE.allowThis(_cumulative);

        DrawRecord storage rec = _draws[epoch];
        rec.startedAt = uint64(block.timestamp);
        rec.participants = uint32(n);
        rec.winnerSlots = uint8(slot);
        rec.prize = prize;
        for (uint256 t = 0; t < _tiers.length; t++) rec.tiers.push(_tiers[t]);

        phase = Phase.Selecting;
        drawCursor = 0;
        emit DrawStarted(epoch, n, slot, prize);
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

        uint256 slots = _activeSlots;

        if (phase == Phase.Selecting) {
            euint64 cumulative = _cumulative;
            euint64[MAX_WINNERS] memory winners;
            for (uint256 k = 0; k < slots; k++) winners[k] = _slotWinner[k];

            for (uint256 i = drawCursor; i < end; i++) {
                euint64 weight = _weightOf(_participants[i]);
                cumulative = FHE.add(cumulative, weight);
                // winner_k = first index whose cumulative weight exceeds ticket_k
                //          = count of indices whose cumulative weight <= ticket_k
                for (uint256 k = 0; k < slots; k++) {
                    winners[k] = FHE.add(winners[k], FHE.asEuint64(FHE.le(cumulative, _slotTicket[k])));
                }
            }
            _cumulative = cumulative;
            FHE.allowThis(_cumulative);
            for (uint256 k = 0; k < slots; k++) {
                _slotWinner[k] = winners[k];
                FHE.allowThis(winners[k]);
            }
            drawCursor = end;

            if (end == n) {
                phase = Phase.Awarding;
                drawCursor = 0;
            }
            emit DrawAdvanced(epoch, phase, drawCursor);
            return;
        }

        // Phase.Awarding — credit each slot's prize to whichever index matches, encrypted.
        euint64 zero = FHE.asEuint64(0);
        for (uint256 i = drawCursor; i < end; i++) {
            address user = _participants[i];
            euint64 credit = zero;
            for (uint256 k = 0; k < slots; k++) {
                ebool isWinner = FHE.eq(_slotWinner[k], uint64(i));
                credit = FHE.add(credit, FHE.select(isWinner, _slotAmount[k], zero));
            }

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
            // Slots that found a winner (index < n) leave the reserve and join the
            // principal (they are now part of winners' balances). Others roll over.
            euint64 paid = zero;
            for (uint256 k = 0; k < slots; k++) {
                ebool found = FHE.lt(_slotWinner[k], uint64(n));
                paid = FHE.add(paid, FHE.select(found, _slotAmount[k], zero));
            }
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

    /// @notice Per-slot FHE seeds of a draw (publicly decryptable once the draw has started).
    function getDrawSeeds(uint256 epoch_) external view returns (euint64[] memory) {
        return _drawSeeds[epoch_];
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
