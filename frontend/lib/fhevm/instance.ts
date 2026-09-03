"use client";

/**
 * Singleton FHEVM relayer-SDK instance for Sepolia. initSDK() loads the WASM
 * exactly once; createInstance() is memoised. Setup reads go through a reliable
 * HTTP RPC (wallet providers rate-limit and intermittently return `0x`).
 */
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { sepolia } from "wagmi/chains";

export const SUPPORTED_CHAIN_ID = sepolia.id;

const RPC =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

let instance: FhevmInstance | null = null;
let creating: Promise<FhevmInstance> | null = null;
let initPromise: Promise<unknown> | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isDecryptSupported(chainId: number | undefined): chainId is typeof sepolia.id {
  return chainId === sepolia.id;
}

export async function getFhevmInstance(): Promise<FhevmInstance> {
  if (instance) return instance;
  if (creating) return creating;
  creating = (async () => {
    if (typeof window === "undefined") throw new Error("FHEVM is only available in the browser.");
    const { initSDK, createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
    initPromise ??= initSDK();
    await initPromise;
    const config = { ...SepoliaConfig, network: RPC } as Parameters<typeof createInstance>[0];
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        instance = await createInstance(config);
        return instance;
      } catch (err) {
        lastErr = err;
        if (attempt < 2) await sleep(600 * (attempt + 1));
      }
    }
    throw lastErr;
  })();
  try {
    return await creating;
  } finally {
    creating = null;
  }
}

export function isFhevmReady(): boolean {
  return instance !== null;
}

/** Encrypt a single uint64 bound to (contract, user). */
export async function encryptUint64(contract: `0x${string}`, user: `0x${string}`, value: bigint) {
  const inst = await getFhevmInstance();
  const input = inst.createEncryptedInput(contract, user);
  input.add64(value);
  const enc = await input.encrypt();
  const handle = `0x${Buffer.from(enc.handles[0]).toString("hex")}` as `0x${string}`;
  const inputProof = `0x${Buffer.from(enc.inputProof).toString("hex")}` as `0x${string}`;
  return { handle, inputProof };
}

/** Public decryption of handles made publicly decryptable on-chain. */
export async function publicDecrypt(handles: string[]): Promise<Record<string, bigint>> {
  const inst = await getFhevmInstance();
  const res = await inst.publicDecrypt(handles);
  const out: Record<string, bigint> = {};
  for (const h of handles) {
    const v = (res.clearValues as Record<string, unknown>)[h];
    out[h] = typeof v === "bigint" ? v : BigInt(v as string | number | boolean);
  }
  return out;
}
