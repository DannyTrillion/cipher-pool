import { ethers, network } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Minimal keeper: polls the pool and runs draws when due, batch by batch.
 * Anyone can run this — the pool's draw functions are permissionless.
 *
 *   npx hardhat run scripts/keeper.ts --network sepolia
 *   BATCH=5 POLL_MS=30000
 */
async function main() {
  const d = JSON.parse(readFileSync(join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"));
  const [keeper] = await ethers.getSigners();
  const pool = await ethers.getContractAt("ConfidentialPrizePool", d.contracts.ConfidentialPrizePool.address, keeper);
  const batch = BigInt(process.env.BATCH ?? 5);
  const poll = Number(process.env.POLL_MS ?? 30_000);
  console.log(`Keeper ${keeper.address} watching pool ${pool.target} (batch ${batch}, poll ${poll}ms)`);
  for (;;) {
    try {
      const phase = Number(await pool.phase());
      if (phase === 0) {
        if (await pool.isDrawDue()) {
          console.log(`${new Date().toISOString()} draw due → startDraw`);
          await (await pool.startDraw()).wait();
        }
      } else {
        const cursor = await pool.drawCursor();
        const n = await pool.participantCount();
        console.log(`${new Date().toISOString()} phase ${phase} cursor ${cursor}/${n} → advanceDraw(${batch})`);
        await (await pool.advanceDraw(batch)).wait();
        continue; // keep pushing without waiting for the poll interval
      }
    } catch (e) {
      console.error("keeper error:", (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, poll));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
