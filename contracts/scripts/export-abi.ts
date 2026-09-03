import { artifacts } from "hardhat";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";

/** Writes frontend/lib/contracts/deployment.json with ABIs (keeps existing addresses if present). */
async function main() {
  const feDir = join(__dirname, "..", "..", "frontend", "lib", "contracts");
  mkdirSync(feDir, { recursive: true });
  const file = join(feDir, "deployment.json");
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  const zero = "0x0000000000000000000000000000000000000000";
  const names = ["ConfidentialUSD", "MockYieldSource", "ConfidentialPrizePool"] as const;
  const contracts: Record<string, unknown> = {};
  for (const n of names) {
    contracts[n] = { address: prev?.contracts?.[n]?.address ?? zero, abi: (await artifacts.readArtifact(n)).abi };
  }
  const out = {
    chainId: prev?.chainId ?? 11155111,
    network: prev?.network ?? "sepolia",
    deployedAt: prev?.deployedAt ?? null,
    deployer: prev?.deployer ?? zero,
    drawPeriod: prev?.drawPeriod ?? 600,
    apyBps: prev?.apyBps ?? 500,
    contracts,
  };
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`Wrote ${file}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
