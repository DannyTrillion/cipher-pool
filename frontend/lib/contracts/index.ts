import type { Abi, Address } from "viem";
import raw from "./deployment.json";

/**
 * Single source of addresses + ABIs, written by contracts/scripts/deploy.ts.
 * Never hardcode addresses elsewhere.
 */
export const deployment = raw as unknown as {
  chainId: number;
  network: string;
  deployedAt: string;
  deployer: Address;
  drawPeriod: number;
  dripPerSecond: string;
  contracts: {
    MockUSD: { address: Address; abi: Abi };
    ConfidentialUSD: { address: Address; abi: Abi };
    MockYieldSource: { address: Address; abi: Abi };
    ConfidentialPrizePool: { address: Address; abi: Abi };
  };
};

export const POOL = deployment.contracts.ConfidentialPrizePool;
export const TUSD = deployment.contracts.MockUSD;
export const TOKEN = deployment.contracts.ConfidentialUSD;
export const YIELD = deployment.contracts.MockYieldSource;
export const CHAIN_ID = 11155111 as const; // Sepolia — matches deployment.chainId
export const DECIMALS = 6;
export const SYMBOL = "cUSD";
export const UNDERLYING_SYMBOL = "tUSD";
/** Simulated prize drip per hour, in base units. */
export const DRIP_PER_HOUR = BigInt(deployment.dripPerSecond ?? "2777") * 3600n;

export const etherscanTx = (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`;
export const etherscanAddr = (a: string) => `https://sepolia.etherscan.io/address/${a}`;
