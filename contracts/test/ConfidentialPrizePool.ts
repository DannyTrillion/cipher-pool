import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import type { ConfidentialUSD, MockYieldSource, ConfidentialPrizePool } from "../typechain-types";

const ONE = 1_000_000n; // 6 decimals
const DRAW_PERIOD = 3600;
const FAR_FUTURE = 2n ** 48n - 1n;

describe("ConfidentialPrizePool", function () {
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner;
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

  async function fundAndDeposit(user: HardhatEthersSigner, amount: bigint) {
    await token.connect(user).faucet();
    await token.connect(user).setOperator(poolAddr, FAR_FUTURE);
    const enc = await encAmount(poolAddr, user, amount);
    await pool.connect(user).deposit(enc.handles[0], enc.inputProof);
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
    token = await (await ethers.getContractFactory("ConfidentialUSD")).deploy();
    tokenAddr = await token.getAddress();
    yieldSource = await (await ethers.getContractFactory("MockYieldSource")).deploy(tokenAddr, 500);
    pool = await (
      await ethers.getContractFactory("ConfidentialPrizePool")
    ).deploy(tokenAddr, await yieldSource.getAddress(), DRAW_PERIOD);
    poolAddr = await pool.getAddress();
    await token.setMinter(await yieldSource.getAddress(), true);
    await yieldSource.setPool(poolAddr);
  });

  describe("faucet", () => {
    it("mints 1,000 cUSD and enforces the cooldown", async () => {
      await token.connect(alice).faucet();
      expect(await tokenBalance(alice)).to.eq(1_000n * ONE);
      await expect(token.connect(alice).faucet()).to.be.revertedWithCustomError(token, "FaucetCooldown");
      expect(await token.faucetCooldownRemaining(alice.address)).to.be.gt(0n);
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
      await token.connect(alice).faucet();
      const enc = await encAmount(poolAddr, alice, 10n * ONE);
      await expect(pool.connect(alice).deposit(enc.handles[0], enc.inputProof)).to.be.revertedWithCustomError(
        token,
        "ERC7984UnauthorizedSpender",
      );
    });

    it("deposits nothing (without reverting) when the token balance is insufficient", async () => {
      await token.connect(alice).faucet();
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

    it("awards the sponsored prize to exactly one eligible depositor, privately", async () => {
      await fundAndDeposit(alice, 300n * ONE);
      await fundAndDeposit(bob, 700n * ONE);

      // Carol sponsors a 50 cUSD prize (does not join the pool).
      await token.connect(carol).faucet();
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

      // Draw record is publicly verifiable: seed + prize are public.
      const rec = await pool.getDraw(1);
      expect(rec.participants).to.eq(2n);
      const prize = await fhevm.publicDecryptEuint(FhevmType.euint64, rec.prize);
      expect(prize).to.be.gte(50n * ONE); // 50 donated + a little simulated yield
      await fhevm.publicDecryptEuint(FhevmType.euint64, rec.seed); // must not throw

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

      // Winnings land in the encrypted pool balance and are withdrawable.
      expect((await poolBalance(alice)) + (await poolBalance(bob))).to.eq(1_000n * ONE + prize2);
      const winner = a > 0n ? alice : bob;
      const enc = await encAmount(poolAddr, winner, prize2);
      await pool.connect(winner).withdraw(enc.handles[0], enc.inputProof);
      expect(await tokenBalance(winner)).to.eq((winner === alice ? 700n : 300n) * ONE + prize2);

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

      let aliceWins = 0;
      let bobWins = 0;
      const rounds = 12;
      for (let i = 0; i < rounds; i++) {
        await token.connect(carol).faucet().catch(() => {});
        await token.connect(carol).setOperator(poolAddr, FAR_FUTURE);
        const d = await encAmount(poolAddr, carol, 1n * ONE);
        await pool.connect(carol).donatePrize(d.handles[0], d.inputProof);
        await ethers.provider.send("evm_increaseTime", [DRAW_PERIOD + 1]);
        await runFullDraw();
        const e = await pool.epoch();
        if ((await wonInDraw(e, alice)) > 0n) aliceWins++;
        if ((await wonInDraw(e, bob)) > 0n) bobWins++;
      }
      expect(aliceWins + bobWins).to.eq(rounds); // there is always a winner once eligible
      expect(aliceWins).to.be.gt(bobWins);
    });

    it("lets a winner publish a proof-of-win, and nobody else can read it before", async () => {
      await fundAndDeposit(alice, 100n * ONE);
      await ethers.provider.send("evm_increaseTime", [DRAW_PERIOD + 1]);
      await runFullDraw(); // eligibility draw
      await token.connect(bob).faucet();
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

    it("accrues simulated yield on the encrypted principal", async () => {
      await fundAndDeposit(alice, 1_000n * ONE);
      await ethers.provider.send("evm_increaseTime", [365 * 24 * 3600]);
      await ethers.provider.send("evm_mine", []);
      await pool.harvest();
      // 5% APY on 1,000 for a year ≈ 50. Prize is public only once a draw starts,
      // so start a draw and read the snapshot.
      await runFullDraw();
      const prize = await fhevm.publicDecryptEuint(FhevmType.euint64, (await pool.getDraw(1)).prize);
      expect(prize).to.be.gte(50n * ONE);
      expect(prize).to.be.lt(51n * ONE);
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
