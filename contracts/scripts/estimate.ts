import { ethers } from "hardhat";
async function main() {
  const [d] = await ethers.getSigners();
  const fee = await ethers.provider.getFeeData();
  const price = fee.maxFeePerGas ?? fee.gasPrice ?? 0n;
  const bal = await ethers.provider.getBalance(d.address);
  const T = await ethers.getContractFactory("ConfidentialUSD");
  const Y = await ethers.getContractFactory("MockYieldSource");
  const P = await ethers.getContractFactory("ConfidentialPrizePool");
  const fake = d.address;
  const gT = await ethers.provider.estimateGas({ data: (await T.getDeployTransaction()).data, from: d.address });
  const gY = await ethers.provider.estimateGas({ data: (await Y.getDeployTransaction(fake, 500)).data, from: d.address });
  let gP = 0n;
  try { gP = await ethers.provider.estimateGas({ data: (await P.getDeployTransaction(fake, fake, 600)).data, from: d.address }); }
  catch { gP = 4_500_000n; console.log("pool estimate failed (constructor FHE ops); assuming 4.5M"); }
  const total = gT + gY + gP + 200_000n;
  console.log({ gasPriceGwei: ethers.formatUnits(price, "gwei"), gT: gT.toString(), gY: gY.toString(), gP: gP.toString(), totalGas: total.toString(), costEth: ethers.formatEther(total * price), balanceEth: ethers.formatEther(bal) });
  console.log(total * price * 12n / 10n < bal ? "FITS" : "TOO_TIGHT");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
