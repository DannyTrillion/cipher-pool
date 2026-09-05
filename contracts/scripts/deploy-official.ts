import { ethers, network, artifacts } from "hardhat";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Deploys the pool + prize drip against Zama's OFFICIAL Sepolia mocks
 * (no token contracts of our own on-chain):
 *   USDTMock  0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0  (public mint(address,uint256))
 *   cUSDTMock 0x4E7B06D78965594eB5EF5414c357ca21E1554491  (ERC-7984 wrapper, 1:1)
 */
const USDT = process.env.USDT_MOCK ?? "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0";
const CUSDT = process.env.CUSDT_MOCK ?? "0x4E7B06D78965594eB5EF5414c357ca21E1554491";

const ERC20_MINT_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "event", name: "Transfer", inputs: [{ name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "value", type: "uint256", indexed: false }], anonymous: false },
];

async function main() {
  if (network.name !== "sepolia") throw new Error("deploy-official targets Sepolia (the official mocks live there).");
  const [deployer] = await ethers.getSigners();
  const drawPeriod = Number(process.env.DRAW_PERIOD ?? 600);
  const drip = BigInt(process.env.DRIP_PER_SEC ?? 2777);
  console.log(`Deploying to sepolia from ${deployer.address} · balance ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const ys = await (await ethers.getContractFactory("MockYieldSource")).deploy(USDT, CUSDT, drip);
  await ys.waitForDeployment();
  const ysAddr = await ys.getAddress();
  console.log(`MockYieldSource        ${ysAddr}`);

  const pool = await (await ethers.getContractFactory("ConfidentialPrizePool")).deploy(CUSDT, ysAddr, drawPeriod);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`ConfidentialPrizePool  ${poolAddr}`);
  await (await ys.setPool(poolAddr)).wait();
  console.log("Yield source points at the pool. Official USDTMock has a public mint, so no roles to grant.");

  const out = {
    chainId: 11155111,
    network: "sepolia",
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    drawPeriod,
    dripPerSecond: drip.toString(),
    official: true,
    contracts: {
      MockUSD: { address: USDT, abi: ERC20_MINT_ABI, note: "Zama official USDTMock (Sepolia)" },
      ConfidentialUSD: { address: CUSDT, abi: (await artifacts.readArtifact("ConfidentialUSD")).abi, note: "Zama official cUSDTMock (Sepolia), OpenZeppelin ERC7984ERC20Wrapper behind a proxy" },
      MockYieldSource: { address: ysAddr, abi: (await artifacts.readArtifact("MockYieldSource")).abi },
      ConfidentialPrizePool: { address: poolAddr, abi: (await artifacts.readArtifact("ConfidentialPrizePool")).abi },
    },
  };
  const dir = join(__dirname, "..", "deployments");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "sepolia.json"), JSON.stringify(out, null, 2));
  const feDir = join(__dirname, "..", "..", "frontend", "lib", "contracts");
  writeFileSync(join(feDir, "deployment.json"), JSON.stringify(out, null, 2));
  console.log("Wrote deployments/sepolia.json and frontend/lib/contracts/deployment.json");
  console.log(`Balance left ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
}
main().catch((e) => { console.error(e.shortMessage ?? e.message ?? e); process.exit(1); });
