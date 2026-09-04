import { ethers, network, artifacts } from "hardhat";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

/** Redeploys only ConfidentialPrizePool, reusing the token + yield source from deployments/<network>.json. */
async function main() {
  const [deployer] = await ethers.getSigners();
  const file = join(__dirname, "..", "deployments", `${network.name}.json`);
  const prev = JSON.parse(readFileSync(file, "utf8"));
  const tokenAddr = prev.contracts.ConfidentialUSD.address;
  const ysAddr = prev.contracts.MockYieldSource.address;
  const drawPeriod = Number(process.env.DRAW_PERIOD ?? prev.drawPeriod ?? 600);

  const bal = await ethers.provider.getBalance(deployer.address);
  const fee = await ethers.provider.getFeeData();
  const P = await ethers.getContractFactory("ConfidentialPrizePool");
  const est = await ethers.provider.estimateGas({ data: (await P.getDeployTransaction(tokenAddr, ysAddr, drawPeriod)).data, from: deployer.address });
  const block = await ethers.provider.getBlock("latest");
  const baseFee = block?.baseFeePerGas ?? fee.gasPrice ?? 0n;
  const tip = 100_000_000n; // 0.1 gwei
  const maxFee = (baseFee * 13n) / 10n + tip; // tight cap: base fee +30% headroom
  const cost = est * maxFee;
  console.log(`Balance ${ethers.formatEther(bal)} ETH · base fee ${ethers.formatUnits(baseFee, "gwei")} gwei · pool deploy est ${est} gas ≈ ${ethers.formatEther(cost)} ETH at cap`);
  if (cost * 11n / 10n > bal) throw new Error("Insufficient ETH for a safe redeploy; top up the deployer.");

  const pool = await P.deploy(tokenAddr, ysAddr, drawPeriod, { maxFeePerGas: maxFee, maxPriorityFeePerGas: tip });
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`ConfidentialPrizePool ${poolAddr}`);

  const ys = await ethers.getContractAt("MockYieldSource", ysAddr);
  await (await ys.setPool(poolAddr)).wait();
  console.log("Yield source now points at the new pool.");

  const out = {
    ...prev,
    deployedAt: new Date().toISOString(),
    drawPeriod,
    contracts: {
      ...prev.contracts,
      ConfidentialPrizePool: { address: poolAddr, abi: (await artifacts.readArtifact("ConfidentialPrizePool")).abi },
    },
  };
  writeFileSync(file, JSON.stringify(out, null, 2));
  const feDir = join(__dirname, "..", "..", "frontend", "lib", "contracts");
  mkdirSync(feDir, { recursive: true });
  writeFileSync(join(feDir, "deployment.json"), JSON.stringify(out, null, 2));
  console.log(`Wrote ${file} and frontend/lib/contracts/deployment.json`);
  console.log(`Balance left ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
}
main().catch((e) => { console.error(e.shortMessage ?? e.message ?? e); process.exit(1); });
