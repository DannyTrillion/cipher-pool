import { ethers, network, artifacts } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Deploys MockUSD (tUSD) → ConfidentialUSD (cUSD wrapper) → MockYieldSource → ConfidentialPrizePool,
 * wires the roles, and writes addresses + ABIs for the frontend.
 *
 *   DRAW_PERIOD   seconds between draws (default 600)
 *   DRIP_PER_SEC  simulated prize drip in tUSD base units per second (default 2777 ≈ 10 cUSD/hour)
 */
async function main() {
  if (network.name === "hardhat") throw new Error("Use `npx hardhat node` + --network localhost, or --network sepolia.");
  const [deployer] = await ethers.getSigners();
  const drawPeriod = Number(process.env.DRAW_PERIOD ?? 600);
  const drip = BigInt(process.env.DRIP_PER_SEC ?? 2777);
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log(`Deploying to ${network.name} (chainId ${chainId}) from ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const tusd = await (await ethers.getContractFactory("MockUSD")).deploy();
  await tusd.waitForDeployment();
  const tusdAddr = await tusd.getAddress();
  console.log(`MockUSD (tUSD)         ${tusdAddr}`);

  const token = await (await ethers.getContractFactory("ConfidentialUSD")).deploy(tusdAddr);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`ConfidentialUSD (cUSD) ${tokenAddr}`);

  const ys = await (await ethers.getContractFactory("MockYieldSource")).deploy(tusdAddr, tokenAddr, drip);
  await ys.waitForDeployment();
  const ysAddr = await ys.getAddress();
  console.log(`MockYieldSource        ${ysAddr}`);

  const pool = await (await ethers.getContractFactory("ConfidentialPrizePool")).deploy(tokenAddr, ysAddr, drawPeriod);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`ConfidentialPrizePool  ${poolAddr}`);

  await (await tusd.setMinter(ysAddr, true)).wait();
  await (await ys.setPool(poolAddr)).wait();
  console.log("Roles wired: yield source mints tUSD; pool is the yield source's pool.");

  const out = {
    chainId,
    network: network.name,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    drawPeriod,
    dripPerSecond: drip.toString(),
    contracts: {
      MockUSD: { address: tusdAddr, abi: (await artifacts.readArtifact("MockUSD")).abi },
      ConfidentialUSD: { address: tokenAddr, abi: (await artifacts.readArtifact("ConfidentialUSD")).abi },
      MockYieldSource: { address: ysAddr, abi: (await artifacts.readArtifact("MockYieldSource")).abi },
      ConfidentialPrizePool: { address: poolAddr, abi: (await artifacts.readArtifact("ConfidentialPrizePool")).abi },
    },
  };
  const dir = join(__dirname, "..", "deployments");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${network.name}.json`), JSON.stringify(out, null, 2));
  const feDir = join(__dirname, "..", "..", "frontend", "lib", "contracts");
  mkdirSync(feDir, { recursive: true });
  writeFileSync(join(feDir, "deployment.json"), JSON.stringify(out, null, 2));
  console.log(`Wrote deployments/${network.name}.json and frontend/lib/contracts/deployment.json`);
  console.log(`Balance left ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
}
main().catch((e) => { console.error(e.shortMessage ?? e.message ?? e); process.exit(1); });
