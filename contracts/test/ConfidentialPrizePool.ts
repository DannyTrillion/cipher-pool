import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { ConfidentialUSD, MockYieldSource, ConfidentialPrizePool, MockUSD } from "../typechain-types";

const ONE = 1_000_000n; // 6 decimals
const DRAW_PERIOD = 3600;
const FAR_FUTURE = 2n ** 48n - 1n;

describe("ConfidentialPrizePool", function () {
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;
  let tusd: MockUSD;
  let token: ConfidentialUSD;
  let yieldSource: MockYieldSource;
  let pool: ConfidentialPrizePool;
  let tokenAddr: string;
  let poolAddr: string;

  async function encAmount(contract: string, user: HardhatEthersSigner, amount: bigint) {
    return fhevm.createEncryptedInput(contract, user.address).add64(amount).encrypt();
  }

  async function poolBalance(user: HardhatEthersSigner): Promise<bigint> {
    const h = await pool.balanceOf(user.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, poolAddr, user);
  }

  async function tokenBalance(user: HardhatEthersSigner): Promise<bigint> {
    const h = await token.confidentialBalanceOf(user.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, tokenAddr, user);
  }

  async function wonInDraw(epoch: bigint | number, user: HardhatEthersSigner): Promise<bigint> {
    const h = await pool.wonInDraw(epoch, user.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, poolAddr, user);
  }

  async function claimable(user: HardhatEthersSigner): Promise<bigint> {
    const h = await pool.claimableOf(user.address);
    if (h === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, h, poolAddr, user);
  }

  /** tUSD faucet → approve → wrap into cUSD (1,000) */
  async function fund(user: HardhatEthersSigner) {
    await tusd.connect(user).faucet();
    await tusd.connect(user).approve(tokenAddr, 1_000n * ONE);
    await token.connect(user).wrap(user.address, 1_000n * ONE);
  }

  async function fundAndDeposit(user: HardhatEthersSigner, amount: bigint) {
    await fund(user);
    await token.connect(user).setOperator(poolAddr, FAR_FUTURE);
    const enc = await encAmount(poolAddr, user, amount);
    await pool.connect(user).deposit(enc.handles[0], enc.inputProof);
  }

  const singleWinner = () => pool.setTiers([10_000], [1]);

  // Decrypt sequentially: the mock coprocessor's event cursor is not re-entrant.
  async function slotSeeds(epoch: bigint | number) {
    const seeds = await pool.getDrawSeeds(epoch);
    const out: bigint[] = [];
    for (const h of seeds) out.push(await fhevm.publicDecryptEuint(FhevmType.euint64, h));
    return out;
  }

  async function runFullDraw(batch = 10) {
    await pool.startDraw();
    while ((await pool.phase()) !== 0n) {
      await pool.advanceDraw(batch);
    }
  }

  before(async () => {
    [deployer, alice, bob, carol] = await ethers.getSigners();
  });

  beforeEach(async function () {
    if (!fhevm.isMock) this.skip();
    tusd = await (await ethers.getContractFactory("MockUSD")).deploy();
    token = await (await ethers.getContractFactory("ConfidentialUSD")).deploy(await tusd.getAddress());
    tokenAddr = await token.getAddress();
    // drip: 10 cUSD per hour = 10e6 / 3600 ≈ 2777 units per second
    yieldSource = await (await ethers.getContractFactory("MockYieldSource")).deploy(await tusd.getAddress(), tokenAddr, 2_777);
    pool = await (
      await ethers.getContractFactory("ConfidentialPrizePool")
    ).deploy(tokenAddr, await yieldSource.getAddress(), DRAW_PERIOD);
    poolAddr = await pool.getAddress();
    await tusd.setMinter(await yieldSource.getAddress(), true);
    await yieldSource.setPool(poolAddr);
  });

  describe("faucet + wrap", () => {
    it("mints 1,000 tUSD, enforces the cooldown, and wraps into encrypted cUSD 1:1", async () => {
      await tusd.connect(alice).faucet();
      expect(await tusd.balanceOf(alice.address)).to.eq(1_000n * ONE);
      await expect(tusd.connect(alice).faucet()).to.be.revertedWithCustomError(tusd, "FaucetCooldown");
      expect(await tusd.faucetCooldownRemaining(alice.address)).to.be.gt(0n);

      await expect(token.connect(alice).wrap(alice.address, 400n * ONE)).to.be.reverted; // no approval yet
      await tusd.connect(alice).approve(tokenAddr, 400n * ONE);
      await token.connect(alice).wrap(alice.address, 400n * ONE);
      expect(await tokenBalance(alice)).to.eq(400n * ONE);
      expect(await tusd.balanceOf(alice.address)).to.eq(600n * ONE);
      expect(await tusd.balanceOf(tokenAddr)).to.eq(400n * ONE); // fully backed
    });
  });

  describe("deposit / withdraw", () => {
    it("moves encrypted funds into the pool and back", async () => {
      await fundAndDeposit(alice, 400n * ONE);
      expect(await poolBalance(alice)).to.eq(400n * ONE);
      expect(await tokenBalance(alice)).to.eq(600n * ONE);
      expect(await pool.participantCount()).to.eq(1n);
      expect(await pool.isParticipant(alice.address)).to.eq(true);

      const enc = await encAmount(poolAddr, alice, 150n * ONE);
      await pool.connect(alice).withdraw(enc.handles[0], enc.inputProof);
      expect(await poolBalance(alice)).to.eq(250n * ONE);
      expect(await tokenBalance(alice)).to.eq(750n * ONE);
    });

    it("requires the pool to be an operator", async () => {
      await fund(alice);
      const enc = await encAmount(poolAddr, alice, 10n * ONE);
      await expect(pool.connect(alice).deposit(enc.handles[0], enc.inputProof)).to.be.revertedWithCustomError(
        token,
        "ERC7984UnauthorizedSpender",
      );
    });

    it("deposits nothing (without reverting) when the token balance is insufficient", async () => {
      await fund(alice);
      await token.connect(alice).setOperator(poolAddr, FAR_FUTURE);
      const enc = await encAmount(poolAddr, alice, 5_000n * ONE);
      await pool.connect(alice).deposit(enc.handles[0], enc.inputProof);
      expect(await poolBalance(alice)).to.eq(0n);
      expect(await tokenBalance(alice)).to.eq(1_000n * ONE);
    });

    it("withdraws nothing (without reverting) when asking for more than deposited", async () => {
      await fundAndDeposit(alice, 100n * ONE);
      const enc = await encAmount(poolAddr, alice, 101n * ONE);
      await pool.connect(alice).withdraw(enc.handles[0], enc.inputProof);
      expect(await poolBalance(alice)).to.eq(100n * ONE);
      expect(await tokenBalance(alice)).to.eq(900n * ONE);
    });

    it("rejects withdraw from an address that never deposited", async () => {
      const enc = await encAmount(poolAddr, alice, 1n);
      await expect(pool.connect(alice).withdraw(enc.handles[0], enc.inputProof)).to.be.revertedWithCustomError(
        pool,
        "NothingDeposited",
      );
    });

    it("does not let other users decrypt a depositor's balance", async () => {
      await fundAndDeposit(alice, 100n * ONE);
      const h = await pool.balanceOf(alice.address);
      await expect(fhevm.userDecryptEuint(FhevmType.euint64, h, poolAddr, bob)).to.be.rejected;
    });
  });

  describe("draws", () => {
    it("cannot start before the period elapses or with no participants", async () => {
      await expect(pool.startDraw()).to.be.revertedWithCustomError(pool, "DrawNotDue");
      await ethers.provider.send("evm_increaseTime", [DRAW_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);
      await expect(pool.startDraw()).to.be.revertedWithCustomError(pool, "NoParticipants");
      await expect(pool.advanceDraw(5)).to.be.revertedWithCustomError(pool, "DrawNotInProgress");
    });

    it("awards the sponsored prize to exactly one eligible depositor, privately (single-winner tier)", async () => {
      await singleWinner();
      await fundAndDeposit(alice, 300n * ONE);
      await fundAndDeposit(bob, 700n * ONE);

      // Carol sponsors a 50 cUSD prize (does not join the pool).
      await fund(carol);
      await token.connect(carol).setOperator(poolAddr, FAR_FUTURE);
      const donation = await encAmount(poolAddr, carol, 50n * ONE);
      await pool.connect(carol).donatePrize(donation.handles[0], donation.inputProof);

      // First draw: alice & bob deposited during this epoch, so their eligible
      // weight is min(0, balance) = 0 → nobody can win yet; prize rolls over.
      await ethers.provider.send("evm_increaseTime", [DRAW_PERIOD + 1]);
      await runFullDraw();
      expect(await pool.epoch()).to.eq(1n);
      expect(await wonInDraw(1, alice)).to.eq(0n);
      expect(await wonInDraw(1, bob)).to.eq(0n);

      // Draw record is publicly verifiable: seeds + prize are public.
      const rec = await pool.getDraw(1);
      expect(rec.participants).to.eq(2n);
      expect(rec.winnerSlots).to.eq(1n);
      const prize = await fhevm.publicDecryptEuint(FhevmType.euint64, rec.prize);
      expect(prize).to.be.gte(50n * ONE); // 50 donated + a little simulated yield
      expect((await slotSeeds(1)).length).to.eq(1); // must decrypt publicly

      // Second draw: both fully eligible now. Exactly one wins the whole prize.
      await ethers.provider.send("evm_increaseTime", [DRAW_PERIOD + 1]);
      await runFullDraw();
      expect(await pool.epoch()).to.eq(2n);
      const rec2 = await pool.getDraw(2);
      const prize2 = await fhevm.publicDecryptEuint(FhevmType.euint64, rec2.prize);
      expect(prize2).to.be.gte(prize);

      const a = await wonInDraw(2, alice);
      const b = await wonInDraw(2, bob);
      expect(a + b).to.eq(prize2);
      expect(a === 0n || b === 0n).to.eq(true);

      // Principal is untouched; the prize sits in the winner's encrypted claimable pot.
      expect((await poolBalance(alice)) + (await poolBalance(bob))).to.eq(1_000n * ONE);
      const winner = a > 0n ? alice : bob;
      const loser = winner === alice ? bob : alice;
      expect(await claimable(winner)).to.eq(prize2);
      expect(await claimable(loser)).to.eq(0n);

      // Claim moves it to the wallet by confidential transfer. A loser can claim too (moves zero).
      await pool.connect(winner).claimPrize();
      await pool.connect(loser).claimPrize();
      expect(await tokenBalance(winner)).to.eq((winner === alice ? 700n : 300n) * ONE + prize2);
      expect(await tokenBalance(loser)).to.eq((loser === alice ? 700n : 300n) * ONE);
      expect(await claimable(winner)).to.eq(0n);

      // Reserve is drained (publicly verifiable), and the pool reopened.
      expect(await pool.phase()).to.eq(0n);
      expect(await fhevm.publicDecryptEuint(FhevmType.euint64, await pool.prizeReserve())).to.eq(0n);
      // Total principal stays private — nobody (not even the owner) can decrypt it.
      await expect(
        fhevm.userDecryptEuint(FhevmType.euint64, await pool.totalDeposits(), poolAddr, deployer),
      ).to.be.rejected;
    });

    it("processes a draw in bounded batches and blocks deposits while in progress", async () => {
      for (const u of [alice, bob, carol]) await fundAndDeposit(u, 100n * ONE);
      await ethers.provider.send("evm_increaseTime", [DRAW_PERIOD + 1]);
      await pool.startDraw();
      expect(await pool.phase()).to.eq(1n); // Selecting

      const enc = await encAmount(poolAddr, alice, 1n * ONE);
      await expect(pool.connect(alice).deposit(enc.handles[0], enc.inputProof)).to.be.revertedWithCustomError(
        pool,
        "PoolNotOpen",
      );
      await expect(pool.startDraw()).to.be.revertedWithCustomError(pool, "PoolNotOpen");

      await pool.advanceDraw(2);
      expect(await pool.phase()).to.eq(1n);
      expect(await pool.drawCursor()).to.eq(2n);
      await pool.advanceDraw(2);
      expect(await pool.phase()).to.eq(2n); // Awarding
      expect(await pool.drawCursor()).to.eq(0n);
      await pool.advanceDraw(2);
      expect(await pool.drawCursor()).to.eq(2n);
      await pool.advanceDraw(2);
      expect(await pool.phase()).to.eq(0n); // Open again
      expect((await pool.getDraw(1)).completedAt).to.be.gt(0n);
    });

    it("weights odds by share: a whale wins far more often than a minnow", async function () {
      this.timeout(600_000);
      await fundAndDeposit(alice, 950n * ONE);
      await fundAndDeposit(bob, 50n * ONE);
      // Make them eligible (one draw with no prize).
      await ethers.provider.send("evm_increaseTime", [DRAW_PERIOD + 1]);
      await runFullDraw();

      let aliceWins = 0n;
      let bobWins = 0n;
      const rounds = 8;
      await fund(carol);
      await token.connect(carol).setOperator(poolAddr, FAR_FUTURE);
      for (let i = 0; i < rounds; i++) {
        const d = await encAmount(poolAddr, carol, 1n * ONE);
        await pool.connect(carol).donatePrize(d.handles[0], d.inputProof);
        await ethers.provider.send("evm_increaseTime", [DRAW_PERIOD + 1]);
        await runFullDraw();
        const e = await pool.epoch();
        aliceWins += await wonInDraw(e, alice);
        bobWins += await wonInDraw(e, bob);
      }
      expect(aliceWins + bobWins).to.be.gt(0n); // every slot finds a winner once weight > 0
      expect(aliceWins).to.be.gt(bobWins); // 95% share wins far more prize money over 8 draws × 5 slots
    });

    it("lets a winner publish a proof-of-win, and nobody else can read it before", async () => {
      await singleWinner();
      await fundAndDeposit(alice, 100n * ONE);
      await ethers.provider.send("evm_increaseTime", [DRAW_PERIOD + 1]);
      await runFullDraw(); // eligibility draw
      await fund(bob);
      await token.connect(bob).setOperator(poolAddr, FAR_FUTURE);
      const d = await encAmount(poolAddr, bob, 10n * ONE);
      await pool.connect(bob).donatePrize(d.handles[0], d.inputProof);
      await ethers.provider.send("evm_increaseTime", [DRAW_PERIOD + 1]);
      await runFullDraw();

      const h = await pool.wonInDraw(2, alice.address);
      await expect(fhevm.publicDecryptEuint(FhevmType.euint64, h)).to.be.rejected;
      await expect(pool.connect(bob).revealWin(2)).to.be.revertedWithCustomError(pool, "NothingToReveal");
      await pool.connect(alice).revealWin(2);
      expect(await fhevm.publicDecryptEuint(FhevmType.euint64, h)).to.be.gte(10n * ONE);
    });

    it("pays tiered prizes to several winner slots and keeps rounding dust in the reserve", async () => {
      // Default tiers: 1 × 40%, 2 × 20%, 2 × 10% = 5 slots.
      expect(await pool.winnerSlots()).to.eq(5n);
      for (const u of [alice, bob, carol]) await fundAndDeposit(u, 100n * ONE);
      await ethers.provider.send("evm_increaseTime", [DRAW_PERIOD + 1]);
      await runFullDraw(); // eligibility draw: nobody eligible, prize (yield only) rolls over

      // Sponsor 100 cUSD via the deployer.
      await fund(deployer);
      await token.setOperator(poolAddr, FAR_FUTURE);
      const d = await encAmount(poolAddr, deployer, 100n * ONE);
      await pool.donatePrize(d.handles[0], d.inputProof);

      await ethers.provider.send("evm_increaseTime", [DRAW_PERIOD + 1]);
      await runFullDraw(4); // 3 participants, batch 4 → one tx per pass
      const rec = await pool.getDraw(2);
      expect(rec.winnerSlots).to.eq(5n);
      expect(rec.tiers.length).to.eq(3);
      expect((await slotSeeds(2)).length).to.eq(5);

      const prize = await fhevm.publicDecryptEuint(FhevmType.euint64, rec.prize);
      // Slot amounts: 40% ×1, 20% ×2, 10% ×2 — dust from integer division stays in reserve.
      const perSlot = [prize * 4000n / 10000n, prize * 4000n / 20000n, prize * 4000n / 20000n, prize * 2000n / 20000n, prize * 2000n / 20000n];
      const expectedPaid = perSlot.reduce((a, b) => a + b, 0n);

      const credits: bigint[] = [];
      for (const u of [alice, bob, carol]) credits.push(await wonInDraw(2, u));
      const paid = credits.reduce((a, b) => a + b, 0n);
      expect(paid).to.eq(expectedPaid); // every slot found a winner (all three had weight)
      expect(paid).to.be.lte(prize);
      // Each credit is a sum of whole slot amounts.
      for (const c of credits) {
        let remaining = c;
        for (const amt of [...perSlot].sort((a, b) => (a < b ? 1 : -1))) while (remaining >= amt && amt > 0n) remaining -= amt;
        expect(remaining).to.eq(0n);
      }
      const reserve = await fhevm.publicDecryptEuint(FhevmType.euint64, await pool.prizeReserve());
      expect(reserve).to.eq(prize - expectedPaid);
    });

    it("rejects invalid tier configurations and changes during a draw", async () => {
      await expect(pool.setTiers([6000, 5000], [1, 1])).to.be.revertedWithCustomError(pool, "InvalidTiers"); // > 100%
      await expect(pool.setTiers([5000], [9])).to.be.revertedWithCustomError(pool, "InvalidTiers"); // > MAX_WINNERS
      await expect(pool.setTiers([5000, 0], [1, 1])).to.be.revertedWithCustomError(pool, "InvalidTiers");
      await expect(pool.setTiers([], [])).to.be.revertedWithCustomError(pool, "InvalidTiers");
      await expect(pool.connect(alice).setTiers([10_000], [1])).to.be.revertedWithCustomError(pool, "OwnableUnauthorizedAccount");
      await pool.setTiers([7000, 3000], [1, 3]);
      expect(await pool.winnerSlots()).to.eq(4n);
      const tiers = await pool.getTiers();
      expect(tiers[1].winners).to.eq(3n);

      await fundAndDeposit(alice, 10n * ONE);
      await ethers.provider.send("evm_increaseTime", [DRAW_PERIOD + 1]);
      await pool.startDraw();
      await expect(pool.setTiers([10_000], [1])).to.be.revertedWithCustomError(pool, "PoolNotOpen");
    });

    it("drips simulated yield into the prize as backed cUSD", async () => {
      await fundAndDeposit(alice, 1_000n * ONE);
      const before = await tusd.balanceOf(tokenAddr);
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine", []);
      await runFullDraw();
      const prize = await fhevm.publicDecryptEuint(FhevmType.euint64, (await pool.getDraw(1)).prize);
      // ~10 cUSD per hour at 2,777 units/s (elapsed includes a few extra seconds)
      expect(prize).to.be.gte(9_990_000n);
      expect(prize).to.be.lt(10_100_000n);
      // every dripped cUSD is backed by tUSD held in the wrapper
      expect((await tusd.balanceOf(tokenAddr)) - before).to.eq(prize);
    });

    it("claimPrize is safe for anyone and never reverts for non-winners", async () => {
      await fundAndDeposit(alice, 100n * ONE);
      await pool.connect(alice).claimPrize(); // nothing won yet → moves encrypted zero
      expect(await tokenBalance(alice)).to.eq(900n * ONE);
      await pool.connect(bob).claimPrize(); // never deposited, never won
      expect(await claimable(bob)).to.eq(0n);
    });
  });

  describe("admin", () => {
    it("only the owner can change the draw period", async () => {
      await expect(pool.connect(alice).setDrawPeriod(10)).to.be.revertedWithCustomError(pool, "OwnableUnauthorizedAccount");
      await pool.setDrawPeriod(10);
      expect(await pool.drawPeriod()).to.eq(10n);
      await expect(pool.setDrawPeriod(0)).to.be.revertedWithCustomError(pool, "InvalidPeriod");
    });
  });
});
