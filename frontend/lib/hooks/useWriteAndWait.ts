"use client";

import { useCallback } from "react";
import { useConfig } from "wagmi";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";
import type { Abi, Address } from "viem";

/**
 * Write a contract call and wait for the receipt, returning the tx hash.
 * Centralizes the "send → confirm" pattern so panels narrate it consistently.
 */
export function useWriteAndWait() {
  const config = useConfig();

  return useCallback(
    async (params: {
      address: Address;
      abi: Abi;
      functionName: string;
      args?: readonly unknown[];
      chainId: number;
      onSent?: (hash: `0x${string}`) => void;
    }): Promise<`0x${string}`> => {
      const hash = await writeContract(config, {
        address: params.address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args as never,
        chainId: params.chainId as never,
      });
      params.onSent?.(hash);
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: params.chainId as never });
      if (receipt.status === "reverted") {
        throw new Error(`Transaction reverted on-chain (${hash}).`);
      }
      return hash;
    },
    [config],
  );
}
