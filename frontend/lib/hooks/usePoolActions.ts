"use client";

import { useCallback } from "react";
import { useAccount, useConfig } from "wagmi";
import { readContract } from "wagmi/actions";
import { parseUnits } from "viem";
import { POOL, TOKEN, CHAIN_ID, DECIMALS, etherscanTx } from "@/lib/contracts";
import { encryptUint64 } from "@/lib/fhevm/instance";
import { useWriteAndWait } from "@/lib/hooks/useWriteAndWait";
import { useToast } from "@/components/ui/Toast";

const OPERATOR_TTL = 365 * 24 * 3600;
/** Participants processed per advanceDraw() tx — bounded to stay well under the FHE HCU budget. */
export const DRAW_BATCH = 5;

type Step = (s: string) => void;

export function usePoolActions() {
  const { address } = useAccount();
  const write = useWriteAndWait();
  const config = useConfig();
  const toast = useToast();

  const need = () => {
    if (!address) throw new Error("Connect your wallet first.");
    return address;
  };

  const txToast = (title: string, hash: string) => toast.push({ kind: "success", title, href: etherscanTx(hash) });

  const faucet = useCallback(
    async (setStep: Step) => {
      need();
      setStep("Confirm the faucet transaction in your wallet…");
      const hash = await write({ ...TOKEN, chainId: CHAIN_ID, functionName: "faucet", onSent: () => setStep("Minting 1,000 cUSD…") });
      txToast("Faucet claimed: 1,000 cUSD", hash);
      return hash;
    },
    [address, write],
  );

  const ensureOperator = useCallback(
    async (setStep: Step) => {
      const user = need();
      const ok = (await readContract(config, { ...TOKEN, chainId: CHAIN_ID, functionName: "isOperator", args: [user, POOL.address] })) as boolean;
      if (ok) return;
      setStep("One-time approval: allow the pool to move your cUSD…");
      const until = BigInt(Math.floor(Date.now() / 1000) + OPERATOR_TTL);
      const hash = await write({ ...TOKEN, chainId: CHAIN_ID, functionName: "setOperator", args: [POOL.address, until], onSent: () => setStep("Confirming approval…") });
      txToast("Pool approved as operator", hash);
    },
    [address, write, config],
  );

  const deposit = useCallback(
    async (amount: string, setStep: Step) => {
      const user = need();
      const value = parseUnits(amount, DECIMALS);
      if (value <= 0n) throw new Error("Enter an amount greater than zero.");
      await ensureOperator(setStep);
      setStep("Encrypting your amount locally…");
      const { handle, inputProof } = await encryptUint64(POOL.address, user, value);
      setStep("Confirm the deposit in your wallet…");
      const hash = await write({ ...POOL, chainId: CHAIN_ID, functionName: "deposit", args: [handle, inputProof], onSent: () => setStep("Depositing (encrypted)…") });
      txToast(`Deposited ${amount} cUSD`, hash);
      return hash;
    },
    [address, write, ensureOperator],
  );

  const withdraw = useCallback(
    async (amount: string, setStep: Step) => {
      const user = need();
      const value = parseUnits(amount, DECIMALS);
      if (value <= 0n) throw new Error("Enter an amount greater than zero.");
      setStep("Encrypting your amount locally…");
      const { handle, inputProof } = await encryptUint64(POOL.address, user, value);
      setStep("Confirm the withdrawal in your wallet…");
      const hash = await write({ ...POOL, chainId: CHAIN_ID, functionName: "withdraw", args: [handle, inputProof], onSent: () => setStep("Withdrawing (encrypted)…") });
      txToast(`Withdrew ${amount} cUSD`, hash);
      return hash;
    },
    [address, write],
  );

  const donate = useCallback(
    async (amount: string, setStep: Step) => {
      const user = need();
      const value = parseUnits(amount, DECIMALS);
      if (value <= 0n) throw new Error("Enter an amount greater than zero.");
      await ensureOperator(setStep);
      setStep("Encrypting your amount locally…");
      const { handle, inputProof } = await encryptUint64(POOL.address, user, value);
      setStep("Confirm the sponsorship in your wallet…");
      const hash = await write({ ...POOL, chainId: CHAIN_ID, functionName: "donatePrize", args: [handle, inputProof], onSent: () => setStep("Adding to the prize…") });
      txToast(`Sponsored ${amount} cUSD to the prize`, hash);
      return hash;
    },
    [address, write, ensureOperator],
  );

  const harvest = useCallback(
    async (setStep: Step) => {
      need();
      setStep("Confirm in your wallet…");
      const hash = await write({ ...POOL, chainId: CHAIN_ID, functionName: "harvest", onSent: () => setStep("Harvesting yield into the prize…") });
      txToast("Yield harvested", hash);
    },
    [address, write],
  );

  /** Start (if due) and run the draw to completion, batch by batch. */
  const runDraw = useCallback(
    async (setStep: Step, onProgress?: () => void) => {
      need();
      const phase = Number(await readContract(config, { ...POOL, chainId: CHAIN_ID, functionName: "phase" }));
      if (phase === 0) {
        setStep("Confirm: start the draw (harvest yield + draw the encrypted seed)…");
        const hash = await write({ ...POOL, chainId: CHAIN_ID, functionName: "startDraw", onSent: () => setStep("Drawing the on-chain FHE random seed…") });
        txToast("Draw started", hash);
        onProgress?.();
      }
      // Advance until the pool is open again.
      for (let i = 0; i < 200; i++) {
        const p = Number(await readContract(config, { ...POOL, chainId: CHAIN_ID, functionName: "phase" }));
        if (p === 0) break;
        const cursor = Number(await readContract(config, { ...POOL, chainId: CHAIN_ID, functionName: "drawCursor" }));
        const n = Number(await readContract(config, { ...POOL, chainId: CHAIN_ID, functionName: "participantCount" }));
        const label = p === 1 ? "Selecting the winner over encrypted balances" : "Crediting the prize to the encrypted winner";
        setStep(`${label} — ${cursor}/${n}. Confirm the next batch…`);
        await write({ ...POOL, chainId: CHAIN_ID, functionName: "advanceDraw", args: [BigInt(DRAW_BATCH)], onSent: () => setStep(`${label} — processing ${cursor}→${Math.min(cursor + DRAW_BATCH, n)} of ${n}…`) });
        onProgress?.();
      }
      toast.push({ kind: "success", title: "Draw complete", body: "The prize has been credited to the winner's encrypted balance." });
    },
    [address, write, config],
  );

  const revealWin = useCallback(
    async (epoch: bigint, setStep: Step) => {
      need();
      setStep("Confirm in your wallet…");
      const hash = await write({ ...POOL, chainId: CHAIN_ID, functionName: "revealWin", args: [epoch], onSent: () => setStep("Publishing your proof of win…") });
      txToast("Proof of win published", hash);
    },
    [address, write],
  );

  return { faucet, deposit, withdraw, donate, harvest, runDraw, revealWin, ensureOperator };
}
