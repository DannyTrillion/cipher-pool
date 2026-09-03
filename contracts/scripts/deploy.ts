import hre, { ethers, network, artifacts } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Deploys ConfidentialUSD → MockYieldSource → ConfidentialPrizePool, wires the
 * roles, and writes addresses + ABIs for the frontend.
 *
 *   DRAW_PERIOD  seconds between draws (default 600 = 10 min for the demo)
 *   APY_BPS      simulated APY in basis points (default 500 = 5%)
 */
async function main() {
  // The FHEVM plugin's mock coprocessor is only available under `hardhat test`
  // or against a standalone node (`npx hardhat node` + --network localhost).
  if (network.name === "hardhat") {
    throw new Error("Use `npx hardhat node` then `--network localhost` for a local deploy, or --network sepolia.");
  }
  if (network.name === "localhost") {
    const f = (hre as unknown as { fhevm?: { initializeCLIApi?: () => Promise<void> } }).fhevm;
    await f?.initializeCLIApi?.();
  }
  const [deployer] = await ethers.getSigners();
  const drawPeriod = Number(process.env.DRAW_PERIOD ?? 600);
  const apyBps = Number(process.env.APY_BPS ?? 500);
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  console.log(`Deploying to ${network.name} (chainId ${chainId}) from ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const token = await (await ethers.getContractFactory("ConfidentialUSD")).deploy();
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`ConfidentialUSD      ${tokenAddr}`);

  const ys = await (await ethers.getContractFactory("MockYieldSource")).deploy(tokenAddr, apyBps);
  await ys.waitForDeployment();
  const ysAddr = await ys.getAddress();
  console.log(`MockYieldSource      ${ysAddr}`);

  const pool = await (await ethers.getContractFactory("ConfidentialPrizePool")).deploy(tokenAddr, ysAddr, drawPeriod);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`ConfidentialPrizePool ${poolAddr}`);

  await (await token.setMinter(ysAddr, true)).wait();
  await (await ys.setPool(poolAddr)).wait();
  console.log("Roles wired: yield source is a minter; pool is the yield source's pool.");

  const out = {
    chainId,
    network: network.name,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    drawPeriod,
    apyBps,
    contracts: {
      ConfidentialUSD: { address: tokenAddr, abi: (await artifacts.readArtifact("ConfidentialUSD")).abi },
      MockYieldSource: { address: ysAddr, abi: (await artifacts.readArtifact("MockYieldSource")).abi },
      ConfidentialPrizePool: {
        address: poolAddr,
        abi: (await artifacts.readArtifact("ConfidentialPrizePool")).abi,
      },
    },
  };

  const dir = join(__dirname, "..", "deployments");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${network.name}.json`);
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`Wrote ${file}`);

  const feDir = join(__dirname, "..", "..", "frontend", "lib", "contracts");
  mkdirSync(feDir, { recursive: true });
  writeFileSync(join(feDir, "deployment.json"), JSON.stringify(out, null, 2));
  console.log("Wrote frontend/lib/contracts/deployment.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
